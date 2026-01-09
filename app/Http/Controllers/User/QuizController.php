<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;

class QuizController extends Controller
{
    public function index()
    {
        return view('user.quiz.index');
    }
}
