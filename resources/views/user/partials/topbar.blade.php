<header class="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
  {{-- Alinha com o "container app" (igual seu layout principal) --}}
  <div class="mx-auto flex max-w-md items-center justify-between px-4 py-3 md:max-w-2xl lg:max-w-5xl">
    <div class="flex items-center gap-3 min-w-0">
      <div class="h-10 w-10 flex-none rounded-2xl bg-wine shadow-[0_18px_55px_-40px_rgba(76,5,25,.75)]"></div>

      <div class="min-w-0">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">ArqueoApp</div>
        <div class="truncate text-base font-semibold leading-tight">
          @yield('topbar_title','Área do Usuário')
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      {{-- Diamantes (destaque) --}}
      <div class="hidden sm:block">
        <x-diamonds-pill size="sm" />
      </div>

      {{-- Tema (ícone + app-like) --}}
      <button
        type="button"
        onclick="window.__toggleTheme && window.__toggleTheme()"
        class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm
               hover:bg-zinc-50 active:scale-[0.99] transition
               dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        title="Alternar tema"
        aria-label="Alternar tema"
      >
        <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a6.8 6.8 0 1 0 9.8 9.8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      {{-- Logout --}}
      <form method="POST" action="{{ route('logout') }}">
        @csrf
        <button
          type="submit"
          class="inline-flex items-center justify-center rounded-2xl bg-wine px-3 py-2 text-sm font-semibold text-white shadow-sm
                 hover:opacity-95 active:scale-[0.99] transition"
          title="Sair"
        >
          <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
            <path d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M3 12h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M7 8l-4 4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  </div>

  {{-- Diamantes no mobile (abaixo, centralizado e discreto) --}}
  <div class="px-4 pb-3 sm:hidden">
    <div class="mx-auto max-w-md md:max-w-2xl lg:max-w-5xl flex justify-end">
      <x-diamonds-pill size="sm" />
    </div>
  </div>
</header>
