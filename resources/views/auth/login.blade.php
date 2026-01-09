<!doctype html>
<html lang="pt-br">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ArqueoApp - Login</title>
</head>
<body style="font-family: Arial; padding: 24px;">
    <h1>Login</h1>

    @if ($errors->any())
        <div style="padding: 10px; background: #fee; border: 1px solid #f99; margin: 10px 0;">
            {{ $errors->first() }}
        </div>
    @endif

    <form method="POST" action="{{ route('login') }}">
        @csrf

        <div style="margin-bottom: 12px;">
            <label>E-mail</label><br>
            <input name="email" value="{{ old('email') }}" style="padding: 8px; width: 320px;">
        </div>

        <div style="margin-bottom: 12px;">
            <label>Senha</label><br>
            <input type="password" name="password" style="padding: 8px; width: 320px;">
        </div>

        <div style="margin-bottom: 12px;">
            <label>
                <input type="checkbox" name="remember" value="1"> Lembrar
            </label>
        </div>

        <button type="submit" style="padding: 10px 14px;">Entrar</button>
    </form>

    <a href="{{ route('auth.google.redirect') }}">
    Entrar com Google
</a>


    <hr style="margin: 18px 0;">

    <small>
        Admin: admin@admin / admin<br>
        Revisor: revisor@revisor.com / revisor
    </small>
</body>
</html>
