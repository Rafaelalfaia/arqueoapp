<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#4c0519" />

    <title>@yield('title', 'Admin') • ArqueoApp</title>

    @vite(['resources/css/app.css','resources/js/app.js'])

    {{-- Inicializa tema sem “flash” --}}
    <script>
      (function () {
        const key = 'arqueoapp_theme';
        const root = document.documentElement;

        const saved = localStorage.getItem(key);
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');

        if (theme === 'dark') root.classList.add('dark');

        window.__toggleTheme = function () {
          const isDark = root.classList.toggle('dark');
          localStorage.setItem(key, isDark ? 'dark' : 'light');
        };
      })();
    </script>

    <style>
      :root{
        --wine: #4c0519; /* vinho */
      }
      .bg-wine{ background-color: var(--wine); }
      .text-wine{ color: var(--wine); }
      .ring-wine{ --tw-ring-color: var(--wine); }
      .safe-bottom{ padding-bottom: env(safe-area-inset-bottom); }
    </style>
</head>

<body class="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    {{-- “tela” central como app --}}
    <div class="mx-auto min-h-screen max-w-md md:max-w-2xl lg:max-w-5xl pb-24">
        @include('admin.partials.topbar')

        <main class="px-4 py-5">
            @yield('content')
            @include('admin.partials.flash')

        </main>

        @include('admin.partials.bottom-nav')
    </div>
</body>
</html>
