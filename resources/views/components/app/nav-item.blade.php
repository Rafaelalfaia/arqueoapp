@props(['href', 'active' => false, 'label'])

<a href="{{ $href }}"
   class="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition
          {{ $active ? 'text-rose-900 dark:text-rose-300' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100' }}">
    <div class="h-6 w-6">
        {{ $slot }}
    </div>
    <div class="text-[11px] font-medium">{{ $label }}</div>

    @if($active)
        <div class="mt-1 h-1 w-8 rounded-full bg-rose-900 dark:bg-rose-300"></div>
    @else
        <div class="mt-1 h-1 w-8 rounded-full bg-transparent"></div>
    @endif
</a>
