@php
  $isEdit = isset($tournament) && $tournament;
  $typeValue = old('type', $isEdit ? $tournament->type : 'common');

  $scheduledValue = old('scheduled_at');
  if (!$scheduledValue && $isEdit && $tournament->scheduled_at) {
    try { $scheduledValue = \Illuminate\Support\Carbon::parse($tournament->scheduled_at)->format('Y-m-d\TH:i'); }
    catch (\Throwable $e) { $scheduledValue = ''; }
  }

  $coverUrl = ($isEdit && $tournament->cover_path) ? asset('storage/'.$tournament->cover_path) : null;
@endphp

@if ($errors->any())
  <div class="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
    <div class="font-semibold">Corrija os campos abaixo:</div>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      @foreach ($errors->all() as $e)
        <li>{{ $e }}</li>
      @endforeach
    </ul>
  </div>
@endif

<div class="grid gap-4 lg:grid-cols-3">
  {{-- Coluna principal --}}
  <div class="lg:col-span-2 space-y-4">

    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm font-semibold">Dados</div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="text-sm font-semibold">Título</label>
          <input name="title" value="{{ old('title', $isEdit ? $tournament->title : '') }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 placeholder="Ex.: Torneio ArqueoApp #01" required />
        </div>

        <div>
          <label class="text-sm font-semibold">Tipo</label>
          <select id="tournament_type" name="type"
                  class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  required>
            <option value="common"  @selected($typeValue === 'common')>Comum (auto)</option>
            <option value="special" @selected($typeValue === 'special')>Especial (agendado)</option>
          </select>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Comum inicia automaticamente ao encher a sala; Especial abre no dia/hora.
          </p>
        </div>

        <div>
          <label class="text-sm font-semibold">Qtd. de perguntas</label>
          <input type="number" min="5" max="100" name="question_count"
                 value="{{ old('question_count', $isEdit ? $tournament->question_count : 10) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
        </div>
      </div>
    </div>

    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm font-semibold">Taxa e Premiação</div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="text-sm font-semibold">Taxa de inscrição (diamantes)</label>
          <input type="number" min="0" name="entry_fee"
                 value="{{ old('entry_fee', $isEdit ? $tournament->entry_fee : 0) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
        </div>

        <div id="field_prize_pool_fixed_wrap">
          <label class="text-sm font-semibold">Pool fixo (Comum)</label>
          <input type="number" min="0" name="prize_pool_fixed"
                 value="{{ old('prize_pool_fixed', $isEdit ? ($tournament->prize_pool_fixed ?? '') : '') }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 placeholder="Ex.: 5000" />
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            No Comum, o prêmio total é definido no Admin.
          </p>
        </div>

        <div id="field_scheduled_at_wrap">
          <label class="text-sm font-semibold">Data/Hora (Especial)</label>
          <input type="datetime-local" name="scheduled_at"
                 value="{{ $scheduledValue }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>

        <div id="field_special_multiplier_wrap">
          <label class="text-sm font-semibold">Multiplicador (Especial)</label>
          <input type="number" min="1" max="10" name="special_multiplier"
                 value="{{ old('special_multiplier', $isEdit ? ($tournament->special_multiplier ?? 2) : 2) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Especial: (taxa × inscritos) × multiplicador.
          </p>
        </div>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label class="text-sm font-semibold">1º lugar (%)</label>
          <input type="number" min="0" max="100" name="split_first"
                 value="{{ old('split_first', $isEdit ? $tournament->split_first : 50) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
        </div>
        <div>
          <label class="text-sm font-semibold">2º lugar (%)</label>
          <input type="number" min="0" max="100" name="split_second"
                 value="{{ old('split_second', $isEdit ? $tournament->split_second : 30) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
        </div>
        <div>
          <label class="text-sm font-semibold">3º lugar (%)</label>
          <input type="number" min="0" max="100" name="split_third"
                 value="{{ old('split_third', $isEdit ? $tournament->split_third : 20) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 required />
        </div>
      </div>
    </div>

    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm font-semibold">Regras por tipo</div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div id="field_max_players_wrap">
          <label class="text-sm font-semibold">Máx. jogadores (Comum)</label>
          <input type="number" min="2" max="500" name="max_players"
                 value="{{ old('max_players', $isEdit ? ($tournament->max_players ?? '') : '') }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                 placeholder="Ex.: 10" />
        </div>

        <div class="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          <div class="font-semibold">Distribuição</div>
          <div class="mt-2 text-sm">
            1º: 50% • 2º: 30% • 3º: 20%
          </div>
          <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            O sistema vai validar soma = 100%.
          </div>
        </div>
      </div>
    </div>

  </div>

  {{-- Coluna lateral --}}
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm font-semibold">Capa</div>

      @if ($coverUrl)
        <div class="mt-4 overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <img id="cover_preview" src="{{ $coverUrl }}" class="h-44 w-full object-cover" alt="Capa do torneio" />
        </div>
      @else
        <div class="mt-4 flex h-44 items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Prévia da capa
        </div>
        <img id="cover_preview" class="mt-4 hidden h-44 w-full rounded-3xl object-cover" alt="Capa do torneio" />
      @endif

      <div class="mt-4">
        <label class="text-sm font-semibold">
          {{ $isEdit ? 'Trocar capa (opcional)' : 'Enviar capa (obrigatório)' }}
        </label>
        <input id="cover_input" type="file" name="cover" accept="image/*"
               class="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
               {{ $isEdit ? '' : 'required' }} />
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">JPG/PNG/WEBP até 2MB.</p>
      </div>
    </div>

    @if($isEdit)
      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm font-semibold">Status</div>
        <div class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Atual: <span class="font-semibold">{{ strtoupper($tournament->status ?? 'draft') }}</span>
        </div>
        @if($tournament->published_at)
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Publicado em {{ \Illuminate\Support\Carbon::parse($tournament->published_at)->format('d/m/Y H:i') }}
          </div>
        @endif
      </div>
    @endif

  </div>
