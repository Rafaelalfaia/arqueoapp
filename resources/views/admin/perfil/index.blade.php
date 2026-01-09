@extends('admin.layouts.app')
@section('title','Perfil')

@section('content')
  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">Conta</div>
    <div class="mt-1 text-xl font-semibold">{{ auth()->user()->name ?? 'Admin' }}</div>
    <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{{ auth()->user()->email }}</div>

    <div class="mt-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div class="text-sm font-semibold">Role</div>
      <div class="mt-1 text-sm text-wine font-semibold">{{ auth()->user()->role }}</div>
    </div>
  </div>
@endsection
