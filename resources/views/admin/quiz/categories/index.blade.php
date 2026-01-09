@extends('admin.layouts.app')
@section('title','Categorias')

@section('content')
  @include('admin.partials.flash')

  <div class="mb-4 flex items-center justify-between">
    <div>
      <div class="text-lg font-semibold">Categorias do Quiz</div>
      <div class="text-sm text-zinc-600 dark:text-zinc-300">Crie e organize as categorias.</div>
    </div>
    <a href="{{ route('admin.quiz') }}" class="text-sm underline text-zinc-600 dark:text-zinc-300">Voltar</a>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Nova Categoria</div>

      <form method="POST" action="{{ route('admin.quiz.categories.store') }}" class="mt-4 space-y-3">
        @csrf

        <div>
          <label class="text-sm font-semibold">Nome</label>
          <input name="name" value="{{ old('name') }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
        </div>

        <div>
          <label class="text-sm font-semibold">Slug (opcional)</label>
          <input name="slug" value="{{ old('slug') }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
        </div>

        <div>
          <label class="text-sm font-semibold">Descrição (opcional)</label>
          <textarea name="description"
                    class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                    rows="3">{{ old('description') }}</textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-semibold">Ordem</label>
            <input name="sort_order" type="number" min="0" value="{{ old('sort_order', 0) }}"
                   class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
          </div>

          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="is_active" value="1" checked>
              Ativa
            </label>
          </div>
        </div>

        <button class="w-full rounded-2xl bg-wine px-4 py-3 text-sm font-semibold text-white hover:opacity-95">
          Criar categoria
        </button>
      </form>
    </div>

    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Lista</div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-zinc-500 dark:text-zinc-400">
            <tr>
              <th class="py-2">Nome</th>
              <th class="py-2">Perguntas</th>
              <th class="py-2">Ativa</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            @foreach($categories as $c)
              <tr class="border-t border-zinc-200 dark:border-zinc-800">
                <td class="py-2 font-semibold">{{ $c->name }}</td>
                <td class="py-2">{{ $c->questions_count }}</td>
                <td class="py-2">{{ $c->is_active ? 'Sim' : 'Não' }}</td>
                <td class="py-2 text-right space-x-2">
                  <a class="underline" href="{{ route('admin.quiz.categories.edit', $c) }}">Editar</a>

                  <form method="POST" action="{{ route('admin.quiz.categories.destroy', $c) }}" class="inline">
                    @csrf
                    @method('DELETE')
                    <button class="underline text-rose-700 dark:text-rose-300" onclick="return confirm('Remover categoria?')">
                      Apagar
                    </button>
                  </form>
                </td>
              </tr>
            @endforeach
          </tbody>
        </table>

        <div class="mt-4">
          {{ $categories->links() }}
        </div>
      </div>
    </div>
  </div>
@endsection
