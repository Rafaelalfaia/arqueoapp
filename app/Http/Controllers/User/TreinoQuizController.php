<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TreinoQuizController extends Controller
{
    private const SESSION_KEY = 'treino_quiz';
    private const TOTAL = 10;
    private const SECONDS_PER_Q = 60;
    private const REWARD_DIAMONDS = 5;

    public function index()
    {
        return view('user.quiz.treino.index');
    }

    public function start(Request $request)
    {
        $model = $this->questionModel();
        $table = (new $model())->getTable();

        $query = $model::query();

        // Publicação: no seu projeto Admin usa "status = published"
        if (Schema::hasColumn($table, 'status')) {
            $query->where('status', 'published');
        } elseif (Schema::hasColumn($table, 'published')) {
            $query->where('published', true);
        } elseif (Schema::hasColumn($table, 'is_published')) {
            $query->where('is_published', true);
        } elseif (Schema::hasColumn($table, 'published_at')) {
            $query->whereNotNull('published_at');
        }

        // Pega 10 IDs válidos (5 opções + correta)
        $ids = $this->pickValidQuestionIds($query, self::TOTAL);

        if (count($ids) < self::TOTAL) {
            return response()->json([
                'ok' => false,
                'message' => 'Banco de questões insuficiente para o treino (precisa de 10). Verifique se estão publicadas e com 5 opções + alternativa correta.',
            ], 422);
        }

        $state = [
            'ids' => array_values($ids),
            'i' => 0,
            'correct' => 0,
            'rewarded' => false,
            'q_started_at' => now()->timestamp,
        ];

        session([self::SESSION_KEY => $state]);

        $first = $model::query()->findOrFail((int) $ids[0]);

        return response()->json([
            'ok' => true,
            'total' => self::TOTAL,
            'seconds' => self::SECONDS_PER_Q,
            'question' => $this->serializeQuestion($first),
            'progress' => ['index' => 1, 'total' => self::TOTAL],
        ]);
    }

    public function answer(Request $request)
    {
        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'choice' => ['nullable', 'regex:/^[A-Ea-e]$/'], // A..E ou null
        ]);

        $state = session(self::SESSION_KEY);

        if (!is_array($state) || empty($state['ids']) || !isset($state['i'])) {
            return response()->json(['ok' => false, 'message' => 'Treino não iniciado.'], 422);
        }

        $i = (int) $state['i'];
        $ids = $state['ids'];

        if (!isset($ids[$i])) {
            return response()->json(['ok' => false, 'message' => 'Treino já finalizado.'], 422);
        }

        $currentId = (int) $ids[$i];

        if ((int)$data['question_id'] !== $currentId) {
            return response()->json(['ok' => false, 'message' => 'Questão inválida (fora de ordem).'], 422);
        }

        $qStarted = (int) ($state['q_started_at'] ?? now()->timestamp);
        $elapsed = now()->timestamp - $qStarted;

        $model = $this->questionModel();
        $question = $model::query()->findOrFail($currentId);

        // Se passou do tempo, força null
        $timedOut = ($elapsed > self::SECONDS_PER_Q);
        $choice = $timedOut ? null : (isset($data['choice']) ? strtoupper((string)$data['choice']) : null);

        $correctChoice = $this->getCorrectChoice($question);
        $isCorrect = $this->checkAnswer($question, $choice);

        if ($isCorrect) {
            $state['correct'] = ((int)$state['correct']) + 1;
        }

        // avança
        $state['i'] = $i + 1;
        $state['q_started_at'] = now()->timestamp;

        $finished = !isset($ids[$state['i']]);

        $reward = 0;
        $newBalance = null;

        if ($finished && empty($state['rewarded'])) {
            $state['rewarded'] = true;

            // 10 questões => precisa 6+ (mais que 50%)
            $qualified = ((int) $state['correct'] > (self::TOTAL / 2));

            if ($qualified) {
                $reward = self::REWARD_DIAMONDS;
                [$newBalance] = $this->creditDiamondsIfPossible($request, $reward);
            }
        }

        session([self::SESSION_KEY => $state]);

        $lastPayload = [
            'isCorrect' => (bool) $isCorrect,
            'correctChoice' => $correctChoice,
            'choice' => $choice,
            'timedOut' => (bool) $timedOut,
        ];

        if ($finished) {
            return response()->json([
                'ok' => true,
                'finished' => true,
                'correct' => (int) $state['correct'],
                'total' => self::TOTAL,
                'reward' => $reward,
                'balance' => $newBalance,
                'minCorrectForReward' => (int) floor(self::TOTAL / 2) + 1,
                'qualifiedForReward' => ((int) $state['correct'] > (self::TOTAL / 2)),
                'last' => $lastPayload,
            ]);
        }

        $nextId = (int) $ids[$state['i']];
        $nextQuestion = $model::query()->findOrFail($nextId);

        return response()->json([
            'ok' => true,
            'finished' => false,
            'last' => $lastPayload,
            'question' => $this->serializeQuestion($nextQuestion),
            'progress' => ['index' => ((int)$state['i']) + 1, 'total' => self::TOTAL],
            'seconds' => self::SECONDS_PER_Q,
        ]);
    }

    public function reset()
    {
        session()->forget(self::SESSION_KEY);
        return response()->json(['ok' => true]);
    }

    // ============================================================
    // Seleção de questões válidas (5 opções + correta + texto)
    // ============================================================

    private function pickValidQuestionIds($query, int $n): array
    {
        $out = [];
        $used = [];

        $maxTries = 8;

        for ($t = 0; $t < $maxTries && count($out) < $n; $t++) {
            $batch = (clone $query)
                ->when(!empty($used), fn($qq) => $qq->whereNotIn('id', $used))
                ->inRandomOrder()
                ->limit(max(30, $n * 4))
                ->get();

            if ($batch->isEmpty()) break;

            foreach ($batch as $row) {
                $used[] = (int) $row->id;

                if ($this->isQuestionValid($row)) {
                    $out[] = (int) $row->id;
                    if (count($out) >= $n) break;
                }
            }
        }

        return array_slice($out, 0, $n);
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

    // ============================================================
    // Model + serialização + validação
    // ============================================================

    private function questionModel(): string
    {
        // No seu projeto Admin usa App\Models\QuizQuestion
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

        throw new \RuntimeException(
            'Model de perguntas não encontrado. Ajuste questionModel() para o nome correto do Model (ex.: App\\Models\\QuizQuestion).'
        );
    }

    private function serializeQuestion($q): array
    {
        return [
            'id' => (int) $q->id,
            'text' => (string) ($q->question ?? $q->text ?? $q->titulo ?? ''),
            'choices' => $this->extractChoices($q), // sempre A..E
        ];
    }

    private function extractChoices($q): array
    {
        // Caso exista um array "choices"
        if (isset($q->choices) && is_array($q->choices)) {
            $letters = ['A','B','C','D','E'];
            $out = ['A'=>'','B'=>'','C'=>'','D'=>'','E'=>''];
            foreach ($letters as $idx => $L) {
                $out[$L] = (string) ($q->choices[$idx] ?? '');
            }
            return $out;
        }

        // Seu model real usa option_a..option_e
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
        // seu Admin usa correct_option
        if (isset($q->correct_option) && is_string($q->correct_option)) {
            return strtoupper($q->correct_option);
        }

        // padrões antigos/alternativos
        if (isset($q->correct_choice) && is_string($q->correct_choice)) {
            return strtoupper($q->correct_choice);
        }
        if (isset($q->correct) && is_string($q->correct)) {
            return strtoupper($q->correct);
        }
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

    // ============================================================
    // Prêmio (diamonds)
    // ============================================================

    private function creditDiamondsIfPossible(Request $request, int $reward): array
    {
        $cols = ['diamonds_balance', 'diamonds', 'diamantes', 'saldo_diamantes'];

        foreach ($cols as $col) {
            if (Schema::hasColumn('users', $col)) {
                $newBalance = null;

                DB::transaction(function () use ($request, $reward, $col, &$newBalance) {
                    $u = $request->user()->fresh();
                    $u = $u->newQuery()->lockForUpdate()->findOrFail($u->id);

                    $before = (int) ($u->{$col} ?? 0);
                    $after = $before + $reward;

                    $u->{$col} = $after;
                    $u->save();

                    $newBalance = $after;
                });

                return [$newBalance];
            }
        }

        // fallback provisório em session (sem migrations)
        $sessionKey = 'diamonds_balance_session';
        $before = (int) session($sessionKey, 0);
        $after = $before + $reward;
        session([$sessionKey => $after]);

        return [$after];
    }
}
