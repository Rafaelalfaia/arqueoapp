<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SimpleAuthController extends Controller
{
    public function showLogin()
    {
        return view('auth.login');
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            // NÃO use "email" rule porque você quer aceitar admin@admin
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        $remember = $request->boolean('remember');

        if (!Auth::attempt(['email' => $data['email'], 'password' => $data['password']], $remember)) {
            return back()
                ->withErrors(['email' => 'Essas credenciais não correspondem aos nossos registros.'])
                ->onlyInput('email');
        }

        $request->session()->regenerate();

        return redirect()->route('dashboard.redirect');
    }

    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login.form');
    }

    public function redirectDashboard(Request $request)
    {
        $role = (string) $request->user()->role;

        return match ($role) {
            'admin' => redirect()->route('admin.dashboard'),
            'revisor' => redirect()->route('revisor.dashboard'),
            default => redirect()->route('user.dashboard'),
        };
    }
}
