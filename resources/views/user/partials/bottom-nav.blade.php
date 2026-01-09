@php
  $r = request()->route()?->getName() ?? '';

  // Resolve "Principal" sem quebrar se user.home não existir
  $homeRoute = \Illuminate\Support\Facades\Route::has('user.home')
    ? 'user.home'
    : (\Illuminate\Support\Facades\Route::has('user.dashboard') ? 'user.dashboard' : 'dashboard');

  // Helpers de rota/ativo (sem depender de Str)
  $is = fn(string $name) => $r === $name;
  $starts = fn(string $prefix) => is_string($r) && $r !== '' && str_starts_with($r, $prefix);

  $tabs = [
    [
      'label'  => 'Principal',
      'route'  => $homeRoute,
      'active' => $is('user.home') || $is('user.dashboard') || $is('dashboard'),
    ],
    [
      'label'  => 'Quiz',
      'route'  => \Illuminate\Support\Facades\Route::has('user.quiz') ? 'user.quiz' : $homeRoute,
      // cobre: user.quiz, user.quiz.treino.*, user.quiz.amizade.*, user.quiz.torneio.*
      'active' => $starts('user.quiz'),
    ],
    [
      'label'  => 'Traduções',
      'route'  => \Illuminate\Support\Facades\Route::has('user.traducoes') ? 'user.traducoes' : $homeRoute,
      'active' => $starts('user.traducoes'),
    ],
    [
      'label'  => 'Artefatos',
      'route'  => \Illuminate\Support\Facades\Route::has('user.artefatos') ? 'user.artefatos' : $homeRoute,
      'active' => $starts('user.artefatos'),
    ],
    [
      'label'  => 'Perfil',
      'route'  => \Illuminate\Support\Facades\Route::has('user.perfil') ? 'user.perfil' : $homeRoute,
      'active' => $starts('user.perfil'),
    ],
  ];

  $icons = [
    'Principal' => fn() => '<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M3 11.25 12 4l9 7.25V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-8.75Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21.5v-6h4v6" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Quiz'      => fn() => '<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M12 22.5c5.8 0 10.5-4.7 10.5-10.5S17.8 1.5 12 1.5 1.5 6.2 1.5 12 6.2 22.5 12 22.5Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.7 9.7a2.3 2.3 0 1 1 3.9 1.6c-.9.9-1.4 1.3-1.4 2.2v.3" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17.3h.01" stroke="currentColor" stroke-width="3.1" stroke-linecap="round"/></svg>',
    'Traduções' => fn() => '<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.6 9h16.8M3.6 15h16.8" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3c2.5 2.4 3.8 5.8 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.8-3.8-9S9.5 5.4 12 3Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Artefatos' => fn() => '<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M6.5 3.75h11A1.75 1.75 0 0 1 19.25 5.5V21l-7.25-4.2L4.75 21V5.5A1.75 1.75 0 0 1 6.5 3.75Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Perfil'    => fn() => '<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M12 12a4.25 4.25 0 1 0 0-8.5A4.25 4.25 0 0 0 12 12Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 20.5a7.5 7.5 0 0 0-15 0" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ];

  // Barra central “estilo app” (igual no desktop/tablet/mobile)
  $bar =
    'inline-flex items-center gap-1 rounded-full px-2 py-2 '.
    'bg-white/75 backdrop-blur-xl '.
    'shadow-[0_22px_60px_-34px_rgba(0,0,0,.65)] '.
    'dark:bg-zinc-900/55';

  // Slots: flex-1 no mobile / largura fixa no desktop (sem md: dinâmico quebrado)
  $slot = 'flex flex-1 justify-center md:flex-none md:w-[148px]';

  $aBase =
    'relative w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 '.
    'transition-all duration-150 ease-out '.
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40';

  $aOff =
    'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-900/5 '.
    'dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/5';

  $aOn =
    'bg-wine text-white '.
    'shadow-[0_18px_50px_-34px_rgba(76,5,25,.95)]';

  // No mobile: mostra label só no ativo. No desktop: todos.
  $labelBase = 'text-[12px] font-semibold leading-none tracking-tight whitespace-nowrap';
@endphp

<nav class="fixed inset-x-0 bottom-0 z-50">
  <div class="pointer-events-none flex justify-center px-4"
       style="padding-bottom: calc(env(safe-area-inset-bottom) + 14px);">
    <div class="pointer-events-auto {{ $bar }}">
      <div class="flex items-center gap-1">
        @foreach ($tabs as $t)
          @php
            $on = (bool) $t['active'];

            // Nunca chama route() se não existir (evita RouteNotFoundException)
            $href = \Illuminate\Support\Facades\Route::has($t['route'])
              ? route($t['route'])
              : (\Illuminate\Support\Facades\Route::has('dashboard') ? route('dashboard') : url('/'));
          @endphp

          <div class="{{ $slot }}">
            <a href="{{ $href }}"
               aria-current="{{ $on ? 'page' : 'false' }}"
               class="{{ $aBase }} {{ $on ? $aOn : $aOff }}">

              <span class="flex h-9 w-9 items-center justify-center rounded-full {{ $on ? 'bg-white/10' : 'bg-transparent' }}">
                {!! $icons[$t['label']]() !!}
              </span>

              <span class="{{ $labelBase }} {{ $on ? 'inline' : 'hidden md:inline' }}">
                {{ $t['label'] }}
              </span>
            </a>
          </div>
        @endforeach
      </div>
    </div>
  </div>
</nav>
