<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />

    {{-- PWA-friendly --}}
    <meta name="theme-color" content="#4c0519" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

    <title>{{ $title ?? 'ArqueoApp' }}</title>

    {{-- Evita “flash” de tema --}}
    <script>
      (function () {
        try {
          const saved = localStorage.getItem('theme');
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          const theme = saved || (prefersDark ? 'dark' : 'light');
          if (theme === 'dark') document.documentElement.classList.add('dark');
        } catch (e) {}
      })();
    </script>

    @vite(['resources/css/app.css','resources/js/app.js'])
</head>

<body class="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    {{-- Container central tipo app (bom para PWA e webview) --}}
    <div class="mx-auto min-h-screen max-w-md md:max-w-2xl lg:max-w-4xl">
        {{-- Topbar --}}
        <header class="sticky top-0 z-40 backdrop-blur bg-zinc-50/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-2">
                    <div class="h-9 w-9 rounded-2xl bg-rose-950 text-white grid place-items-center shadow-sm">
                        <span class="text-sm font-semibold">A</span>
                    </div>
                    <div class="leading-tight">
                        <div class="text-sm font-semibold">{{ $headerTitle ?? 'ArqueoApp' }}</div>
                        <div class="text-xs text-zinc-500 dark:text-zinc-400">Arqueologia • Quiz • Aprendizado</div>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    {{-- Toggle tema --}}
                    <button type="button"
                        onclick="window.__toggleTheme && window.__toggleTheme()"
                        class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        <span class="hidden sm:inline">Tema</span>
                        <span class="text-xs text-zinc-500 dark:text-zinc-400">claro/escuro</span>
                    </button>

                    {{-- Logout --}}
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button class="rounded-xl bg-rose-900 hover:bg-rose-950 text-white px-3 py-2 text-sm shadow-sm">
                            Sair
                        </button>
                    </form>
                </div>
            </div>
        </header>

        {{-- Conteúdo --}}
        <main class="px-4 pt-4 pb-24">
            {{ $slot }}
        </main>

        {{-- Bottom navigation (estilo app) --}}
        <nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur">
            <div class="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl px-2">
                <div class="grid grid-cols-4 py-2">
                    <x-app.nav-item :href="route('user.dashboard')" :active="request()->routeIs('user.dashboard')" label="Dashboard">
                        <x-app.icons.home />
                    </x-app.nav-item>

                    <x-app.nav-item :href="route('user.quiz')" :active="request()->routeIs('user.quiz*')" label="Quiz">
                        <x-app.icons.quiz />
                    </x-app.nav-item>

                    <x-app.nav-item :href="route('user.traducao')" :active="request()->routeIs('user.traducao*')" label="Tradução">
                        <x-app.icons.translate />
                    </x-app.nav-item>

                    <x-app.nav-item :href="route('user.perfil')" :active="request()->routeIs('user.perfil*')" label="Perfil">
                        <x-app.icons.user />
                    </x-app.nav-item>
                </div>
            </div>
        </nav>
    </div>

    {{-- Script simples do tema --}}
    <script>
      window.__toggleTheme = function () {
        const isDark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
      }
    </script>
</body>
</html>
