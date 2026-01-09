<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;

class TraducoesController extends Controller
{
    public function index()
    {
        return view('user.traducoes.index');
    }
}
