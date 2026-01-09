<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('tournament_entries', function (Blueprint $table) {
      $table->id();
      $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();

      // referência ao débito de inscrição
      $table->foreignId('paid_tx_id')->nullable()->constrained('diamond_transactions')->nullOnDelete();

      $table->string('status', 20)->default('enrolled'); // enrolled | in_progress | finished | refunded | disqualified
      $table->timestamp('joined_at')->nullable();

      $table->timestamps();

      $table->unique(['tournament_id', 'user_id']);
      $table->index(['tournament_id', 'status']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('tournament_entries');
  }
};