</div>

{{-- JS: preview da capa + toggle por tipo --}}
<script>
  (function () {
    const typeEl = document.getElementById('tournament_type');
    const coverInput = document.getElementById('cover_input');
    const coverPreview = document.getElementById('cover_preview');

    const wrapPrizeFixed = document.getElementById('field_prize_pool_fixed_wrap');
    const wrapMaxPlayers = document.getElementById('field_max_players_wrap');
    const wrapScheduled  = document.getElementById('field_scheduled_at_wrap');
    const wrapMult       = document.getElementById('field_special_multiplier_wrap');

    const inpPrizeFixed = document.querySelector('[name="prize_pool_fixed"]');
    const inpMaxPlayers = document.querySelector('[name="max_players"]');
    const inpScheduled  = document.querySelector('[name="scheduled_at"]');
    const inpMult       = document.querySelector('[name="special_multiplier"]');

    function setFieldState(input, enabled, required) {
      if (!input) return;
      input.disabled = !enabled;
      input.required = !!required;
      if (!enabled) input.value = '';
    }

    function applyType() {
      const type = typeEl ? typeEl.value : 'common';
      const isCommon = type === 'common';

      // visual
      if (wrapPrizeFixed) wrapPrizeFixed.style.display = isCommon ? '' : 'none';
      if (wrapMaxPlayers) wrapMaxPlayers.style.display = isCommon ? '' : 'none';
      if (wrapScheduled)  wrapScheduled.style.display  = isCommon ? 'none' : '';
      if (wrapMult)       wrapMult.style.display       = isCommon ? 'none' : '';

      // comportamento + validação HTML
      setFieldState(inpPrizeFixed, isCommon, isCommon);
      setFieldState(inpMaxPlayers, isCommon, isCommon);
      setFieldState(inpScheduled, !isCommon, !isCommon);
      setFieldState(inpMult, !isCommon, !isCommon);

      // defaults úteis
      if (!isCommon && inpMult && !inpMult.value) inpMult.value = '2';
    }

    if (typeEl) {
      typeEl.addEventListener('change', applyType);
      applyType();
    }

    if (coverInput && coverPreview) {
      coverInput.addEventListener('change', () => {
        const file = coverInput.files && coverInput.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        coverPreview.src = url;
        coverPreview.classList.remove('hidden');

        // libera memória depois (não é crítico, mas é correto)
        coverPreview.onload = () => URL.revokeObjectURL(url);
      });
    }
  })();
</script>

