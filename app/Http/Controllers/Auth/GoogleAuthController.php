<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Socialite;
use Throwable;

class GoogleAuthController extends Controller
{
    public function redirect()
    {
        // Escopos opcionais (email/profile). Você pode remover se preferir o default.
        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->redirect();
    }

    public function callback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
            // Se tiver problema de sessão/state no futuro (webview), você pode usar:
            // $googleUser = Socialite::driver('google')->stateless()->user();

            $email = $googleUser->getEmail();
            if (!$email) {
                return redirect()->route('login')->withErrors([
                    'email' => 'Não foi possível obter o e-mail da conta Google.',
                ]);
            }

            // Se já existe usuário com esse e-mail:
            $existing = User::where('email', $email)->first();

            // Regra: Google login é SOMENTE para role "user"
            if ($existing && $existing->role !== 'user') {
                return redirect()->route('login')->withErrors([
                    'email' => 'Login com Google disponível apenas para usuários (role user).',
                ]);
            }

            if (!$existing) {
                $user = User::create([
                    'name' => $googleUser->getName() ?: 'Usuário',
                    'email' => $email,
                    'role' => 'user',
                    // garante que respeita coluna não-null de password (e impede login por senha conhecida)
                    'password' => Str::random(48),
                    'email_verified_at' => now(),
                    'google_id' => (string) $googleUser->getId(),
                    'avatar' => $googleUser->getAvatar(),
                ]);
            } else {
                $existing->forceFill([
                    'name' => $googleUser->getName() ?: $existing->name,
                    'google_id' => $existing->google_id ?: (string) $googleUser->getId(),
                    'avatar' => $googleUser->getAvatar() ?: $existing->avatar,
                    'email_verified_at' => $existing->email_verified_at ?: now(),
                ])->save();

                $user = $existing;
            }

            Auth::login($user, true);
            request()->session()->regenerate();

            return redirect()->route('dashboard');
        } catch (Throwable) {
            return redirect()->route('login')->withErrors([
                'email' => 'Falha ao autenticar com Google. Tente novamente.',
            ]);
        }
    }
}
