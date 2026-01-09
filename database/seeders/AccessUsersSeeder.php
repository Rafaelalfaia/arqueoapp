<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AccessUsersSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        User::updateOrCreate(
            ['email' => 'admin@admin'],
            [
                'name' => 'Admin',
                'role' => UserRole::Admin->value,
                'password' => Hash::make('admin'),
                'email_verified_at' => now(),
            ]
        );

        // Revisor
        User::updateOrCreate(
            ['email' => 'revisor@revisor.com'],
            [
                'name' => 'Revisor',
                'role' => UserRole::Revisor->value,
                'password' => Hash::make('revisor'),
                'email_verified_at' => now(),
            ]
        );
    }
}
