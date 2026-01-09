@extends('admin.layouts.app')
@section('title','Novo Torneio')

@section('content')
<div class="space-y-4">
  <div class="flex items-start justify-between gap-3">
    <div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Admin / Quiz / Torneios</div>
      <h1 class="mt-1 text-xl font-semibold">Criar Torneio</h1>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Defina tipo, taxa de inscrição, premiação e envie uma capa.
      </p>
    </div>

    <a href="{{ route('admin.quiz.torneios.index') }}"
       class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      Voltar
    </a>
  </div>

  <form method="POST" action="{{ route('admin.quiz.torneios.store') }}" enctype="multipart/form-data" class="space-y-4">
    @csrf

    @include('admin.quiz.torneios._form')

    <div class="flex flex-wrap items-center gap-2">
      <button type="submit" class="rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm">
        Salvar
      </button>
      <a href="{{ route('admin.quiz.torneios.index') }}"
         class="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Cancelar
      </a>
    </div>
  </form>
</div>
@endsection
