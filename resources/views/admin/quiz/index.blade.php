@extends('admin.layouts.app')
@section('title','Quiz')

@section('content')
  @include('admin.partials.flash')

  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Módulo</div>
      <div class="mt-1 text-xl font-semibold">Gestão do Quiz</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Categorias e perguntas com 5 opções (A–E) e 1 correta. Importação em massa disponível via CSV (abre no Excel).
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Categorias</div>
          <div class="mt-1 text-lg font-semibold">{{ $stats['categories'] ?? 0 }}</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Perguntas</div>
          <div class="mt-1 text-lg font-semibold">{{ $stats['questions'] ?? 0 }}</div>
        </div>
        <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Publicadas</div>
          <div class="mt-1 text-lg font-semibold">{{ $stats['published'] ?? 0 }}</div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <a href="{{ route('admin.quiz.categories.index') }}"
         class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Ação</div>
        <div class="mt-1 text-lg font-semibold">Categorias</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Criar, editar e remover categorias.</p>
      </a>

      <a href="{{ route('admin.quiz.questions.index') }}"
         class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Ação</div>
        <div class="mt-1 text-lg font-semibold">Perguntas</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Criar, editar e apagar perguntas.</p>
      </a>

      <a href="{{ route('admin.quiz.import.index') }}"
         class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Ação</div>
        <div class="mt-1 text-lg font-semibold">Importar em massa</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Importe via CSV (Excel) por lote.</p>
      </a>

      <a href="{{ route('admin.quiz.torneios.index') }}"
         class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Game</div>
        <div class="mt-1 text-lg font-semibold">Torneios</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Criar e publicar torneios comuns e especiais, com capa e premiação.
        </p>
      </a>
    </div>
  </div>
@endsection
