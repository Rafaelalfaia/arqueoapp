@extends('user.layouts.app')
@section('title','Perfil')
@section('topbar_title','Perfil')

@section('content')
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Sessão</div>

      <div class="mt-3 space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-zinc-500 dark:text-zinc-400">Nome</span>
          <span class="font-semibold">{{ $user->name ?? '—' }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-zinc-500 dark:text-zinc-400">E-mail</span>
          <span class="font-semibold">{{ $user->email ?? '—' }}</span>
        </div>

        @if (property_exists($user, 'role') || isset($user->role))
          <div class="flex items-center justify-between">
            <span class="text-zinc-500 dark:text-zinc-400">Role</span>
            <span class="font-semibold text-wine">{{ $user->role }}</span>
          </div>
        @endif
      </div>
    </div>
  </div>
@endsection
