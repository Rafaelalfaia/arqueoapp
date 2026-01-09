@extends('user.layouts.app')
@section('title','Quiz • Torneio')
@section('topbar_title','Torneio')

@section('content')
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
      <div class="mt-1 text-xl font-semibold">Torneios</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Inscreva-se e jogue quando o torneio estiver disponível. Perguntas vêm do mesmo banco do Quiz (publicadas).
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @forelse($tournaments as $t)
        @php
          $myEntry = $t->entries->first(); // filtrado no controller pelo user
          $enrolled = (bool) $myEntry;
          $isSpecial = $t->type === 'special';
          $isCommon  = $t->type === 'common';
          $coverUrl = asset('storage/'.$t->cover_path);
        @endphp

        <a href="{{ route('user.quiz.torneio.show', $t) }}"
           class="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
          <div class="h-36 w-full bg-zinc-100 dark:bg-zinc-800">
            <img src="{{ $coverUrl }}" alt="Capa" class="h-36 w-full object-cover">
          </div>

          <div class="p-5">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs text-zinc-500 dark:text-zinc-400">
                {{ $isSpecial ? 'Especial' : 'Comum' }} • {{ strtoupper($t->status) }}
              </div>
              @if($enrolled)
                <span class="inline-flex items-center rounded-2xl bg-wine/10 px-3 py-1 text-xs font-semibold text-wine dark:bg-wine/15 dark:text-rose-200">
                  Inscrito
                </span>
              @endif
            </div>

            <div class="mt-2 text-lg font-semibold">{{ $t->title }}</div>

            <div class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {{ (int)$t->question_count }} perguntas • Taxa: {{ (int)$t->entry_fee }} diamantes
              <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Participantes: {{ (int)$t->entries_count }}
                @if($isCommon && $t->max_players)
                  / {{ (int)$t->max_players }}
                @endif
              </div>
              @if($isSpecial && $t->scheduled_at)
                <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Horário: {{ $t->scheduled_at->format('d/m/Y H:i') }} (tolerância 10 min)
                </div>
              @endif
            </div>

            <div class="mt-4 inline-flex items-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Ver torneio
            </div>
          </div>
        </a>
      @empty
        <div class="rounded-3xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Nenhum torneio publicado no momento.
        </div>
      @endforelse
    </div>

    <div>
      {{ $tournaments->links() }}
    </div>
  </div>
@endsection
