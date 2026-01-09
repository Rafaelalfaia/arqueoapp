@extends('user.layouts.app')
@section('title','Quiz')
@section('topbar_title','Quiz')

@section('content')
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Quiz</div>
      <div class="mt-1 text-xl font-semibold">Modos de jogo</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Escolha um modo. O Treino já pode funcionar com perguntas aleatórias e recompensa em diamantes.
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Regras do Treino</div>
          <div class="mt-1 text-sm font-semibold">10 perguntas</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">1 minuto por questão</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Recompensa</div>
          <div class="mt-1 text-sm font-semibold text-wine">+5 diamantes</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">ao concluir as 10</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Áudio</div>
          <div class="mt-1 text-sm font-semibold">Música aleatória</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">public/musicas</div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <a href="{{ route('user.quiz.treino') }}"
         class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
        <div class="mt-1 text-lg font-semibold">Treino</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          10 perguntas aleatórias • 1 min por questão • +5 diamantes ao concluir.
        </p>

        <div class="mt-4 inline-flex items-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
          Começar
        </div>
      </a>

      <a href="{{ route('user.quiz.amizade.index') }}"
        class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
        <div class="mt-1 text-lg font-semibold">Amizade</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Entrar com código • 2+ jogadores • 5 diamantes cada • vencedor leva tudo.
        </p>
        </a>


      <a href="{{ route('user.quiz.torneio.index') }}"
        class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
        <div class="mt-1 text-lg font-semibold">Torneio</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Inscrições (especial) e auto-sala (comum) com premiação.
        </p>
        <div class="mt-4 inline-flex items-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Abrir
        </div>
        </a>

    </div>
  </div>
@endsection
