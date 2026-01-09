<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizQuestion extends Model
{
    use SoftDeletes;

    public const OPTIONS = ['A','B','C','D','E'];

    protected $fillable = [
        'quiz_category_id',
        'question',
        'option_a',
        'option_b',
        'option_c',
        'option_d',
        'option_e',
        'correct_option',
        'explanation',
        'status',
        'created_by',
        'updated_by',
        'approved_by',
        'approved_at',
        'import_batch_id',
        'import_row',
        'import_source',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'import_row' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(QuizCategory::class, 'quiz_category_id');
    }

    public function getCorrectTextAttribute(): string
    {
        return match ($this->correct_option) {
            'A' => $this->option_a,
            'B' => $this->option_b,
            'C' => $this->option_c,
            'D' => $this->option_d,
            'E' => $this->option_e,
            default => '',
        };
    }
}
