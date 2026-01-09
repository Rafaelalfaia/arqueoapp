<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('tournament_results', function (Blueprint $table) {
      $table->id();
      $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();

      $table->unsignedInteger('score')->default(0);
      $table->unsignedInteger('correct_count')->default(0);
      $table->unsignedInteger('time_ms')->default(0);

      $table->unsignedTinyInteger('rank')->nullable(); // 1,2,3...
      $table->unsignedBigInteger('prize_awarded')->default(0);
      $table->foreignId('prize_tx_id')->nullable()->constrained('diamond_transactions')->nullOnDelete();

      $table->timestamps();

      $table->index(['tournament_id', 'rank']);
      $table->unique(['tournament_id', 'user_id']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('tournament_results');
  }
};
