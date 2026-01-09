<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TournamentEntry extends Model
{
    protected $fillable = [
        'tournament_id',
        'user_id',
        'paid_tx_id',
        'status',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function paidTx(): BelongsTo
    {
        return $this->belongsTo(DiamondTransaction::class, 'paid_tx_id');
    }
}
