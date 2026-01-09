@if(session('success'))
  <div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
    {{ session('success') }}
  </div>
@endif

@if($errors->any())
  <div class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
    {{ $errors->first() }}
  </div>
@endif

@if(session('import_errors'))
  <div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
    <div class="font-semibold">Linhas com erro (amostra):</div>
    <ul class="mt-2 list-disc pl-5 space-y-1">
      @foreach(session('import_errors') as $e)
        <li>{{ $e }}</li>
      @endforeach
    </ul>
  </div>
@endif
