@extends('admin.layouts.app')
@section('title','Perguntas')

@section('content')
  @include('admin.partials.flash')

  <div class="mb-4 flex items-center justify-between">
    <div>
      <div class="text-lg font-semibold">Perguntas</div>
      <div class="text-sm text-zinc-600 dark:text-zinc-300">Crie, edite e apague perguntas (A–E).</div>
    </div>
    <div class="flex gap-2">
      <a href="{{ route('admin.quiz') }}" class="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">Voltar</a>
      <a href="{{ route('admin.quiz.questions.create') }}" class="rounded-2xl bg-wine px-3 py-2 text-sm font-semibold text-white">Criar</a>
    </div>
  </div>

  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <form class="grid gap-3 sm:grid-cols-4" method="GET" action="{{ route('admin.quiz.questions.index') }}">
      <input name="q" value="{{ $q }}"
             placeholder="Buscar no enunciado..."
             class="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:col-span-2"/>

      <select name="category_id"
              class="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <option value="">Todas categorias</option>
        @foreach($categories as $c)
          <option value="{{ $c->id }}" @selected((string)$categoryId === (string)$c->id)>{{ $c->name }}</option>
        @endforeach
      </select>

      <select name="status"
              class="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <option value="">Todos status</option>
        <option value="draft" @selected($status==='draft')>draft</option>
        <option value="published" @selected($status==='published')>published</option>
        <option value="archived" @selected($status==='archived')>archived</option>
      </select>

      <div class="sm:col-span-4 flex gap-2">
        <button class="rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
        <a href="{{ route('admin.quiz.questions.index') }}" class="rounded-2xl border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">Limpar</a>
      </div>
    </form>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-zinc-500 dark:text-zinc-400">
          <tr>
            <th class="py-2">ID</th>
            <th class="py-2">Categoria</th>
            <th class="py-2">Enunciado</th>
            <th class="py-2">Correta</th>
            <th class="py-2">Status</th>
            <th class="py-2"></th>
          </tr>
        </thead>
        <tbody>
          @foreach($questions as $qst)
            <tr class="border-t border-zinc-200 dark:border-zinc-800">
              <td class="py-2">{{ $qst->id }}</td>
              <td class="py-2">{{ $qst->category?->name }}</td>
              <td class="py-2">
                <div class="max-w-xl truncate" title="{{ $qst->question }}">{{ $qst->question }}</div>
              </td>
              <td class="py-2 font-semibold">{{ $qst->correct_option }}</td>
              <td class="py-2">{{ $qst->status }}</td>
              <td class="py-2 text-right space-x-2">
                <a class="underline" href="{{ route('admin.quiz.questions.edit', $qst) }}">Editar</a>

                <form method="POST" action="{{ route('admin.quiz.questions.destroy', $qst) }}" class="inline">
                  @csrf
                  @method('DELETE')
                  <button class="underline text-rose-700 dark:text-rose-300" onclick="return confirm('Apagar pergunta?')">
                    Apagar
                  </button>
                </form>
              </td>
            </tr>
          @endforeach
        </tbody>
      </table>

      <div class="mt-4">
        {{ $questions->links() }}
      </div>
    </div>
  </div>
@endsection
