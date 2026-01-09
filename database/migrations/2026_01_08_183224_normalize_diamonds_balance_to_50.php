<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
  public function up(): void
  {
    // 1) novos usuários: default 50
    DB::statement("ALTER TABLE users ALTER COLUMN diamonds_balance SET DEFAULT 50");

    // 2) regra global: quem estiver abaixo de 50 vai para 50 (inclui NULL por segurança)
    DB::statement("UPDATE users SET diamonds_balance = 50 WHERE diamonds_balance IS NULL OR diamonds_balance < 50");
  }

  public function down(): void
  {
    // volta ao default antigo (0) — dados não são revertidos
    DB::statement("ALTER TABLE users ALTER COLUMN diamonds_balance SET DEFAULT 0");
  }
};
