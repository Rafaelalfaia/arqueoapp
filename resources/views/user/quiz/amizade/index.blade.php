@extends('user.layouts.app')
@section('title','Quiz • Amizade')
@section('topbar_title','Amizade')

@section('content')
  @include('user.partials.flash')

  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
      <div class="mt-1 text-xl font-semibold">Amizade (Sincronizado por código)</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        2+ jogadores entram com o mesmo código. Ao iniciar, serão descontados <span class="font-semibold">5 diamantes</span> de cada um.
        O vencedor (maior acerto) leva <span class="font-semibold">tudo</span>.
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Saldo</div>
          <div class="mt-1 text-lg font-semibold text-wine">{{ $balance }}</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">diamantes</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Taxa</div>
          <div class="mt-1 text-lg font-semibold">{{ $minFee }}</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">por jogador</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Regras</div>
          <div class="mt-1 text-sm font-semibold">winner takes all</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">desempate por tempo</div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Sala</div>
        <div class="mt-1 text-lg font-semibold">Criar sala</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Você será o anfitrião e poderá iniciar quando houver 2+ jogadores.
        </p>

        <form method="POST" action="{{ route('user.quiz.amizade.create') }}" class="mt-4">
          @csrf
          <button type="submit"
            class="w-full rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
            Criar sala
          </button>
        </form>
      </div>

      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Sala</div>
        <div class="mt-1 text-lg font-semibold">Entrar com código</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Digite o código que seu amigo compartilhou.
        </p>

        <form method="POST" action="{{ route('user.quiz.amizade.join') }}" class="mt-4 space-y-3">
          @csrf
          <input name="code" required maxlength="10" placeholder="Ex: A1B2C3"
            class="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-wine/40
                   dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />

          <button type="submit"
            class="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm
                   hover:bg-zinc-50 active:scale-[0.99] transition
                   dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
            Entrar na sala
          </button>
        </form>
      </div>
    </div>
  </div>
@endsection
