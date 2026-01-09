<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TournamentResult extends Model
{
    protected $fillable = [
        'tournament_id',
        'user_id',
        'score',
        'correct_count',
        'time_ms',
        'rank',
        'prize_awarded',
        'prize_tx_id',
    ];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function prizeTx(): BelongsTo
    {
        return $this->belongsTo(DiamondTransaction::class, 'prize_tx_id');
    }
}
