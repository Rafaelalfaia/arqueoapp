<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class EnsureAdminSeeder extends Seeder
{
    public function run(): void
    {
        // Se já existir admin, não faz nada
        if (User::where('role', 'admin')->exists()) {
            return;
        }

        // Se existir algum usuário, promove o primeiro
        $first = User::orderBy('id')->first();
        if ($first) {
            $first->update(['role' => 'admin']);
        }
    }
}
