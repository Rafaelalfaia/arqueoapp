<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class DiamondTransaction extends Model
{
    protected $table = 'diamond_transactions';

    protected $fillable = [
        'user_id',
        'delta',
        'balance_before',
        'balance_after',
        'reason',
        'related_type',
        'related_id',
        'meta',
    ];

    protected $casts = [
        'user_id'         => 'integer',
        'delta'           => 'integer',
        'balance_before'  => 'integer',
        'balance_after'   => 'integer',
        'meta'            => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function related(): MorphTo
    {
        return $this->morphTo('related');
    }


}
