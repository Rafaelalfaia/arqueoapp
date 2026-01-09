<?php

namespace App\Http\Controllers\Admin\Quiz;

use App\Http\Controllers\Controller;
use App\Models\QuizCategory;
use App\Models\QuizQuestion;
use Illuminate\Http\Request;

class QuestionController extends Controller
{
    public function index(Request $request)
    {
        $q = (string) $request->query('q', '');
        $status = (string) $request->query('status', '');
        $categoryId = $request->query('category_id');

        $categories = QuizCategory::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        $questions = QuizQuestion::query()
            ->with('category:id,name')
            ->when($q !== '', fn($qq) => $qq->where('question', 'ilike', '%' . $q . '%'))
            ->when($status !== '', fn($qq) => $qq->where('status', $status))
            ->when($categoryId, fn($qq) => $qq->where('quiz_category_id', $categoryId))
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.quiz.questions.index', compact('questions', 'categories', 'q', 'status', 'categoryId'));
    }

    public function create()
    {
        $categories = QuizCategory::query()->orderBy('name')->get(['id', 'name']);

        return view('admin.quiz.questions.create', compact('categories'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'quiz_category_id' => ['required', 'integer', 'exists:quiz_categories,id'],
            'question' => ['required', 'string'],
            'option_a' => ['required', 'string'],
            'option_b' => ['required', 'string'],
            'option_c' => ['required', 'string'],
            'option_d' => ['required', 'string'],
            'option_e' => ['required', 'string'],
            'correct_option' => ['required', 'in:A,B,C,D,E'],
            'explanation' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,published,archived'],
        ]);

        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        QuizQuestion::create($data);

        return redirect()->route('admin.quiz.questions.index')->with('success', 'Pergunta criada com sucesso.');
    }

    public function edit(QuizQuestion $question)
    {
        $categories = QuizCategory::query()->orderBy('name')->get(['id', 'name']);

        return view('admin.quiz.questions.edit', compact('question', 'categories'));
    }

    public function update(Request $request, QuizQuestion $question)
    {
        $data = $request->validate([
            'quiz_category_id' => ['required', 'integer', 'exists:quiz_categories,id'],
            'question' => ['required', 'string'],
            'option_a' => ['required', 'string'],
            'option_b' => ['required', 'string'],
            'option_c' => ['required', 'string'],
            'option_d' => ['required', 'string'],
            'option_e' => ['required', 'string'],
            'correct_option' => ['required', 'in:A,B,C,D,E'],
            'explanation' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,published,archived'],
        ]);

        $data['updated_by'] = $request->user()->id;

        $question->update($data);

        return redirect()->route('admin.quiz.questions.index')->with('success', 'Pergunta atualizada com sucesso.');
    }

    public function destroy(QuizQuestion $question)
    {
        $question->delete();

        return redirect()->route('admin.quiz.questions.index')->with('success', 'Pergunta removida.');
    }
}
