<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>User - Dashboard</title></head>
<body style="font-family: Arial; padding: 24px;">
  <h1>Parabéns, você está logado</h1>
  <p>Usuário: {{ auth()->user()->email }} | Role: {{ auth()->user()->role }}</p>

  <form method="POST" action="{{ route('logout') }}">
    @csrf
    <button type="submit">Sair</button>
  </form>
</body>
</html>
