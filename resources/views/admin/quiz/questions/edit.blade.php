@extends('admin.layouts.app')
@section('title','Editar Pergunta')

@section('content')
  @include('admin.partials.flash')

  <div class="mb-4 flex items-center justify-between">
    <div class="text-lg font-semibold">Editar Pergunta</div>
    <a href="{{ route('admin.quiz.questions.index') }}" class="text-sm underline text-zinc-600 dark:text-zinc-300">Voltar</a>
  </div>

  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <form method="POST" action="{{ route('admin.quiz.questions.update', $question) }}" class="space-y-4">
      @csrf
      @method('PUT')

      <div>
        <label class="text-sm font-semibold">Categoria</label>
        <select name="quiz_category_id" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          @foreach($categories as $c)
            <option value="{{ $c->id }}" @selected(old('quiz_category_id', $question->quiz_category_id) == $c->id)>{{ $c->name }}</option>
          @endforeach
        </select>
      </div>

      <div>
        <label class="text-sm font-semibold">Enunciado</label>
        <textarea name="question" rows="3"
          class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">{{ old('question', $question->question) }}</textarea>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="text-sm font-semibold">Opção A</label><input name="option_a" value="{{ old('option_a', $question->option_a) }}" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"/></div>
        <div><label class="text-sm font-semibold">Opção B</label><input name="option_b" value="{{ old('option_b', $question->option_b) }}" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"/></div>
        <div><label class="text-sm font-semibold">Opção C</label><input name="option_c" value="{{ old('option_c', $question->option_c) }}" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"/></div>
        <div><label class="text-sm font-semibold">Opção D</label><input name="option_d" value="{{ old('option_d', $question->option_d) }}" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"/></div>
        <div class="sm:col-span-2"><label class="text-sm font-semibold">Opção E</label><input name="option_e" value="{{ old('option_e', $question->option_e) }}" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"/></div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="text-sm font-semibold">Correta</label>
          <select name="correct_option" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            @foreach(['A','B','C','D','E'] as $opt)
              <option value="{{ $opt }}" @selected(old('correct_option', $question->correct_option) === $opt)>{{ $opt }}</option>
            @endforeach
          </select>
        </div>

        <div>
          <label class="text-sm font-semibold">Status</label>
          <select name="status" class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <option value="draft" @selected(old('status', $question->status)==='draft')>draft</option>
            <option value="published" @selected(old('status', $question->status)==='published')>published</option>
            <option value="archived" @selected(old('status', $question->status)==='archived')>archived</option>
          </select>
        </div>
      </div>

      <div>
        <label class="text-sm font-semibold">Explicação (opcional)</label>
        <textarea name="explanation" rows="3"
          class="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">{{ old('explanation', $question->explanation) }}</textarea>
      </div>

      <button class="w-full rounded-2xl bg-wine px-4 py-3 text-sm font-semibold text-white hover:opacity-95">
        Salvar alterações
      </button>
    </form>
  </div>
@endsection
