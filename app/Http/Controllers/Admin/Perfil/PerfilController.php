<?php

namespace App\Http\Controllers\Admin\Perfil;

use App\Http\Controllers\Controller;

class PerfilController extends Controller
{
    public function index()
    {
        return view('admin.perfil.index');
    }
}
