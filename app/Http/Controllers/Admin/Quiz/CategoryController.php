<?php

namespace App\Http\Controllers\Admin\Quiz;

use App\Http\Controllers\Controller;
use App\Models\QuizCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = QuizCategory::query()
            ->withCount('questions')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate(15);

        return view('admin.quiz.categories.index', compact('categories'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140', 'unique:quiz_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $data['slug'] = $data['slug'] ?: Str::slug($data['name']);
        $data['is_active'] = (bool) ($data['is_active'] ?? true);
        $data['sort_order'] = (int) ($data['sort_order'] ?? 0);
        $data['created_by'] = $request->user()->id;

        QuizCategory::create($data);

        return redirect()->route('admin.quiz.categories.index')->with('success', 'Categoria criada com sucesso.');
    }

    public function edit(QuizCategory $category)
    {
        return view('admin.quiz.categories.edit', compact('category'));
    }

    public function update(Request $request, QuizCategory $category)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140', 'unique:quiz_categories,slug,' . $category->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $data['slug'] = $data['slug'] ?: Str::slug($data['name']);
        $data['is_active'] = (bool) ($data['is_active'] ?? false);
        $data['sort_order'] = (int) ($data['sort_order'] ?? 0);

        $category->update($data);

        return redirect()->route('admin.quiz.categories.index')->with('success', 'Categoria atualizada com sucesso.');
    }

    public function destroy(QuizCategory $category)
    {
        $category->delete();

        return redirect()->route('admin.quiz.categories.index')->with('success', 'Categoria removida.');
    }
}
