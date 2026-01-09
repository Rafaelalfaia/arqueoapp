<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;

class ArtefatosController extends Controller
{
    public function index()
    {
        return view('user.artefatos.index');
    }
}
