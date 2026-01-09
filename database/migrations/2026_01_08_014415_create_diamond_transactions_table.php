<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('diamond_transactions', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();

      // delta: +crédito / -débito
      $table->bigInteger('delta');

      $table->unsignedBigInteger('balance_before');
      $table->unsignedBigInteger('balance_after');

      // exemplos: tournament_entry, tournament_prize, admin_adjustment, refund
      $table->string('reason', 50);

      // vínculo opcional (ex.: Tournament, Match, etc.)
      $table->nullableMorphs('related');

      $table->json('meta')->nullable();

      $table->timestamps();
      $table->index(['user_id', 'created_at']);
      $table->index(['reason', 'created_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('diamond_transactions');
  }
};
