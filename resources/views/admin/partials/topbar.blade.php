<header class="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/75">
  <div class="flex items-center justify-between px-4 py-3">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 rounded-2xl bg-wine shadow-sm"></div>
      <div class="leading-tight">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Console Admin</div>
        <div class="text-base font-semibold">@yield('title','Dashboard')</div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button type="button"
        onclick="window.__toggleTheme && window.__toggleTheme()"
        class="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        Mudar Tema
      </button>

      <form method="POST" action="{{ route('logout') }}" class="hidden sm:block">
        @csrf
        <button type="submit"
          class="rounded-2xl bg-wine px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95">
          Sair
        </button>
      </form>
    </div>
  </div>
</header>
