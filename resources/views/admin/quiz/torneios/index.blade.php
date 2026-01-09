@extends('admin.layouts.app')
@section('title','Torneios')

@section('content')
@php
  $fmt = fn($n) => number_format((int)$n, 0, ',', '.');
  $badge = function(string $text, string $tone) {
    $map = [
      'gray'  => 'bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200',
      'wine'  => 'bg-wine/10 text-wine dark:bg-wine/15 dark:text-rose-200',
      'green' => 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
      'amber' => 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
      'red'   => 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    ];
    $cls = $map[$tone] ?? $map['gray'];
    return '<span class="inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold '.$cls.'">'.e($text).'</span>';
  };
@endphp

<div class="space-y-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Admin / Quiz</div>
      <h1 class="mt-1 text-xl font-semibold">Torneios</h1>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Crie torneios comuns (auto) e especiais (agendados), com capa e regras de premiação.
      </p>
    </div>

    <a href="{{ route('admin.quiz.torneios.create') }}"
       class="inline-flex items-center justify-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
      Novo Torneio
    </a>
  </div>

  {{-- Barra de ações em lote --}}
  <div id="bulkBar"
       class="hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="text-sm text-zinc-700 dark:text-zinc-200">
        Selecionados: <span id="bulkCount" class="font-semibold">0</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" id="bulkDeleteBtn"
          class="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700">
          Excluir selecionados
        </button>
      </div>
    </div>

    {{-- form invisível para exclusão em lote --}}
    <form id="bulkDeleteForm" method="POST" action="{{ route('admin.quiz.torneios.bulkDestroy') }}" class="hidden">
      @csrf
      @method('DELETE')
    </form>
  </div>

  <div class="rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-center justify-between gap-3 px-5 py-4">
      <div>
        <div class="text-sm font-semibold">Lista</div>
        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {{ $tournaments->total() }} torneio(s)
        </div>
      </div>

      <label class="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input id="selectAll" type="checkbox"
               class="h-4 w-4 rounded border-zinc-300 text-wine focus:ring-wine/40 dark:border-zinc-700 dark:bg-zinc-950" />
        Marcar todos
      </label>
    </div>

    <div class="border-t border-zinc-200 dark:border-zinc-800">
      @if ($tournaments->count() === 0)
        <div class="px-5 py-10 text-center">
          <div class="text-sm text-zinc-500 dark:text-zinc-400">Nenhum torneio criado ainda.</div>
          <a class="mt-4 inline-flex rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white"
             href="{{ route('admin.quiz.torneios.create') }}">
            Criar primeiro torneio
          </a>
        </div>
      @else
        <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
          @foreach ($tournaments as $t)
            @php
              $typeLabel = $t->type === 'special' ? 'Especial' : 'Comum';
              $status = $t->status ?? 'draft';
              $statusTone = match($status) {
                'published' => 'green',
                'running'   => 'amber',
                'finished'  => 'gray',
                'cancelled' => 'red',
                default     => 'gray',
              };

              $coverUrl = $t->cover_path ? asset('storage/'.$t->cover_path) : null;

              $prize = $t->type === 'common'
                ? ('Pool fixo: '.$fmt($t->prize_pool_fixed ?? 0).' diamantes')
                : ('Dinâmico: (taxa × inscritos) × '.((int)($t->special_multiplier ?? 2)));
            @endphp

            <div class="px-5 py-4">
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="flex items-center gap-4">
                  {{-- checkbox --}}
                  <input type="checkbox"
                         value="{{ $t->id }}"
                         data-tournament-check
                         class="h-4 w-4 rounded border-zinc-300 text-wine focus:ring-wine/40 dark:border-zinc-700 dark:bg-zinc-950" />

                  <div class="h-14 w-14 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                    @if($coverUrl)
                      <img src="{{ $coverUrl }}" alt="Capa" class="h-full w-full object-cover" />
                    @else
                      <div class="flex h-full w-full items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
                        sem capa
                      </div>
                    @endif
                  </div>

                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <div class="truncate text-base font-semibold">{{ $t->title }}</div>
                      {!! $badge($typeLabel, $t->type === 'special' ? 'wine' : 'gray') !!}
                      {!! $badge(strtoupper($status), $statusTone) !!}
                    </div>

                    <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Taxa: <span class="font-semibold">{{ $fmt($t->entry_fee ?? 0) }}</span> diamantes
                      <span class="text-zinc-400 dark:text-zinc-500">•</span>
                      <span>{{ $prize }}</span>
                    </div>

                    <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      @if($t->type === 'special' && $t->scheduled_at)
                        Agendado: {{ \Illuminate\Support\Carbon::parse($t->scheduled_at)->format('d/m/Y H:i') }}
                      @elseif($t->type === 'common' && $t->max_players)
                        Máx. jogadores: {{ (int)$t->max_players }}
                      @else
                        —
                      @endif
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <a href="{{ route('admin.quiz.torneios.edit', $t) }}"
                     class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    Editar
                  </a>

                  @if(($t->status ?? 'draft') === 'published')
                    <form method="POST" action="{{ route('admin.quiz.torneios.unpublish', $t) }}">
                      @csrf
                      <button type="submit"
                        class="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
                        Voltar p/ rascunho
                      </button>
                    </form>
                  @else
                    <form method="POST" action="{{ route('admin.quiz.torneios.publish', $t) }}">
                      @csrf
                      <button type="submit"
                        class="inline-flex items-center justify-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
                        Publicar
                      </button>
                    </form>
                  @endif

                  {{-- excluir individual --}}
                  <form method="POST" action="{{ route('admin.quiz.torneios.destroy', $t) }}"
                        onsubmit="return confirm('Excluir este torneio? Essa ação não pode ser desfeita.');">
                    @csrf
                    @method('DELETE')
                    <button type="submit"
                      class="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50">
                      Excluir
                    </button>
                  </form>

                </div>
              </div>
            </div>
          @endforeach
        </div>
      @endif
    </div>

    @if ($tournaments->hasPages())
      <div class="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        {{ $tournaments->links() }}
      </div>
    @endif
  </div>
