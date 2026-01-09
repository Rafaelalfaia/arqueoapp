<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PerfilController extends Controller
{
    public function index(Request $request)
    {
        return view('user.perfil.index', [
            'user' => $request->user(),
        ]);
    }
}
