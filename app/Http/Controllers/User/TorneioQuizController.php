<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use App\Models\TournamentEntry;
use App\Models\TournamentResult;
use App\Services\DiamondWalletService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TorneioQuizController extends Controller
{
    private const SECONDS_PER_Q = 60;
    private const JOIN_TOLERANCE_MINUTES = 10;

    private function sessionKey(int $tournamentId): string
    {
        return "tournament_play_{$tournamentId}";
    }

    public function index(Request $request)
    {
        $userId = (int) $request->user()->id;

        $tournaments = Tournament::query()
            ->whereIn('status', ['published', 'running'])
            ->orderByRaw("CASE WHEN type = 'special' THEN 0 ELSE 1 END") // especiais primeiro
            ->orderBy('scheduled_at')
            ->orderByDesc('created_at')
            ->withCount('entries')
            ->with(['entries' => fn($q) => $q->where('user_id', $userId)])
            ->paginate(20);

        return view('user.quiz.torneio.index', compact('tournaments'));
    }

    public function show(Request $request, Tournament $tournament)
    {
        $entry = TournamentEntry::query()
            ->where('tournament_id', $tournament->id)
            ->where('user_id', $request->user()->id)
            ->first();

        $entriesCount = (int) TournamentEntry::query()
            ->where('tournament_id', $tournament->id)
            ->count();

        return view('user.quiz.torneio.show', compact('tournament', 'entry', 'entriesCount'));
    }

    public function enroll(Request $request, Tournament $tournament, \App\Services\DiamondWalletService $wallet)
    {
        if ($tournament->type !== 'special') {
            return response()->json([
                'ok' => false,
                'message' => 'Inscrição é apenas para torneios especiais. No torneio comum, clique em Jogar.',
            ], 422);
        }

        if (!in_array($tournament->status, ['published', 'running'], true)) {
            return response()->json(['ok' => false, 'message' => 'Torneio indisponível.'], 422);
        }

        $user = $request->user();
        $fee = (int) ($tournament->entry_fee ?? 0);

        $entry = null;

        DB::transaction(function () use (&$entry, $user, $tournament, $fee, $wallet) {
            $entry = \App\Models\TournamentEntry::query()
                ->lockForUpdate()
                ->where('tournament_id', $tournament->id)
                ->where('user_id', $user->id)
                ->first();

            if (!$entry) {
                $entry = \App\Models\TournamentEntry::create([
                    'tournament_id' => $tournament->id,
                    'user_id' => $user->id,
                    'status' => 'enrolled',
                    'joined_at' => null,
                    'paid_tx_id' => null,
                ]);
            }

            if ($fee > 0 && $entry->paid_tx_id === null) {
                $tx = $wallet->debitEntry($user, $entry, $fee);
                $entry->paid_tx_id = $tx->id;
                $entry->save();
            }
        });

        return response()->json([
            'ok' => true,
            'enrolled' => true,
            'paid' => $fee > 0 ? ($entry?->paid_tx_id !== null) : true,
            'entry_fee' => $fee,
        ]);
    }

        public function play(Request $request, Tournament $tournament)
    {
        if ($tournament->type === 'special') {
            $entry = \App\Models\TournamentEntry::query()
                ->where('tournament_id', $tournament->id)
                ->where('user_id', $request->user()->id)
                ->first();

            if (!$entry) {
                return redirect()
                    ->route('user.quiz.torneio.show', $tournament)
                    ->with('error', 'Você precisa se inscrever antes.');
            }
        }

        return view('user.quiz.torneio.play', compact('tournament'));
    }


    public function start(Request $request, Tournament $tournament, \App\Services\DiamondWalletService $wallet)
{
    try {
        $user = $request->user();

        if (!in_array($tournament->status, ['published', 'running'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'Torneio indisponível.',
            ], 422);
        }

        $fee = (int) ($tournament->entry_fee ?? 0);

        // ============================================================
        // 1) Entry + regras (SPECIAL vs COMMON) + status running
        // ============================================================
        $entry = null;
        $waitingPayload = null;

        DB::transaction(function () use (
            &$entry,
            &$waitingPayload,
            $user,
            $tournament,
            $fee,
            $wallet
        ) {
            // lock do torneio (evita corrida ao virar running)
            $t = Tournament::query()->lockForUpdate()->findOrFail($tournament->id);

            // lock/cria entry
            $entry = \App\Models\TournamentEntry::query()
                ->lockForUpdate()
                ->where('tournament_id', $t->id)
                ->where('user_id', $user->id)
                ->first();

            // SPECIAL: exige entry prévia (inscrição)
            if ($t->type === 'special') {
                if (!$entry) {
                    throw new \RuntimeException('Você não está inscrito.');
                }

                if (!$t->scheduled_at) {
                    throw new \RuntimeException('Torneio especial sem data definida.');
                }

                // abre em scheduled_at e tolera 10min para o primeiro "join"
                $now = now();
                $open = $t->scheduled_at;
                $close = $t->scheduled_at->copy()->addMinutes(10);

                if ($now->lt($open)) {
                    throw new \RuntimeException('Ainda não chegou o horário do torneio.');
                }
                if ($now->gt($close) && empty($entry->joined_at)) {
                    throw new \RuntimeException('Janela de entrada encerrada (10 minutos).');
                }

                // lazy-start: published -> running quando chega a hora
                if ($t->status === 'published' && $now->greaterThanOrEqualTo($open)) {
                    $t->status = 'running';
                    $t->save();
                }

                if ($t->status !== 'running') {
                    throw new \RuntimeException('Torneio ainda não está em execução.');
                }

                // SPECIAL: se tem taxa, deve estar paga no enroll
                if ($fee > 0 && $entry->paid_tx_id === null) {
                    throw new \RuntimeException('Inscrição não confirmada (pagamento pendente).');
                }
            }

            // COMMON: não tem "inscrição"; entra via start
            if ($t->type === 'common') {
                if (!$entry) {
                    $entry = \App\Models\TournamentEntry::create([
                        'tournament_id' => $t->id,
                        'user_id'       => $user->id,
                        'status'        => 'enrolled',
                        'joined_at'     => null,
                        'paid_tx_id'    => null,
                    ]);
                }

                // se ainda published, tenta virar running ao atingir max_players
                if ($t->status === 'published') {
                    $max = (int) ($t->max_players ?? 0);
                    if ($max < 2) {
                        throw new \RuntimeException('Torneio comum sem max_players válido.');
                    }

                    $count = (int) \App\Models\TournamentEntry::query()
                        ->where('tournament_id', $t->id)
                        ->count();

                    if ($count >= $max) {
                        $t->status = 'running';
                        $t->save();
                    } else {
                        // Ainda não começou: não cobra e retorna payload de espera
                        $waitingPayload = [
                            'ok' => false,
                            'waiting' => true,
                            'message' => "Aguardando jogadores ({$count}/{$max}).",
                        ];
                        return;
                    }
                }

                // agora precisa estar running
                if ($t->status !== 'running') {
                    throw new \RuntimeException('Torneio ainda não está em execução.');
                }

                // COMMON: cobra somente quando realmente for iniciar (running)
                if ($fee > 0 && $entry->paid_tx_id === null) {
                    $tx = $wallet->debitEntry($user, $entry, $fee);
                    $entry->paid_tx_id = $tx->id;
                    $entry->save();
                }
            }

            if ($entry->status === 'finished') {
                throw new \RuntimeException('Você já finalizou este torneio.');
            }

            // marca join/status
            if (!$entry->joined_at) {
                $entry->joined_at = now();
            }
            $entry->status = 'in_progress';
            $entry->save();
        });

        // Se ficou aguardando players (COMMON), retorna aqui
        if (is_array($waitingPayload)) {
            return response()->json($waitingPayload, 422);
        }

        // ============================================================
        // 2) Resumo/retomada de sessão (evita “perdi a partida” ao reload)
        // ============================================================
        $key = $this->sessionKey((int) $tournament->id);
        $state = session($key);

        $model = $this->questionModel();
        $seconds = self::SECONDS_PER_Q;
        $need = max(5, (int) ($tournament->question_count ?? 10));

        if (is_array($state) && isset($state['ids'], $state['i']) && is_array($state['ids'])) {
            $i = (int) $state['i'];
            $ids = $state['ids'];

            if (isset($ids[$i])) {
                $currentId = (int) $ids[$i];
                $q = $model::query()->find($currentId);

                if ($q) {
                    return response()->json([
                        'ok' => true,
                        'resumed' => true,
                        'total' => (int)($state['total'] ?? $need),
                        'seconds' => (int)($state['seconds'] ?? $seconds),
                        'question' => $this->serializeQuestion($q),
                        'progress' => [
                            'index' => $i + 1,
                            'total' => (int)($state['total'] ?? $need),
                        ],
                    ]);
                }
            }

            // estado inválido, limpa e recria
            session()->forget($key);
        }

        // ============================================================
        // 3) Selecionar perguntas (mesma fonte do Treino, determinístico)
        // ============================================================
        $table = (new $model())->getTable();
        $query = $model::query();

        if (Schema::hasColumn($table, 'status')) {
            $query->where('status', 'published');
        } elseif (Schema::hasColumn($table, 'published')) {
            $query->where('published', true);
        } elseif (Schema::hasColumn($table, 'is_published')) {
            $query->where('is_published', true);
        } elseif (Schema::hasColumn($table, 'published_at')) {
            $query->whereNotNull('published_at');
        }

        $ids = $this->pickDeterministicValidQuestionIds($query, $need, (string) $tournament->id);

        if (count($ids) < $need) {
            return response()->json([
                'ok' => false,
                'message' => "Banco de questões insuficiente: " . count($ids) . "/{$need} (publicadas e válidas).",
            ], 422);
        }

        $state = [
            'ids' => array_values($ids),
            'i' => 0,
            'correct' => 0,
            'started_at_ms' => (int) floor(microtime(true) * 1000),
            'q_started_at' => now()->timestamp,
            'seconds' => $seconds,
            'total' => $need,
        ];

        session([$key => $state]);

        $first = $model::query()->findOrFail((int) $ids[0]);

        return response()->json([
            'ok' => true,
            'total' => $need,
            'seconds' => $seconds,
            'question' => $this->serializeQuestion($first),
            'progress' => ['index' => 1, 'total' => $need],
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'ok' => false,
            'message' => $e->getMessage(),
        ], 422);
    }
}

    public function answer(Request $request, Tournament $tournament)
    {
        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'choice' => ['nullable', 'regex:/^[A-Ea-e]$/'],
        ]);

        $key = $this->sessionKey($tournament->id);
        $state = session($key);

        if (!is_array($state) || empty($state['ids']) || !isset($state['i'])) {
            return response()->json(['ok' => false, 'message' => 'Jogo não iniciado.'], 422);
        }

        $i = (int) $state['i'];
        $ids = $state['ids'];

        if (!isset($ids[$i])) {
            return response()->json(['ok' => false, 'message' => 'Partida já finalizada.'], 422);
        }

        $currentId = (int) $ids[$i];
        if ((int)$data['question_id'] !== $currentId) {
            return response()->json(['ok' => false, 'message' => 'Questão inválida (fora de ordem).'], 422);
        }

        $seconds = (int) ($state['seconds'] ?? self::SECONDS_PER_Q);
        $qStarted = (int) ($state['q_started_at'] ?? now()->timestamp);
        $elapsed = now()->timestamp - $qStarted;

        $model = $this->questionModel();
        $question = $model::query()->findOrFail($currentId);

        $timedOut = ($elapsed > $seconds);
        $choice = $timedOut ? null : (isset($data['choice']) ? strtoupper((string)$data['choice']) : null);

        $correctChoice = $this->getCorrectChoice($question);
        $isCorrect = $this->checkAnswer($question, $choice);

        if ($isCorrect) {
            $state['correct'] = ((int)$state['correct']) + 1;
        }

        $state['i'] = $i + 1;
        $state['q_started_at'] = now()->timestamp;

        $finished = !isset($ids[$state['i']]);

        $lastPayload = [
            'isCorrect' => (bool) $isCorrect,
            'correctChoice' => $correctChoice,
            'choice' => $choice,
            'timedOut' => (bool) $timedOut,
        ];

        if ($finished) {
            $startedAtMs = (int) ($state['started_at_ms'] ?? (int) floor(microtime(true) * 1000));
            $timeMs = (int) floor(microtime(true) * 1000) - $startedAtMs;
            if ($timeMs < 0) $timeMs = 0;

            $correct = (int) ($state['correct'] ?? 0);

            // Score simples: prioriza acertos, desempata por tempo
            $score = ($correct * 1000000) - $timeMs;
            if ($score < 0) $score = 0;

            // salva result + fecha entry
            DB::transaction(function () use ($request, $tournament, $correct, $timeMs, $score) {
                TournamentResult::query()->updateOrCreate(
                    ['tournament_id' => $tournament->id, 'user_id' => $request->user()->id],
                    ['correct_count' => $correct, 'time_ms' => $timeMs, 'score' => $score]
                );

                TournamentEntry::query()
                    ->where('tournament_id', $tournament->id)
                    ->where('user_id', $request->user()->id)
                    ->update(['status' => 'finished']);
            });

            session()->forget($key);

            return response()->json([
                'ok' => true,
                'finished' => true,
                'correct' => $correct,
                'total' => (int) ($state['total'] ?? count($ids)),
                'time_ms' => $timeMs,
                'score' => $score,
                'last' => $lastPayload,
            ]);
        }

        session([$key => $state]);

        $nextId = (int) $ids[$state['i']];
        $nextQuestion = $model::query()->findOrFail($nextId);

        return response()->json([
            'ok' => true,
            'finished' => false,
            'last' => $lastPayload,
            'question' => $this->serializeQuestion($nextQuestion),
            'progress' => ['index' => ((int)$state['i']) + 1, 'total' => (int) ($state['total'] ?? count($ids))],
            'seconds' => $seconds,
        ]);
    }

    public function reset(Request $request, Tournament $tournament)
    {
        session()->forget($this->sessionKey($tournament->id));
        return response()->json(['ok' => true]);
    }

    // ============================================================
    // Mesma lógica do Treino para achar o model e validar questão
    // ============================================================

    private function questionModel(): string
    {
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

    private function serializeQuestion($q): array
    {
        return [
            'id' => (int) $q->id,
            'text' => (string) ($q->question ?? $q->text ?? $q->titulo ?? ''),
            'choices' => $this->extractChoices($q),
        ];
    }

    private function extractChoices($q): array
    {
        if (isset($q->choices) && is_array($q->choices)) {
            $letters = ['A','B','C','D','E'];
            $out = ['A'=>'','B'=>'','C'=>'','D'=>'','E'=>''];
            foreach ($letters as $idx => $L) {
                $out[$L] = (string) ($q->choices[$idx] ?? '');
            }
            return $out;
        }

        $map = [
            'A' => ['option_a', 'choice_a', 'a'],
            'B' => ['option_b', 'choice_b', 'b'],
            'C' => ['option_c', 'choice_c', 'c'],
            'D' => ['option_d', 'choice_d', 'd'],
            'E' => ['option_e', 'choice_e', 'e'],
        ];

        $out = ['A'=>'','B'=>'','C'=>'','D'=>'','E'=>''];

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
        if (isset($q->correct_option) && is_string($q->correct_option)) return strtoupper($q->correct_option);
        if (isset($q->correct_choice) && is_string($q->correct_choice)) return strtoupper($q->correct_choice);
        if (isset($q->correct) && is_string($q->correct)) return strtoupper($q->correct);
        if (isset($q->correct_index)) {
            $idx = (int) $q->correct_index;
            $letters = ['A','B','C','D','E'];
            return $letters[$idx] ?? null;
        }
        return null;
    }

    private function checkAnswer($q, ?string $choice): bool
    {
        if ($choice === null) return false;
        $correct = $this->getCorrectChoice($q);
        if (!$correct) return false;
        return strtoupper($choice) === strtoupper($correct);
    }

    private function isQuestionValid($q): bool
    {
        $text = (string) ($q->question ?? $q->text ?? $q->titulo ?? '');
        if (trim($text) === '') return false;

        $choices = $this->extractChoices($q);
        foreach (['A','B','C','D','E'] as $L) {
            if (!isset($choices[$L]) || trim((string)$choices[$L]) === '') return false;
        }

        $correct = $this->getCorrectChoice($q);
        if (!$correct) return false;

        $correct = strtoupper($correct);
        return in_array($correct, ['A','B','C','D','E'], true);
    }

    private function pickDeterministicValidQuestionIds($query, int $n, string $seed): array
    {
        $driver = DB::getDriverName();
        $seedExpr = null;

        // Seu projeto já dá sinais de PostgreSQL (ALTER COLUMN), então priorizo PG.
        if ($driver === 'pgsql') {
            $seedExpr = "md5(CAST(id AS text) || ?)";
        } else {
            // fallback comum
            $seedExpr = "MD5(CONCAT(id, ?))";
        }

        $rows = (clone $query)
            ->orderByRaw($seedExpr, [$seed])
            ->limit(max(300, $n * 50))
            ->get();

        $out = [];
        foreach ($rows as $row) {
            if ($this->isQuestionValid($row)) {
                $out[] = (int) $row->id;
                if (count($out) >= $n) break;
            }
        }

        return $out;
    }
}
