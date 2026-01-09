<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Auth\GoogleAuthController;

// ===== Admin Console (Dashboard + menus) =====
use App\Http\Controllers\Admin\Dashboard\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\Traducao\TraducaoController as AdminTraducaoController;
use App\Http\Controllers\Admin\Perfil\PerfilController as AdminPerfilController;

// ===== Admin Quiz (módulo completo) =====
use App\Http\Controllers\Admin\Quiz\QuizController as AdminQuizHomeController;
use App\Http\Controllers\Admin\Quiz\CategoryController as AdminQuizCategoryController;
use App\Http\Controllers\Admin\Quiz\QuestionController as AdminQuizQuestionController;
use App\Http\Controllers\Admin\Quiz\ImportController as AdminQuizImportController;
use App\Http\Controllers\Admin\Quiz\TournamentController as AdminTournamentController;


// USER

use App\Http\Controllers\User\HomeController as UserHomeController;
use App\Http\Controllers\User\QuizController as UserQuizController;
use App\Http\Controllers\User\TraducoesController as UserTraducoesController;
use App\Http\Controllers\User\ArtefatosController as UserArtefatosController;
use App\Http\Controllers\User\PerfilController as UserPerfilController;
use App\Http\Controllers\User\TreinoQuizController as UserTreinoQuizController;
use App\Http\Controllers\User\AmizadeQuizController as UserAmizadeQuizController;
use App\Http\Controllers\User\TorneioQuizController;


// ===== Dashboards simples (Revisor/User) =====
use App\Http\Controllers\Revisor\DashboardController as RevisorDashboardController;
use App\Http\Controllers\User\DashboardController as UserDashboardController;

/**
 * ============================================================
 * Raiz
 * ============================================================
 */
Route::get('/', function () {
    return redirect()->route('dashboard');
});

/**
 * ============================================================
 * Google OAuth (login como user)
 * ============================================================
 */
Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])
    ->name('auth.google.redirect');

Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])
    ->name('auth.google.callback');

/**
 * ============================================================
 * Área autenticada
 * ============================================================
 */
