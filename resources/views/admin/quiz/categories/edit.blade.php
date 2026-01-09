@extends('admin.layouts.app')
@section('title','Editar Categoria')

@section('content')
  @include('admin.partials.flash')

  <div class="mb-4 flex items-center justify-between">
    <div class="text-lg font-semibold">Editar Categoria</div>
    <a href="{{ route('admin.quiz.categories.index') }}" class="text-sm underline text-zinc-600 dark:text-zinc-300">Voltar</a>
  </div>

  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <form method="POST" action="{{ route('admin.quiz.categories.update', $category) }}" class="space-y-3">
      @csrf
      @method('PUT')

      <div>
        <label class="text-sm font-semibold">Nome</label>
        <input name="name" value="{{ old('name', $category->name) }}"
               class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
      </div>

      <div>
        <label class="text-sm font-semibold">Slug</label>
        <input name="slug" value="{{ old('slug', $category->slug) }}"
               class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
      </div>

      <div>
        <label class="text-sm font-semibold">Descrição</label>
        <textarea name="description"
                  class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                  rows="3">{{ old('description', $category->description) }}</textarea>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm font-semibold">Ordem</label>
          <input name="sort_order" type="number" min="0" value="{{ old('sort_order', $category->sort_order) }}"
                 class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" />
        </div>

        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="is_active" value="1" {{ old('is_active', $category->is_active) ? 'checked' : '' }}>
            Ativa
          </label>
        </div>
      </div>

      <button class="w-full rounded-2xl bg-wine px-4 py-3 text-sm font-semibold text-white hover:opacity-95">
        Salvar
      </button>
    </form>
  </div>
@endsection
