<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('quiz_category_id')
                ->constrained('quiz_categories')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // Conteúdo da pergunta
            $table->text('question');

            // 5 opções fixas (excel-friendly)
            $table->text('option_a');
            $table->text('option_b');
            $table->text('option_c');
            $table->text('option_d');
            $table->text('option_e');

            // Resposta correta (A-E)
            $table->char('correct_option', 1);

            // Opcional: explicação/justificativa
            $table->text('explanation')->nullable();

            // Status para fluxo de revisão (mesmo que por enquanto você publique direto)
            $table->string('status', 20)->default('draft'); // draft | published | archived

            // Auditoria básica
            $table->foreignId('created_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->foreignId('updated_by')->nullable()
                ->constrained('users')->nullOnDelete();

            // Preparado para aprovação por revisor (opcional por enquanto)
            $table->foreignId('approved_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamp('approved_at')->nullable();

            // Preparado para importação em massa (Excel)
            $table->uuid('import_batch_id')->nullable();
            $table->unsignedInteger('import_row')->nullable();
            $table->string('import_source', 120)->nullable(); // ex: "excel", "manual", "api"

            $table->timestamps();
            $table->softDeletes();

            $table->index(['quiz_category_id']);
            $table->index(['status']);
            $table->index(['import_batch_id']);
        });

        // Constraint para garantir apenas A..E no banco (PostgreSQL)
        DB::statement("
            ALTER TABLE quiz_questions
            ADD CONSTRAINT quiz_questions_correct_option_check
            CHECK (correct_option IN ('A','B','C','D','E'))
        ");

        // Opcional: status check (se quiser travar os valores)
        DB::statement("
            ALTER TABLE quiz_questions
            ADD CONSTRAINT quiz_questions_status_check
            CHECK (status IN ('draft','published','archived'))
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_questions');
    }
};
