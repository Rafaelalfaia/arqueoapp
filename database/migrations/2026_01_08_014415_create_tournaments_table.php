<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('tournaments', function (Blueprint $table) {
      $table->id();

      $table->string('title', 120);
      $table->string('type', 20);   // common | special
      $table->string('status', 20)->default('draft'); // draft | published | running | finished | cancelled

      $table->string('cover_path');

      $table->unsignedBigInteger('entry_fee')->default(0);

      // Comum: prêmio fixo definido no admin
      $table->unsignedBigInteger('prize_pool_fixed')->nullable();

      // Especial: prize_pool = (entry_fee * inscritos) * special_multiplier
      $table->unsignedTinyInteger('special_multiplier')->default(2);

      $table->unsignedInteger('question_count')->default(10);

      // Comum: limite de jogadores; Especial: null = ilimitado
      $table->unsignedInteger('max_players')->nullable();

      // Especial: data/hora
      $table->timestamp('scheduled_at')->nullable();

      $table->unsignedTinyInteger('split_first')->default(50);
      $table->unsignedTinyInteger('split_second')->default(30);
      $table->unsignedTinyInteger('split_third')->default(20);

      $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();

      $table->timestamp('published_at')->nullable();
      $table->timestamps();

      $table->index(['type', 'status']);
      $table->index(['scheduled_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('tournaments');
  }
};
