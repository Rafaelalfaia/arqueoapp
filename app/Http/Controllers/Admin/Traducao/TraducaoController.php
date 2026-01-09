<?php

namespace App\Http\Controllers\Admin\Traducao;

use App\Http\Controllers\Controller;

class TraducaoController extends Controller
{
    public function index()
    {
        return view('admin.traducao.index');
    }
}
