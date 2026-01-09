@props([
  'value' => null,
  'size' => 'sm', // sm | md
])

@php
  $u = auth()->user();
  $balance = is_numeric($value) ? (int)$value : (int)($u?->diamonds_balance ?? 0);

  $pad = $size === 'md' ? 'px-4 py-2' : 'px-3 py-1.5';
  $text = $size === 'md' ? 'text-sm' : 'text-xs';
  $icon = $size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
@endphp

<span class="inline-flex items-center gap-2 rounded-full {{ $pad }}
             bg-wine text-white
             shadow-[0_18px_55px_-38px_rgba(76,5,25,.95)]
             ring-1 ring-white/15 dark:ring-white/10">
  <svg viewBox="0 0 24 24" fill="none" class="{{ $icon }}" aria-hidden="true">
    <path d="M12 3 4.5 9l7.5 12 7.5-12L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M4.5 9h15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M9.2 9 12 21 14.8 9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>

  <span class="{{ $text }} font-extrabold tracking-tight">{{ $balance }}</span>
  <span class="{{ $text }} font-semibold opacity-90">diamantes</span>
</span>
