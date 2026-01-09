@if (session('success') || session('error') || session('warning') || session('info') || $errors->any())
  <div class="space-y-3">
    @if (session('success'))
      <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
        {{ session('success') }}
      </div>
    @endif

    @if (session('error'))
      <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
        {{ session('error') }}
      </div>
    @endif

    @if (session('warning'))
      <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
        {{ session('warning') }}
      </div>
    @endif

    @if (session('info'))
      <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200">
        {{ session('info') }}
      </div>
    @endif

    @if ($errors->any())
      <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
        <div class="font-semibold">Verifique os campos:</div>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          @foreach ($errors->all() as $e)
            <li>{{ $e }}</li>
          @endforeach
        </ul>
      </div>
    @endif
  </div>
@endif
