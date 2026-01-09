<?php

namespace App\Http\Controllers\Admin\Quiz;

use App\Http\Controllers\Controller;
use App\Models\QuizCategory;
use App\Models\QuizQuestion;

class QuizController extends Controller
{
    public function index()
    {
        $stats = [
            'categories' => QuizCategory::count(),
            'questions'  => QuizQuestion::count(),
            'published'  => QuizQuestion::where('status', 'published')->count(),
        ];

        return view('admin.quiz.index', compact('stats'));
    }
}
