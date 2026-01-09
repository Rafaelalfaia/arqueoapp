@extends('admin.layouts.app')
@section('title','Dashboard')

@section('content')
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Status do Console</div>
      <div class="mt-1 text-xl font-semibold">Layout do Admin ativo</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Esta tela é apenas demonstrativa (sem migrations). Próximo passo: estruturar Quiz e Tradução com módulos reais.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <span class="inline-flex items-center rounded-2xl bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          Modo claro/escuro
        </span>
        <span class="inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold text-white bg-wine">
          Destaque vinho
        </span>
        <span class="inline-flex items-center rounded-2xl bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          Menu estilo app
        </span>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Quiz</div>
        <div class="mt-1 text-lg font-semibold">Pronto para estruturar</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Categoria → Pergunta → 4 opções (1 correta).
        </p>
      </div>

      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Tradução</div>
        <div class="mt-1 text-lg font-semibold">Pronto para estruturar</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Termos, grafia, significado, exemplo e depois áudio.
        </p>
      </div>
    </div>

    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Sessão</div>
      <div class="mt-1 text-sm">
        <span class="font-semibold">{{ auth()->user()->email }}</span>
        <span class="text-zinc-500 dark:text-zinc-400">• role:</span>
        <span class="font-semibold text-wine">{{ auth()->user()->role }}</span>
      </div>
    </div>
  </div>
@endsection
