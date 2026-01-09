@extends('admin.layouts.app')
@section('title','Importar')

@section('content')
  @include('admin.partials.flash')

  <div class="mb-4 flex items-center justify-between">
    <div>
      <div class="text-lg font-semibold">Importação em massa</div>
      <div class="text-sm text-zinc-600 dark:text-zinc-300">Use CSV (abre no Excel) para importar perguntas em lote.</div>
    </div>
    <a href="{{ route('admin.quiz') }}" class="text-sm underline text-zinc-600 dark:text-zinc-300">Voltar</a>
  </div>

  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
    <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div class="text-sm font-semibold">1) Baixe o template</div>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Abra no Excel, preencha e salve como CSV. Separador recomendado: <span class="font-semibold">;</span>
      </p>
      <a href="{{ route('admin.quiz.import.template') }}"
         class="mt-3 inline-block rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white">
        Baixar template CSV
      </a>
    </div>

    <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div class="text-sm font-semibold">2) Envie o arquivo</div>

      <form method="POST" action="{{ route('admin.quiz.import.store') }}" enctype="multipart/form-data" class="mt-3 space-y-3">
        @csrf
        <input type="file" name="file" accept=".csv,.txt"
               class="block w-full text-sm" />

        <button class="w-full rounded-2xl bg-wine px-4 py-3 text-sm font-semibold text-white hover:opacity-95">
          Importar CSV
        </button>
      </form>

      <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        XLSX será adicionado na próxima etapa (sem mudar telas/rotas).
      </p>
    </div>
  </div>
@endsection
