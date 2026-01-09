@extends('admin.layouts.app')
@section('title','Editar Torneio')

@section('content')
<div class="space-y-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Admin / Quiz / Torneios</div>
      <h1 class="mt-1 text-xl font-semibold">Editar Torneio</h1>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Ajuste parâmetros e publique quando estiver pronto.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <a href="{{ route('admin.quiz.torneios.index') }}"
         class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Voltar
      </a>

      @if(($tournament->status ?? 'draft') === 'published')
        <form method="POST" action="{{ route('admin.quiz.torneios.unpublish', $tournament) }}">
          @csrf
          <button type="submit"
                  class="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
            Voltar p/ rascunho
          </button>
        </form>
      @else
        <form method="POST" action="{{ route('admin.quiz.torneios.publish', $tournament) }}">
          @csrf
          <button type="submit"
                  class="inline-flex items-center justify-center rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Publicar
          </button>
        </form>
      @endif
    </div>
  </div>

  <form method="POST" action="{{ route('admin.quiz.torneios.update', $tournament) }}" enctype="multipart/form-data" class="space-y-4">
    @csrf
    @method('PUT')

    @include('admin.quiz.torneios._form', ['tournament' => $tournament])

    <div class="flex flex-wrap items-center gap-2">
      <button type="submit" class="rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm">
        Salvar alterações
      </button>
      <a href="{{ route('admin.quiz.torneios.index') }}"
         class="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Voltar
      </a>
    </div>
  </form>
</div>
@endsection
