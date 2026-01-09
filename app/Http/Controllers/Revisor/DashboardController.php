<?php

namespace App\Http\Controllers\Revisor;

use App\Http\Controllers\Controller;

class DashboardController extends Controller
{
    public function __invoke()
    {
        return view('revisor.dashboard');
    }
}