</div>

<script>
  (function () {
    const checks = Array.from(document.querySelectorAll('[data-tournament-check]'));
    const bulkBar = document.getElementById('bulkBar');
    const bulkCount = document.getElementById('bulkCount');
    const bulkBtn = document.getElementById('bulkDeleteBtn');
    const bulkForm = document.getElementById('bulkDeleteForm');
    const selectAll = document.getElementById('selectAll');

    function selectedIds() {
      return checks.filter(c => c.checked).map(c => c.value);
    }

    function sync() {
      const ids = selectedIds();
      if (ids.length) {
        bulkBar.classList.remove('hidden');
        bulkCount.textContent = String(ids.length);
      } else {
        bulkBar.classList.add('hidden');
        bulkCount.textContent = '0';
      }

      if (selectAll) {
        selectAll.checked = checks.length > 0 && checks.every(c => c.checked);
        selectAll.indeterminate = checks.some(c => c.checked) && !checks.every(c => c.checked);
      }
    }

    checks.forEach(c => c.addEventListener('change', sync));

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        checks.forEach(c => (c.checked = selectAll.checked));
        sync();
      });
    }

    if (bulkBtn && bulkForm) {
      bulkBtn.addEventListener('click', () => {
        const ids = selectedIds();
        if (!ids.length) return;

        if (!confirm(`Excluir ${ids.length} torneio(s)? Essa ação não pode ser desfeita.`)) return;

        // remove ids antigos
        bulkForm.querySelectorAll('input[name="ids[]"]').forEach(i => i.remove());

        // cria ids[] dinamicamente
        ids.forEach(id => {
          const inp = document.createElement('input');
          inp.type = 'hidden';
          inp.name = 'ids[]';
          inp.value = id;
          bulkForm.appendChild(inp);
        });

        bulkForm.submit();
      });
    }

    sync();
  })();
</script>
@endsection