Route::middleware(['auth'])->group(function () {

    /**
     * Rota central: redireciona conforme role
     */
    Route::get('/dashboard', function () {
        $role = (string) request()->user()->role;

        return match ($role) {
            'admin'   => redirect()->route('admin.dashboard'),
            'revisor' => redirect()->route('revisor.dashboard'),
            default   => redirect()->route('user.dashboard'),
        };
    })->name('dashboard');

    /**
     * ============================================================
     * Admin Console — URL base: /painel
     * ============================================================
     */
    Route::middleware(['role:admin'])
        ->prefix('painel')
        ->name('admin.')
        ->group(function () {

            // Dashboard do Admin
            Route::get('/dashboard', [AdminDashboardController::class, 'index'])->name('dashboard');

            // Menus principais do console
            // Quiz aponta para o "home" do módulo (index com cards e atalhos)
            Route::get('/quiz', [AdminQuizHomeController::class, 'index'])->name('quiz');
            Route::get('/traducao', [AdminTraducaoController::class, 'index'])->name('traducao');
            Route::get('/perfil', [AdminPerfilController::class, 'index'])->name('perfil');

            /**
             * ============================================================
             * Rotas internas do módulo Quiz
             * Base: /painel/quiz/*
             * Names: admin.quiz.*
             * ============================================================
             */
            Route::prefix('quiz')->name('quiz.')->group(function () {

                // Categorias
                Route::get('/categorias', [AdminQuizCategoryController::class, 'index'])->name('categories.index');
                Route::post('/categorias', [AdminQuizCategoryController::class, 'store'])->name('categories.store');
                Route::get('/categorias/{category}/editar', [AdminQuizCategoryController::class, 'edit'])->name('categories.edit');
                Route::put('/categorias/{category}', [AdminQuizCategoryController::class, 'update'])->name('categories.update');
                Route::delete('/categorias/{category}', [AdminQuizCategoryController::class, 'destroy'])->name('categories.destroy');

                // Perguntas
                Route::get('/perguntas', [AdminQuizQuestionController::class, 'index'])->name('questions.index');
                Route::get('/perguntas/criar', [AdminQuizQuestionController::class, 'create'])->name('questions.create');
                Route::post('/perguntas', [AdminQuizQuestionController::class, 'store'])->name('questions.store');
                Route::get('/perguntas/{question}/editar', [AdminQuizQuestionController::class, 'edit'])->name('questions.edit');
                Route::put('/perguntas/{question}', [AdminQuizQuestionController::class, 'update'])->name('questions.update');
                Route::delete('/perguntas/{question}', [AdminQuizQuestionController::class, 'destroy'])->name('questions.destroy');

                // Importação
                Route::get('/importar', [AdminQuizImportController::class, 'index'])->name('import.index');
                Route::get('/importar/template', [AdminQuizImportController::class, 'template'])->name('import.template');
                Route::post('/importar', [AdminQuizImportController::class, 'store'])->name('import.store');

                // Torneios
                Route::get('/torneios', [AdminTournamentController::class, 'index'])->name('torneios.index');
                Route::get('/torneios/criar', [AdminTournamentController::class, 'create'])->name('torneios.create');
                Route::post('/torneios', [AdminTournamentController::class, 'store'])->name('torneios.store');

                Route::get('/torneios/{tournament}/editar', [AdminTournamentController::class, 'edit'])->name('torneios.edit');
                Route::put('/torneios/{tournament}', [AdminTournamentController::class, 'update'])->name('torneios.update');

                Route::post('/torneios/{tournament}/publish', [AdminTournamentController::class, 'publish'])->name('torneios.publish');
                Route::post('/torneios/{tournament}/unpublish', [AdminTournamentController::class, 'unpublish'])->name('torneios.unpublish');

                Route::delete('/torneios/bulk', [AdminTournamentController::class, 'bulkDestroy'])->name('torneios.bulkDestroy');
                Route::delete('/torneios/{tournament}', [AdminTournamentController::class, 'destroy'])->name('torneios.destroy');



            });

            Route::post('torneios/{tournament}/publish', [AdminTournamentController::class, 'publish'])->name('torneios.publish');
            Route::post('torneios/{tournament}/unpublish', [AdminTournamentController::class, 'unpublish'])->name('torneios.unpublish');
    });

    /**
     * ============================================================
     * Revisor
     * ============================================================
     */
    Route::middleware(['role:revisor'])
        ->prefix('revisor')
        ->name('revisor.')
        ->group(function () {
            Route::get('/dashboard', [RevisorDashboardController::class, 'index'])->name('dashboard');
        });

    /**
     * ============================================================
     * User
     * ============================================================
     */
    Route::middleware(['auth'])->prefix('app')->name('user.')->group(function () {
    Route::get('/', [UserHomeController::class, 'index'])->name('home');

    Route::get('/dashboard', [UserHomeController::class, 'index'])->name('dashboard');

    Route::get('/quiz', [UserQuizController::class, 'index'])->name('quiz');
    Route::get('/traducoes', [UserTraducoesController::class, 'index'])->name('traducoes');
    Route::get('/artefatos', [UserArtefatosController::class, 'index'])->name('artefatos');
    Route::get('/perfil', [UserPerfilController::class, 'index'])->name('perfil');


    Route::get('/quiz', [UserQuizController::class, 'index'])->name('quiz');

    // Modo Treino (Quiz)
        Route::get('/quiz/treino', [UserTreinoQuizController::class, 'index'])->name('quiz.treino');
        Route::post('/quiz/treino/start', [UserTreinoQuizController::class, 'start'])->name('quiz.treino.start');
        Route::post('/quiz/treino/answer', [UserTreinoQuizController::class, 'answer'])->name('quiz.treino.answer');
        Route::post('/quiz/treino/reset', [UserTreinoQuizController::class, 'reset'])->name('quiz.treino.reset');

        Route::get('/traducoes', [UserTraducoesController::class, 'index'])->name('traducoes');
        Route::get('/artefatos', [UserArtefatosController::class, 'index'])->name('artefatos');
        Route::get('/perfil', [UserPerfilController::class, 'index'])->name('perfil');

    // ============================================================
        // Quiz - Modo Amizade
        // ============================================================
        Route::get('/quiz/amizade', [UserAmizadeQuizController::class, 'index'])
            ->name('quiz.amizade.index');

        Route::post('/quiz/amizade/criar', [UserAmizadeQuizController::class, 'create'])
            ->name('quiz.amizade.create');

        Route::post('/quiz/amizade/entrar', [UserAmizadeQuizController::class, 'join'])
            ->name('quiz.amizade.join');

        Route::post('/quiz/amizade/sair', [UserAmizadeQuizController::class, 'leave'])
            ->name('quiz.amizade.leave');

        Route::get('/quiz/amizade/sala/{code}', [UserAmizadeQuizController::class, 'room'])
            ->name('quiz.amizade.room');

        Route::post('/quiz/amizade/sala/{code}/start', [UserAmizadeQuizController::class, 'start'])
            ->name('quiz.amizade.start');

        Route::get('/quiz/amizade/sala/{code}/state', [UserAmizadeQuizController::class, 'state'])
            ->name('quiz.amizade.state');

        Route::post('/quiz/amizade/sala/{code}/answer', [UserAmizadeQuizController::class, 'answer'])
            ->name('quiz.amizade.answer');


            // ============================================================
            // Quiz - Torneio (User)  /app/quiz/torneio/*
            // Names: user.quiz.torneio.*
            // ============================================================
            Route::prefix('quiz/torneio')->name('quiz.torneio.')->group(function () {
                Route::get('/', [TorneioQuizController::class, 'index'])->name('index');

                Route::get('/{tournament}', [TorneioQuizController::class, 'show'])
                    ->whereNumber('tournament')
                    ->name('show');

                Route::post('/{tournament}/enroll', [TorneioQuizController::class, 'enroll'])
                    ->whereNumber('tournament')
                    ->name('enroll');

                Route::get('/{tournament}/play', [TorneioQuizController::class, 'play'])
                    ->whereNumber('tournament')
                    ->name('play');

                Route::post('/{tournament}/start', [TorneioQuizController::class, 'start'])
                    ->whereNumber('tournament')
                    ->name('start');

                Route::post('/{tournament}/answer', [TorneioQuizController::class, 'answer'])
                    ->whereNumber('tournament')
                    ->name('answer');

                Route::post('/{tournament}/reset', [TorneioQuizController::class, 'reset'])
                    ->whereNumber('tournament')
                    ->name('reset');
            });


    });





});

/**
 * ============================================================
 * Breeze auth (login, logout, register etc.)
 * ============================================================
 */
require __DIR__ . '/auth.php';
