<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Services\DiamondsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class AmizadeQuizController extends Controller
{
    private const ENTRY_FEE = 5;
    private const TOTAL = 10;
    private const SECONDS_PER_Q = 60;
    private const ROOM_TTL_HOURS = 6;

    // ==============================
    // Pages
    // ==============================

    public function index(Request $request, DiamondsService $diamonds)
    {
        $balance = $diamonds->balance($request->user());

        return view('user.quiz.amizade.index', [
            'balance' => $balance,
            'minFee' => self::ENTRY_FEE,
        ]);
    }

    public function create(Request $request, DiamondsService $diamonds)
    {
        $user = $request->user();
        $balance = $diamonds->balance($user);

        if ($balance < self::ENTRY_FEE) {
            return back()->with('error', 'Saldo insuficiente: você precisa de pelo menos 5 diamantes para jogar.');
        }

        $code = $this->generateCode();

        $room = [
            'code' => $code,
            'status' => 'lobby', // lobby | in_progress | finished
            'createdAtMs' => $this->nowMs(),
            'hostId' => (int) $user->id,

            'players' => [
                (string) $user->id => $this->playerPayload($user),
            ],

            'paid' => [],     // userId => true
            'pot' => 0,       // total em disputa

            'questions' => [],      // packed questions (includes correctChoice)
            'currentIndex' => 0,
            'qStartedAtMs' => null,

            'winnerId' => null,
            'finishedAtMs' => null,
            'paidOut' => false, // evita pagar prêmio 2x
        ];

        $this->saveRoom($code, $room);

        return redirect()->route('user.quiz.amizade.room', $code);
    }

    public function join(Request $request, DiamondsService $diamonds)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:10'],
        ]);

        $code = strtoupper(trim($data['code']));
        $room = $this->getRoom($code);

        if (($room['status'] ?? null) !== 'lobby') {
            return back()->with('error', 'Esta sala já começou ou já finalizou.');
        }

        $user = $request->user();
        $balance = $diamonds->balance($user);

        if ($balance < self::ENTRY_FEE) {
            return back()->with('error', 'Saldo insuficiente: você precisa de pelo menos 5 diamantes para jogar.');
        }

        $uid = (string) $user->id;

        if (!isset($room['players'][$uid])) {
            $room['players'][$uid] = $this->playerPayload($user);

            // se não há host (caso raro), define
            if (empty($room['hostId'])) {
                $room['hostId'] = (int) $user->id;
            }

            $this->saveRoom($code, $room);
        }

        return redirect()->route('user.quiz.amizade.room', $code);
    }

    public function leave(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $code = strtoupper(trim($data['code']));
        $room = $this->getRoom($code);

        if (($room['status'] ?? null) !== 'lobby') {
            return redirect()->route('user.quiz.amizade.room', $code)
                ->with('error', 'Não é possível sair após o início. (MVP)');
        }

        $uid = (string) $request->user()->id;
        unset($room['players'][$uid]);

        // Transferir host se necessário
        if ((int)($room['hostId'] ?? 0) === (int)$uid) {
            $keys = array_keys($room['players']);
            $room['hostId'] = isset($keys[0]) ? (int)$keys[0] : null;
        }

        if (empty($room['players'])) {
            Cache::forget($this->roomKey($code));
            return redirect()->route('user.quiz.amizade.index')->with('success', 'Sala encerrada.');
        }

        $this->saveRoom($code, $room);
        return redirect()->route('user.quiz.amizade.index')->with('success', 'Você saiu da sala.');
    }

    public function room(Request $request, DiamondsService $diamonds, string $code)
    {
        $code = strtoupper(trim($code));
        $room = $this->getRoom($code);

        // Se não está na sala, tenta entrar automaticamente (somente lobby)
        $uid = (string) $request->user()->id;
        if (!isset($room['players'][$uid]) && ($room['status'] ?? null) === 'lobby') {
            $bal = $diamonds->balance($request->user());
            if ($bal >= self::ENTRY_FEE) {
                $room['players'][$uid] = $this->playerPayload($request->user());
                $this->saveRoom($code, $room);
            }
        }

        return view('user.quiz.amizade.room', [
            'code' => $code,
            'music' => [
                asset('musicas/musica.mp3'),
                asset('musicas/musica1.mp3'),
                asset('musicas/musica2.mp3'),
                asset('musicas/musica3.mp3'),
                asset('musicas/musica4.mp3'),
            ],
        ]);
    }

    // ==============================
    // Game actions
    // ==============================

    public function start(Request $request, DiamondsService $diamonds, string $code)
    {
        $code = strtoupper(trim($code));

        $lock = Cache::lock('friend_room_start:' . $code, 8);

        return $lock->block(3, function () use ($request, $diamonds, $code) {
            $room = $this->getRoom($code);
            $user = $request->user();

            if (($room['status'] ?? null) !== 'lobby') {
                return response()->json(['ok' => false, 'message' => 'Sala já iniciada.'], 422);
            }

            if ((int)($room['hostId'] ?? 0) !== (int)$user->id) {
                return response()->json(['ok' => false, 'message' => 'Somente o anfitrião pode iniciar.'], 403);
            }

            $players = $room['players'] ?? [];
            if (count($players) < 2) {
                return response()->json(['ok' => false, 'message' => 'É necessário 2 ou mais jogadores.'], 422);
            }

            // Confere existência + saldo de todos antes de qualquer coisa
            foreach ($players as $pid => $_p) {
                $u = $request->user()->newQuery()->find((int)$pid);
                if (!$u) {
                    return response()->json(['ok' => false, 'message' => 'Jogador inválido na sala.'], 422);
                }
                if ($diamonds->balance($u) < self::ENTRY_FEE) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'Um jogador está com menos de 5 diamantes. Remova/peça recarga e tente novamente.',
                    ], 422);
                }
            }

            // 1) Seleciona perguntas ANTES de cobrar (evita debitar e depois falhar)
            $packed = $this->pickQuestionsPacked(self::TOTAL);
            if (count($packed) < self::TOTAL) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Banco de questões insuficiente (precisa de 10). Verifique se as perguntas estão publicadas, têm 5 opções (A–E) e alternativa correta.',
                ], 422);
            }

            // 2) Cobra 5 de cada com rollback se falhar
            $chargedIds = [];
            try {
                foreach ($players as $pid => $_p) {
                    $u = $request->user()->newQuery()->find((int)$pid);
                    if (!$u) continue;

                    $diamonds->debit($u, self::ENTRY_FEE);
                    $chargedIds[] = (int)$pid;

                    // reset placar/tempo/answers
                    $room['players'][(string)$pid]['score'] = 0;
                    $room['players'][(string)$pid]['timeMs'] = 0;
                    $room['players'][(string)$pid]['answers'] = [];
                }
            } catch (\Throwable $e) {
                // devolve para quem já foi cobrado
                foreach ($chargedIds as $pid) {
                    $u = $request->user()->newQuery()->find((int)$pid);
                    if ($u) {
                        try { $diamonds->credit($u, self::ENTRY_FEE); } catch (\Throwable $_) {}
                    }
                }

                return response()->json([
                    'ok' => false,
                    'message' => 'Não foi possível cobrar a taxa de todos os jogadores. Tente novamente.',
                ], 422);
            }

            $room['paid'] = array_fill_keys(array_map('strval', $chargedIds), true);
            $room['pot']  = self::ENTRY_FEE * count($players);

            $now = $this->nowMs();

            $room['questions'] = $packed;
            $room['status'] = 'in_progress';
            $room['currentIndex'] = 0;
            $room['qStartedAtMs'] = $now;

            $room['winnerId'] = null;
            $room['finishedAtMs'] = null;
            $room['paidOut'] = false;

            $this->saveRoom($code, $room);

            return response()->json(['ok' => true]);
        });
    }

    public function state(Request $request, DiamondsService $diamonds, string $code)
    {
        $code = strtoupper(trim($code));
        $room = $this->getRoom($code);

        // tick por timeout
        $room = $this->tickRoom($request, $diamonds, $code, $room);

        $uid = (string) $request->user()->id;
        $isHost = ((int)($room['hostId'] ?? 0) === (int)$uid);

        $payload = [
            'ok' => true,
            'serverNowMs' => $this->nowMs(),
            'code' => $code,
            'status' => (string) ($room['status'] ?? 'lobby'),
            'hostId' => $room['hostId'] ?? null,
            'isHost' => $isHost,
            'pot' => (int) ($room['pot'] ?? 0),
            'entryFee' => self::ENTRY_FEE,
            'total' => self::TOTAL,
            'secondsPerQ' => self::SECONDS_PER_Q,
            'players' => array_values($room['players'] ?? []),
            'me' => ($room['players'][$uid] ?? null),
            'currentIndex' => (int) ($room['currentIndex'] ?? 0),
            'qStartedAtMs' => $room['qStartedAtMs'] ?? null,
            'winnerId' => $room['winnerId'] ?? null,
            'finishedAtMs' => $room['finishedAtMs'] ?? null,
            'balance' => $diamonds->balance($request->user()),
        ];

        if (($room['status'] ?? null) === 'in_progress') {
            $idx = (int) ($room['currentIndex'] ?? 0);
            $q = $room['questions'][$idx] ?? null;

            $payload['question'] = $q ? $this->publicQuestion($q) : null;

            $deadline = (int)($room['qStartedAtMs'] ?? 0) + (self::SECONDS_PER_Q * 1000);
            $remainingMs = max(0, $deadline - $this->nowMs());
            $payload['remainingMs'] = $remainingMs;

            // respondeu a atual?
            if ($q && isset($room['players'][$uid]['answers'][(string)$q['id']])) {
                $payload['answered'] = true;
            } else {
                $payload['answered'] = false;
            }
        }

        return response()->json($payload);
    }

    public function answer(Request $request, DiamondsService $diamonds, string $code)
    {
        $code = strtoupper(trim($code));

        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'choice' => ['nullable', 'regex:/^[A-Ea-e]$/'],
        ]);

        $lock = Cache::lock('friend_room_answer:' . $code, 6);

        return $lock->block(3, function () use ($request, $diamonds, $code, $data) {
            $room = $this->getRoom($code);

            if (($room['status'] ?? null) !== 'in_progress') {
                return response()->json(['ok' => false, 'message' => 'Sala não está em jogo.'], 422);
            }

            $uid = (string) $request->user()->id;
            if (!isset($room['players'][$uid])) {
                return response()->json(['ok' => false, 'message' => 'Você não está nesta sala.'], 403);
            }

            // tick antes de aceitar (pode ter estourado o tempo)
            $room = $this->tickRoom($request, $diamonds, $code, $room);

            if (($room['status'] ?? null) !== 'in_progress') {
                return response()->json(['ok' => true]); // já finalizou via timeout
            }

            $idx = (int) ($room['currentIndex'] ?? 0);
            $q = $room['questions'][$idx] ?? null;
            if (!$q) {
                return response()->json(['ok' => false, 'message' => 'Questão inválida.'], 422);
            }

            if ((int)$data['question_id'] !== (int)$q['id']) {
                return response()->json(['ok' => false, 'message' => 'Questão fora de sincronização.'], 422);
            }

            $qKey = (string) $q['id'];
            if (isset($room['players'][$uid]['answers'][$qKey])) {
                // já respondeu: devolve o último resultado (se quiser)
                $prev = $room['players'][$uid]['answers'][$qKey] ?? null;
                return response()->json([
                    'ok' => true,
                    'result' => [
                        'isCorrect' => (bool) ($prev['correct'] ?? false),
                        'correctChoice' => (string) ($q['correctChoice'] ?? ''),
                        'choice' => $prev['choice'] ?? null,
                        'inTime' => true,
                        'deltaMs' => (int) ($prev['deltaMs'] ?? 0),
                    ],
                ]);
            }

            $now = $this->nowMs();
            $startedAt = (int) ($room['qStartedAtMs'] ?? 0);
            $deadline = $startedAt + (self::SECONDS_PER_Q * 1000);

            $choice = $data['choice'] ? strtoupper((string)$data['choice']) : null;

            // Se chegou após o deadline, conta como fora do tempo
            $delta = min(self::SECONDS_PER_Q * 1000, max(0, $now - $startedAt));
            $inTime = ($now <= $deadline);

            $isCorrect = $inTime && $choice !== null && $choice === (string)$q['correctChoice'];

            $room['players'][$uid]['answers'][$qKey] = [
                'choice' => $choice,
                'correct' => $isCorrect,
                'atMs' => $now,
                'deltaMs' => (int) $delta,
            ];

            if ($isCorrect) {
                $room['players'][$uid]['score'] = ((int)($room['players'][$uid]['score'] ?? 0)) + 1;
            }

            $room['players'][$uid]['timeMs'] = ((int)($room['players'][$uid]['timeMs'] ?? 0)) + (int)$delta;

            // Se todos responderam a atual, avança imediatamente
            if ($this->allAnswered($room, (int)$q['id'])) {
                $room = $this->advanceOrFinish($request, $diamonds, $code, $room);
            }

            $this->saveRoom($code, $room);

            return response()->json([
                'ok' => true,
                'result' => [
                    'isCorrect' => (bool) $isCorrect,
                    'correctChoice' => (string) ($q['correctChoice'] ?? ''),
                    'choice' => $choice,
                    'inTime' => (bool) $inTime,
                    'deltaMs' => (int) $delta,
                ],
            ]);
        });
    }

    // ==============================
    // Engine (tick/advance/finish)
    // ==============================

    private function tickRoom(Request $request, DiamondsService $diamonds, string $code, array $room): array
    {
        if (($room['status'] ?? null) !== 'in_progress') {
            return $room;
        }

        $idx = (int) ($room['currentIndex'] ?? 0);
        $q = $room['questions'][$idx] ?? null;
        if (!$q) {
            // se ficou inválido, finaliza com segurança
            $room = $this->finishRoom($request, $diamonds, $code, $room);
            $this->saveRoom($code, $room);
            return $room;
        }

        $now = $this->nowMs();
        $deadline = (int)($room['qStartedAtMs'] ?? 0) + (self::SECONDS_PER_Q * 1000);

        // tempo estourou -> marca não respondidos e avança
        if ($now >= $deadline) {
            $room = $this->markTimeouts($room, $q, $deadline);
            $room = $this->advanceOrFinish($request, $diamonds, $code, $room);
            $this->saveRoom($code, $room);
        }

        return $room;
    }

    private function markTimeouts(array $room, array $q, int $deadlineMs): array
    {
        $qKey = (string) $q['id'];

        foreach (($room['players'] ?? []) as $uid => $p) {
            if (!isset($room['players'][$uid]['answers'][$qKey])) {
                $room['players'][$uid]['answers'][$qKey] = [
                    'choice' => null,
                    'correct' => false,
                    'atMs' => $deadlineMs,
                    'deltaMs' => self::SECONDS_PER_Q * 1000,
                ];

                $room['players'][$uid]['timeMs'] = ((int)($room['players'][$uid]['timeMs'] ?? 0)) + (self::SECONDS_PER_Q * 1000);
            }
        }

        return $room;
    }

    private function allAnswered(array $room, int $questionId): bool
    {
        $qKey = (string) $questionId;
        foreach (($room['players'] ?? []) as $uid => $p) {
            if (!isset($p['answers'][$qKey])) return false;
        }
        return true;
    }

    private function advanceOrFinish(Request $request, DiamondsService $diamonds, string $code, array $room): array
    {
        $idx = (int) ($room['currentIndex'] ?? 0);

        if ($idx >= self::TOTAL - 1) {
            return $this->finishRoom($request, $diamonds, $code, $room);
        }

        $room['currentIndex'] = $idx + 1;
        $room['qStartedAtMs'] = $this->nowMs();

        return $room;
    }

    private function finishRoom(Request $request, DiamondsService $diamonds, string $code, array $room): array
    {
        if (($room['status'] ?? null) === 'finished') {
            // garante que não paga novamente
            return $room;
        }

        $room['status'] = 'finished';
        $room['finishedAtMs'] = $this->nowMs();

        // Define vencedor: maior score; desempate: menor timeMs; se persistir, menor joinedAtMs
        $players = array_values($room['players'] ?? []);

        usort($players, function ($a, $b) {
            $sa = (int)($a['score'] ?? 0);
            $sb = (int)($b['score'] ?? 0);
            if ($sa !== $sb) return $sb <=> $sa; // desc

            $ta = (int)($a['timeMs'] ?? 0);
            $tb = (int)($b['timeMs'] ?? 0);
            if ($ta !== $tb) return $ta <=> $tb; // asc

            $ja = (int)($a['joinedAtMs'] ?? 0);
            $jb = (int)($b['joinedAtMs'] ?? 0);
            return $ja <=> $jb; // asc
        });

        $winner = $players[0] ?? null;
        $winnerId = $winner ? (int)($winner['id'] ?? 0) : null;
        $room['winnerId'] = $winnerId ?: null;

        // paga somente 1x
        $pot = (int)($room['pot'] ?? 0);
        if (!empty($winnerId) && $pot > 0 && empty($room['paidOut'])) {
            $u = $request->user()->newQuery()->find($winnerId);
            if ($u) {
                $diamonds->credit($u, $pot);
                $room['paidOut'] = true;
            }
        }

        return $room;
    }

    // ==============================
    // Perguntas (packed)
    // ==============================

    private function pickQuestionsPacked(int $n): array
    {
        $model = $this->questionModel();
        $query = $model::query();

        $table = (new $model())->getTable();

        // publicação: no seu projeto (admin) é "status = published"
        if (Schema::hasColumn($table, 'status')) {
            $query->where('status', 'published');
        } elseif (Schema::hasColumn($table, 'published')) {
            $query->where('published', true);
        } elseif (Schema::hasColumn($table, 'is_published')) {
            $query->where('is_published', true);
        } elseif (Schema::hasColumn($table, 'published_at')) {
            $query->whereNotNull('published_at');
        }

        // Como pode haver perguntas inválidas (faltando opção/correta),
        // buscamos mais e vamos filtrando até completar N.
        $out = [];
        $usedIds = [];

        $maxTries = 6; // evita loop infinito
        for ($t = 0; $t < $maxTries && count($out) < $n; $t++) {
            $batch = $query
                ->when(!empty($usedIds), fn($qq) => $qq->whereNotIn('id', $usedIds))
                ->inRandomOrder()
                ->limit(max(20, $n * 3))
                ->get();

            if ($batch->isEmpty()) break;

            foreach ($batch as $row) {
                $usedIds[] = (int) $row->id;

                $packed = $this->packQuestion($row);
                if ($packed) {
                    $out[] = $packed;
                    if (count($out) >= $n) break;
                }
            }
        }

        return array_slice($out, 0, $n);
    }

    private function packQuestion($q): ?array
    {
        $text = (string) ($q->text ?? $q->question ?? $q->titulo ?? '');
        $text = trim($text);
        if ($text === '') return null;

        $choices = $this->extractChoices($q);
        $correct = $this->getCorrectChoice($q);
        if (!$correct) return null;

        $correct = strtoupper($correct);
        if (!in_array($correct, ['A', 'B', 'C', 'D', 'E'], true)) return null;

        // exige 5 opções A..E preenchidas
        foreach (['A', 'B', 'C', 'D', 'E'] as $L) {
            if (!isset($choices[$L]) || trim((string)$choices[$L]) === '') return null;
        }

        return [
            'id' => (int) $q->id,
            'text' => $text,
            'choices' => $choices,                // ['A'=>'..',...]
            'correctChoice' => (string) $correct, // 'A'..'E'
        ];
    }

    private function publicQuestion(array $packed): array
    {
        return [
            'id' => (int)($packed['id'] ?? 0),
            'text' => (string)($packed['text'] ?? ''),
            'choices' => (array)($packed['choices'] ?? []),
        ];
    }

    private function extractChoices($q): array
    {
        // Caso exista um array "choices" no model
        if (isset($q->choices) && is_array($q->choices)) {
            $letters = ['A', 'B', 'C', 'D', 'E'];
            $out = [];
            foreach ($letters as $idx => $L) {
                $out[$L] = (string) ($q->choices[$idx] ?? '');
            }
            return $out;
        }

        // Seu model real (QuizQuestion) usa option_a..option_e
        $map = [
            'A' => ['option_a', 'choice_a', 'a'],
            'B' => ['option_b', 'choice_b', 'b'],
            'C' => ['option_c', 'choice_c', 'c'],
            'D' => ['option_d', 'choice_d', 'd'],
            'E' => ['option_e', 'choice_e', 'e'],
        ];

        $out = ['A' => '', 'B' => '', 'C' => '', 'D' => '', 'E' => ''];

        foreach ($map as $L => $fields) {
            foreach ($fields as $f) {
                if (isset($q->{$f}) && $q->{$f} !== null) {
                    $out[$L] = (string) $q->{$f};
                    break;
                }
            }
        }

        return $out;
    }

    private function getCorrectChoice($q): ?string
    {
        // seu admin usa "correct_option"
        if (isset($q->correct_option) && is_string($q->correct_option)) {
            return strtoupper($q->correct_option);
        }

        // outros padrões possíveis
        if (isset($q->correct_choice) && is_string($q->correct_choice)) return strtoupper($q->correct_choice);
        if (isset($q->correct) && is_string($q->correct)) return strtoupper($q->correct);

        if (isset($q->correct_index)) {
            $idx = (int) $q->correct_index;
            $letters = ['A', 'B', 'C', 'D', 'E'];
            return $letters[$idx] ?? null;
        }

        return null;
    }

    private function questionModel(): string
    {
        // no seu projeto, o correto é QuizQuestion
        $candidates = [
            'App\\Models\\QuizQuestion',
            'App\\Models\\Question',
            'App\\Models\\Pergunta',
            'App\\Models\\Quiz\\Question',
            'App\\Models\\Quiz\\Pergunta',
        ];

        foreach ($candidates as $class) {
            if (class_exists($class)) return $class;
        }

        throw new \RuntimeException('Model de perguntas não encontrado. Ajuste questionModel().');
    }

    // ==============================
    // Room storage helpers
    // ==============================

    private function generateCode(): string
    {
        for ($i = 0; $i < 30; $i++) {
            $code = strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 6));
            if (!Cache::has($this->roomKey($code))) {
                return $code;
            }
        }

        throw new \RuntimeException('Não foi possível gerar código de sala.');
    }

    private function roomKey(string $code): string
    {
        return 'friend_room:' . strtoupper($code);
    }

    private function getRoom(string $code): array
    {
        $room = Cache::get($this->roomKey($code));
        if (!is_array($room)) abort(404);
        return $room;
    }

    private function saveRoom(string $code, array $room): void
    {
        Cache::put(
            $this->roomKey($code),
            $room,
            now()->addHours(self::ROOM_TTL_HOURS)
        );
    }

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private function playerPayload($user): array
    {
        $name = (string) ($user->name ?? '');
        $name = trim($name);

        if ($name === '') {
            $name = (string) ($user->email ?? 'Usuário');
        }

        return [
            'id' => (int) $user->id,
            'name' => $name,
            'joinedAtMs' => $this->nowMs(),
            'score' => 0,
            'timeMs' => 0,
            'answers' => [],
        ];
    }
}
