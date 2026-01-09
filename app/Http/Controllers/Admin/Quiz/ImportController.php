<?php

namespace App\Http\Controllers\Admin\Quiz;

use App\Http\Controllers\Controller;
use App\Models\QuizCategory;
use App\Models\QuizQuestion;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ImportController extends Controller
{
    public function index()
    {
        return view('admin.quiz.import.index');
    }

    public function template()
    {
        $headers = [
            'categoria',
            'question',
            'option_a',
            'option_b',
            'option_c',
            'option_d',
            'option_e',
            'correct_option',
            'explanation',
            'status',
        ];

        $sample = [
            'Arqueologia Geral',
            'Qual é o objetivo principal da arqueologia?',
            'Estudar fósseis',
            'Estudar vestígios materiais de sociedades humanas',
            'Estudar estrelas',
            'Estudar placas tectônicas',
            'Estudar animais atuais',
            'B',
            'A arqueologia foca em vestígios materiais.',
            'draft',
        ];

        $csv = implode(';', $headers) . "\n" . implode(';', array_map([$this, 'escapeCsv'], $sample)) . "\n";

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="template_quiz_import.csv"',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Excel (XLSX) será implementado depois. Por enquanto: CSV/TXT (abre no Excel).
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $file = $data['file'];
        $path = $file->getRealPath();
        if (!$path) {
            return back()->withErrors(['file' => 'Arquivo inválido.']);
        }

        $batchId = (string) Str::uuid();
        $delimiter = $this->detectDelimiter($path);

        $handle = fopen($path, 'r');
        if ($handle === false) {
            return back()->withErrors(['file' => 'Não foi possível ler o arquivo.']);
        }

        $header = fgetcsv($handle, 0, $delimiter);
        if (!is_array($header)) {
            fclose($handle);
            return back()->withErrors(['file' => 'CSV sem cabeçalho válido.']);
        }

        $map = $this->mapHeader($header);

        $required = ['categoria','question','option_a','option_b','option_c','option_d','option_e','correct_option'];
        foreach ($required as $key) {
            if (!array_key_exists($key, $map)) {
                fclose($handle);
                return back()->withErrors(['file' => "Coluna obrigatória ausente no CSV: {$key}"]);
            }
        }

        $imported = 0;
        $errors = [];
        $rowNumber = 1; // cabeçalho = 1

        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rowNumber++;

            if ($this->isBlankRow($row)) {
                continue;
            }

            $categoria = trim((string) ($row[$map['categoria']] ?? ''));
            $question  = trim((string) ($row[$map['question']] ?? ''));
            $a = trim((string) ($row[$map['option_a']] ?? ''));
            $b = trim((string) ($row[$map['option_b']] ?? ''));
            $c = trim((string) ($row[$map['option_c']] ?? ''));
            $d = trim((string) ($row[$map['option_d']] ?? ''));
            $e = trim((string) ($row[$map['option_e']] ?? ''));
            $correct = strtoupper(trim((string) ($row[$map['correct_option']] ?? '')));

            $explanation = array_key_exists('explanation', $map) ? trim((string) ($row[$map['explanation']] ?? '')) : null;
            $status = array_key_exists('status', $map) ? trim((string) ($row[$map['status']] ?? '')) : 'draft';
            $status = $status !== '' ? $status : 'draft';

            if ($categoria === '' || $question === '' || $a === '' || $b === '' || $c === '' || $d === '' || $e === '') {
                $errors[] = "Linha {$rowNumber}: campos obrigatórios vazios.";
                continue;
            }

            if (!in_array($correct, ['A','B','C','D','E'], true)) {
                $errors[] = "Linha {$rowNumber}: correct_option inválido ({$correct}). Use A, B, C, D ou E.";
                continue;
            }

            if (!in_array($status, ['draft','published','archived'], true)) {
                $errors[] = "Linha {$rowNumber}: status inválido ({$status}). Use draft, published ou archived.";
                continue;
            }

            $catSlug = Str::slug($categoria);
            $category = QuizCategory::firstOrCreate(
                ['slug' => $catSlug],
                [
                    'name' => $categoria,
                    'is_active' => true,
                    'sort_order' => 0,
                    'created_by' => $request->user()->id,
                ]
            );

            QuizQuestion::create([
                'quiz_category_id' => $category->id,
                'question' => $question,
                'option_a' => $a,
                'option_b' => $b,
                'option_c' => $c,
                'option_d' => $d,
                'option_e' => $e,
                'correct_option' => $correct,
                'explanation' => $explanation ?: null,
                'status' => $status,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
                'import_batch_id' => $batchId,
                'import_row' => $rowNumber,
                'import_source' => 'csv',
            ]);

            $imported++;
        }

        fclose($handle);

        $msg = "Importação concluída. Importadas: {$imported}. Lote: {$batchId}.";
        if (count($errors) > 0) {
            // limita para não explodir a tela
            $errors = array_slice($errors, 0, 10);
            return back()->with('success', $msg)->with('import_errors', $errors);
        }

        return back()->with('success', $msg);
    }

    private function detectDelimiter(string $path): string
    {
        $firstLine = '';
        $h = fopen($path, 'r');
        if ($h !== false) {
            $firstLine = (string) fgets($h);
            fclose($h);
        }
        $sc = substr_count($firstLine, ';');
        $cm = substr_count($firstLine, ',');
        return $sc >= $cm ? ';' : ',';
    }

    private function mapHeader(array $header): array
    {
        $map = [];
        foreach ($header as $i => $col) {
            $key = strtolower(trim((string) $col));

            // normaliza nomes comuns
            $key = match ($key) {
                'category' => 'categoria',
                'pergunta' => 'question',
                'enunciado' => 'question',
                default => $key,
            };

            $map[$key] = $i;
        }
        return $map;
    }

    private function isBlankRow(array $row): bool
    {
        foreach ($row as $v) {
            if (trim((string) $v) !== '') return false;
        }
        return true;
    }

    private function escapeCsv(string $v): string
    {
        // escape simples para CSV com separador ;
        $v = str_replace('"', '""', $v);
        if (str_contains($v, ';') || str_contains($v, "\n") || str_contains($v, '"')) {
            return '"' . $v . '"';
        }
        return $v;
    }
}
