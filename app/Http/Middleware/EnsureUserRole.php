<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    /**
     * Uso:
     *  ->middleware('role:admin')
     *  ->middleware('role:admin,revisor')
     *  ->middleware('role:user')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Se não estiver logado, redireciona para a rota de login padrão
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login');
        }

        // Se nenhum role foi passado, por segurança bloqueia
        if (count($roles) === 0) {
            abort(403, 'Acesso não autorizado.');
        }

        // Role inválida ou não permitida
        if (!in_array((string) $user->role, $roles, true)) {
            abort(403, 'Acesso não autorizado.');
        }

        return $next($request);
    }
}
