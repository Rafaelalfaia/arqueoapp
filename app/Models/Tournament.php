<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tournament extends Model
{
    public const TYPE_COMMON  = 'common';
    public const TYPE_SPECIAL = 'special';

    public const STATUS_DRAFT     = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_RUNNING   = 'running';
    public const STATUS_FINISHED  = 'finished';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'title',
        'type',
        'status',
        'cover_path',

        'entry_fee',

        'prize_pool_fixed',
        'special_multiplier',

        'question_count',
        'max_players',
        'scheduled_at',

        'split_first',
        'split_second',
        'split_third',

        'created_by',
        'published_at',
    ];

    protected $casts = [
        'entry_fee'           => 'integer',
        'prize_pool_fixed'    => 'integer',
        'special_multiplier'  => 'integer',
        'question_count'      => 'integer',
        'max_players'         => 'integer',
        'split_first'         => 'integer',
        'split_second'        => 'integer',
        'split_third'         => 'integer',
        'scheduled_at'        => 'datetime',
        'published_at'        => 'datetime',
    ];

    /** Relações */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(TournamentEntry::class);
    }

    public function results(): HasMany
    {
        return $this->hasMany(TournamentResult::class);
    }

    /** Helpers */
    public function isCommon(): bool
    {
        return $this->type === self::TYPE_COMMON;
    }

    public function isSpecial(): bool
    {
        return $this->type === self::TYPE_SPECIAL;
    }

    public function splitTotal(): int
    {
        return (int)($this->split_first ?? 0)
            + (int)($this->split_second ?? 0)
            + (int)($this->split_third ?? 0);
    }

    /** Scopes úteis */
    public function scopePublished(Builder $q): Builder
    {
        return $q->where('status', self::STATUS_PUBLISHED);
    }

    public function scopeActive(Builder $q): Builder
    {
        return $q->whereIn('status', [self::STATUS_PUBLISHED, self::STATUS_RUNNING]);
    }
}
