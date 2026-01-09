@extends('user.layouts.app')
@section('title','Quiz • Torneio')
@section('topbar_title','Torneio')

@section('content')
@php
  $coverUrl = asset('storage/'.$tournament->cover_path);
  $enrolled = (bool) $entry;
@endphp

<div class="space-y-4">
  <div class="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="h-44 w-full bg-zinc-100 dark:bg-zinc-800">
      <img src="{{ $coverUrl }}" class="h-44 w-full object-cover" alt="Capa">
    </div>
    <div class="p-5">
      <div class="text-xs text-zinc-500 dark:text-zinc-400">
        {{ $tournament->type === 'special' ? 'Especial' : 'Comum' }} • {{ strtoupper($tournament->status) }}
      </div>
      <div class="mt-1 text-xl font-semibold">{{ $tournament->title }}</div>

      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Perguntas</div>
          <div class="mt-1 text-sm font-semibold">{{ (int)$tournament->question_count }}</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">60s por questão</div>
        </div>

        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Taxa</div>
          <div class="mt-1 text-sm font-semibold text-wine">{{ (int)$tournament->entry_fee }} diamantes</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Participantes: {{ (int)$entriesCount }}
          </div>
        </div>

        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Premiação</div>
          <div class="mt-1 text-sm font-semibold">{{ (int)$tournament->split_first }}% / {{ (int)$tournament->split_second }}% / {{ (int)$tournament->split_third }}%</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Top 3</div>
        </div>
      </div>

      @if($tournament->type === 'special' && $tournament->scheduled_at)
        <div class="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Início: <span class="font-semibold">{{ $tournament->scheduled_at->format('d/m/Y H:i') }}</span>
          <span class="text-xs text-zinc-500 dark:text-zinc-400">(tolerância 10 min)</span>
        </div>
      @endif

      <div class="mt-4 flex flex-wrap gap-2">
        @if($tournament->type === 'special')
            @if(!$enrolled)
            <button id="btnEnroll"
                class="inline-flex items-center justify-center rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
                Inscrever-se
            </button>
            @else
            <span class="inline-flex items-center rounded-2xl bg-wine/10 px-4 py-2 text-sm font-semibold text-wine dark:bg-wine/15 dark:text-rose-200">
                Você já está inscrito
            </span>
            @endif
        @else
            <span class="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm
                        dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            Torneio comum: entre para jogar (sem inscrição)
            </span>
        @endif

        <a href="{{ route('user.quiz.torneio.play', $tournament) }}"
            class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition
                dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
            Jogar
        </a>

        <a href="{{ route('user.quiz') }}"
            class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition
                dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
            Voltar ao Quiz
        </a>
        </div>


      <div id="enrollMsg" class="mt-3 hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"></div>
    </div>
  </div>
</div>

<script>
(function () {
  const btn = document.getElementById('btnEnroll');
  const msg = document.getElementById('enrollMsg');
  if (!btn) return;

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': "{{ csrf_token() }}",
        'Accept': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Erro.');
    return json;
  }

  btn.addEventListener('click', async () => {
    try {
      const data = await post("{{ route('user.quiz.torneio.enroll', $tournament) }}");
      msg.classList.remove('hidden');
      msg.textContent = `Inscrição OK. Taxa: ${data.entry_fee} diamantes.`;
      btn.disabled = true;
      btn.textContent = 'Inscrito';
      btn.classList.add('opacity-70');
    } catch (e) {
      msg.classList.remove('hidden');
      msg.textContent = e.message || 'Erro ao inscrever.';
    }
  });
})();
</script>
@endsection
