<?php

namespace App\Http\Controllers\Admin\Quiz;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Carbon;

class TournamentController extends Controller
{
    public function index()
    {
        $tournaments = Tournament::query()
            ->orderByDesc('created_at')
            ->paginate(20);

        return view('admin.quiz.torneios.index', compact('tournaments'));
    }

    public function create()
    {
        return view('admin.quiz.torneios.create');
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request, true);

        // IMPORTANTE: não tente persistir UploadedFile como coluna
        unset($data['cover']);

        // upload da capa (obrigatório na criação)
        $path = $request->file('cover')->store('tournaments/covers', 'public');

        try {
            $tournament = Tournament::create([
                ...$data,
                'cover_path' => $path,
                'created_by' => $request->user()->id,
                'status' => 'draft',
            ]);
        } catch (\Throwable $e) {
            // se falhar o insert, remove o arquivo que já foi enviado
            Storage::disk('public')->delete($path);
            throw $e;
        }

        return redirect()
            ->route('admin.quiz.torneios.edit', $tournament)
            ->with('success', 'Torneio criado.');
    }

    public function edit(Tournament $tournament)
    {
        return view('admin.quiz.torneios.edit', compact('tournament'));
    }

    public function update(Request $request, Tournament $tournament)
    {
        $data = $this->validateData($request, false);

        // IMPORTANTE: não tente persistir UploadedFile como coluna
        unset($data['cover']);

        // Troca de capa sem risco: salva nova -> salva no banco -> só então apaga antiga
        if ($request->hasFile('cover')) {
            $oldPath = $tournament->cover_path;
            $newPath = $request->file('cover')->store('tournaments/covers', 'public');

            try {
                $tournament->cover_path = $newPath;
                $tournament->fill($data)->save();
            } catch (\Throwable $e) {
                // se falhar o save, apaga a nova (não perde a antiga)
                Storage::disk('public')->delete($newPath);
                throw $e;
            }

            if ($oldPath) {
                Storage::disk('public')->delete($oldPath);
            }

            return back()->with('success', 'Torneio atualizado.');
        }

        $tournament->fill($data)->save();

        return back()->with('success', 'Torneio atualizado.');
    }

    public function publish(Tournament $tournament)
    {
        try {
            $this->assertPublishable($tournament);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $tournament->status = 'published';
        $tournament->published_at = now();
        $tournament->save();

        return back()->with('success', 'Torneio publicado.');
    }

    public function unpublish(Tournament $tournament)
    {
        $tournament->status = 'draft';
        $tournament->published_at = null;
        $tournament->save();

        return back()->with('success', 'Torneio voltou para rascunho.');
    }

    public function destroy(Tournament $tournament)
    {
        $coverPath = null;

        DB::transaction(function () use ($tournament, &$coverPath) {
            $coverPath = $tournament->cover_path;
            $tournament->delete(); // cascade (se existir) acontece aqui
        });

        if ($coverPath) {
            Storage::disk('public')->delete($coverPath);
        }

        return redirect()
            ->route('admin.quiz.torneios.index')
            ->with('success', 'Torneio excluído.');
    }

    public function bulkDestroy(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ]);

        $ids = array_values(array_unique($data['ids']));

        $coverPaths = [];
        $count = 0;

        DB::transaction(function () use ($ids, &$coverPaths, &$count) {
            $items = Tournament::query()->whereIn('id', $ids)->get();

            foreach ($items as $t) {
                if ($t->cover_path) {
                    $coverPaths[] = $t->cover_path;
                }
                $t->delete();
            }

            $count = $items->count();
        });

        // fora da transação (arquivo não “volta” em rollback)
        $coverPaths = array_values(array_unique($coverPaths));
        foreach ($coverPaths as $p) {
            Storage::disk('public')->delete($p);
        }

        return redirect()
            ->route('admin.quiz.torneios.index')
            ->with('success', "{$count} torneio(s) excluído(s).");
    }

    private function validateData(Request $request, bool $creating): array
    {
        $coverRules = $creating
            ? ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']
            : ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'];

        $rules = [
            'title' => ['required', 'string', 'max:120'],
            'type'  => ['required', Rule::in(['common', 'special'])],

            'entry_fee' => ['required', 'integer', 'min:0'],
            'question_count' => ['required', 'integer', 'min:5', 'max:100'],

            // COMUM (auto)
            'max_players' => ['required_if:type,common', 'nullable', 'integer', 'min:2', 'max:500'],
            'prize_pool_fixed' => ['required_if:type,common', 'nullable', 'integer', 'min:0'],

            // ESPECIAL (agendado)
            'scheduled_at' => ['required_if:type,special', 'nullable', 'date'],
            'special_multiplier' => ['required_if:type,special', 'nullable', 'integer', 'min:1', 'max:10'],

            'split_first' => ['required', 'integer', 'min:0', 'max:100'],
            'split_second' => ['required', 'integer', 'min:0', 'max:100'],
            'split_third' => ['required', 'integer', 'min:0', 'max:100'],

            'cover' => $coverRules,
        ];

        $data = $request->validate($rules);

        // Normalização por tipo (garante consistência)
        if (($data['type'] ?? null) === 'common') {
            $data['scheduled_at'] = null;
            $data['prize_pool_fixed'] = isset($data['prize_pool_fixed']) ? (int)$data['prize_pool_fixed'] : 0;
            $data['max_players'] = isset($data['max_players']) ? (int)$data['max_players'] : null;

            // mantém valor sempre numérico (evita problemas se coluna for NOT NULL)
            $data['special_multiplier'] = isset($data['special_multiplier']) && $data['special_multiplier'] !== null
                ? (int)$data['special_multiplier']
                : 1;
        }

        if (($data['type'] ?? null) === 'special') {
            $data['max_players'] = null;
            $data['prize_pool_fixed'] = null;

            // default defensivo
            $data['special_multiplier'] = isset($data['special_multiplier']) && $data['special_multiplier'] !== null
                ? (int)$data['special_multiplier']
                : 2;
        }

        // splits precisam fechar 100
        $sum = (int)$data['split_first'] + (int)$data['split_second'] + (int)$data['split_third'];
        if ($sum !== 100) {
            throw ValidationException::withMessages([
                'split_first' => 'A soma das porcentagens deve ser 100%.',
                'split_second' => 'A soma das porcentagens deve ser 100%.',
                'split_third' => 'A soma das porcentagens deve ser 100%.',
            ]);
        }

        return $data;
    }

    private function assertPublishable(Tournament $tournament): void
    {
        $errors = [];

        if (!is_string($tournament->title) || trim($tournament->title) === '') {
            $errors['title'] = 'Título é obrigatório.';
        }

        if (!in_array($tournament->type, ['common', 'special'], true)) {
            $errors['type'] = 'Tipo inválido.';
        }

        if (!is_string($tournament->cover_path) || trim($tournament->cover_path) === '') {
            $errors['cover'] = 'Envie uma capa antes de publicar.';
        }

        $qc = (int)($tournament->question_count ?? 0);
        if ($qc < 5 || $qc > 100) {
            $errors['question_count'] = 'Quantidade de perguntas deve estar entre 5 e 100.';
        }

        $sum = (int)($tournament->split_first ?? 0) + (int)($tournament->split_second ?? 0) + (int)($tournament->split_third ?? 0);
        if ($sum !== 100) {
            $errors['split_first'] = 'A soma das porcentagens deve ser 100%.';
            $errors['split_second'] = 'A soma das porcentagens deve ser 100%.';
            $errors['split_third'] = 'A soma das porcentagens deve ser 100%.';
        }

        if ($tournament->type === 'common') {
            $mp = $tournament->max_players;
            $pf = $tournament->prize_pool_fixed;

            if ($mp === null || (int)$mp < 2) {
                $errors['max_players'] = 'No torneio comum, max_players é obrigatório (mínimo 2).';
            }
            if ($pf === null || (int)$pf < 0) {
                $errors['prize_pool_fixed'] = 'No torneio comum, prize_pool_fixed é obrigatório (mínimo 0).';
            }
        }

        if ($tournament->type === 'special') {
            if (!$tournament->scheduled_at) {
                $errors['scheduled_at'] = 'No torneio especial, scheduled_at é obrigatório.';
            } else {
                try {
                    $dt = Carbon::parse($tournament->scheduled_at);
                    if ($dt->lt(now())) {
                        $errors['scheduled_at'] = 'No torneio especial, a data/hora deve estar no futuro.';
                    }
                } catch (\Throwable $e) {
                    $errors['scheduled_at'] = 'Data/Hora inválida.';
                }
            }

            $sm = (int)($tournament->special_multiplier ?? 0);
            if ($sm < 1 || $sm > 10) {
                $errors['special_multiplier'] = 'No torneio especial, special_multiplier deve estar entre 1 e 10.';
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }
}
