@extends('user.layouts.app')
@section('title','Principal')
@section('topbar_title','Principal')

@section('content')
  <div class="space-y-4">
    <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Bem-vindo</div>
      <div class="mt-1 text-xl font-semibold">Área do Usuário ativa</div>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Estrutura inicial do app (sem banco específico). Próximo passo: ligar cada módulo ao Firestore/DB.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <span class="inline-flex items-center rounded-2xl bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          Navegação pronta
        </span>
        <span class="inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold text-white bg-wine">
          Vinho (brand)
        </span>
        <span class="inline-flex items-center rounded-2xl bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          Claro/Escuro
        </span>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Atalho</div>
        <div class="mt-1 text-lg font-semibold">Começar um Quiz</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Entrar no módulo de quiz para jogar.</p>
        <a href="{{ route('user.quiz') }}" class="mt-4 inline-flex rounded-2xl bg-wine px-4 py-2 text-sm font-semibold text-white">
          Ir para Quiz
        </a>
      </div>

      <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Atalho</div>
        <div class="mt-1 text-lg font-semibold">Ver Perfil</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Dados básicos do usuário logado.</p>
        <a href="{{ route('user.perfil') }}" class="mt-4 inline-flex rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          Ir para Perfil
        </a>
      </div>
    </div>
  </div>
@endsection
