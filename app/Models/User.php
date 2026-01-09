<?php

namespace App\Models;

use App\Enums\UserRole;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements FilamentUser
{
    use HasFactory, Notifiable;

    /**
     * Campos que podem ser preenchidos em massa (seeders, forms, etc.)
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        // se você for usar idioma preferido no futuro:
        // 'preferred_locale',
        'email_verified_at',
    ];

    /**
     * Campos escondidos ao serializar (API, logs, etc.)
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Casts (Laravel 11)
     * - password => hashed: garante hash automático quando você setar a senha
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Helpers de Role
     */
    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin->value;
    }

    public function isRevisor(): bool
    {
        return $this->role === UserRole::Revisor->value;
    }

    public function isUser(): bool
    {
        return $this->role === UserRole::User->value;
    }

    public function diamondTransactions()
    {
        return $this->hasMany(\App\Models\DiamondTransaction::class);
    }


    public function hasAnyRole(array $roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    /**
     * Filament: controla quem pode acessar /admin
     * Se retornar false, o Filament pode mostrar mensagem genérica de credenciais inválidas.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->hasAnyRole([
            UserRole::Admin->value,
            UserRole::Revisor->value,
        ]);
    }
}
