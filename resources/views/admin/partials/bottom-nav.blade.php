<nav class="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
  <div class="mx-auto grid max-w-md md:max-w-2xl lg:max-w-5xl grid-cols-4 gap-2 px-3 py-2">
    @php
      $base = "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold";
      $off  = "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900";
      $on   = "text-white shadow-sm";
      $is = fn ($name) => request()->routeIs($name);
    @endphp

    <a href="{{ route('admin.dashboard') }}"
       class="{{ $base }} {{ $is('admin.dashboard') ? $on : $off }}"
       style="{{ $is('admin.dashboard') ? 'background:var(--wine)' : '' }}">
      <span>Dashboard</span>
    </a>

    <a href="{{ route('admin.quiz') }}"
       class="{{ $base }} {{ $is('admin.quiz') ? $on : $off }}"
       style="{{ $is('admin.quiz') ? 'background:var(--wine)' : '' }}">
      <span>Quiz</span>
    </a>

    <a href="{{ route('admin.traducao') }}"
       class="{{ $base }} {{ $is('admin.traducao') ? $on : $off }}"
       style="{{ $is('admin.traducao') ? 'background:var(--wine)' : '' }}">
      <span>Tradução</span>
    </a>

    <a href="{{ route('admin.perfil') }}"
       class="{{ $base }} {{ $is('admin.perfil') ? $on : $off }}"
       style="{{ $is('admin.perfil') ? 'background:var(--wine)' : '' }}">
      <span>Perfil</span>
    </a>
  </div>
</nav>
