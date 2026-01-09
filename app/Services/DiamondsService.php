<?php

namespace App\Services;

use App\Models\DiamondTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class DiamondLedger
{
    /**
     * Aplica delta (+ crédito / - débito) com lock no usuário.
     * Idempotência opcional via meta['idempotency_key'] (bom para retry/clique duplo).
     */
    public function apply(
        User $user,
        int $delta,
        string $reason,
        ?Model $related = null,
        array $meta = [],
        ?string $idempotencyKey = null
    ): DiamondTransaction {
        if ($delta === 0) {
            throw ValidationException::withMessages([
                'diamonds' => 'Delta inválido: não pode ser 0.',
            ]);
        }

        return DB::transaction(function () use ($user, $delta, $reason, $related, $meta, $idempotencyKey) {

            // Idempotência "best effort" antes do lock (rápido)
            if ($idempotencyKey !== null && $idempotencyKey !== '') {
                $existing = DiamondTransaction::query()
                    ->where('user_id', $user->getKey())
                    ->where('reason', $reason)
                    ->when($related, function ($q) use ($related) {
                        $q->where('related_type', $related->getMorphClass())
                          ->where('related_id', $related->getKey());
                    }, function ($q) {
                        $q->whereNull('related_type')->whereNull('related_id');
                    })
                    ->where('meta->idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            // Lock do usuário para evitar corrida de saldo
            $lockedUser = User::query()
                ->whereKey($user->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $before = (int)($lockedUser->diamonds_balance ?? 0);
            $after  = $before + $delta;

            if ($after < 0) {
                throw ValidationException::withMessages([
                    'diamonds' => 'Saldo insuficiente para esta operação.',
                ]);
            }

            if ($idempotencyKey !== null && $idempotencyKey !== '') {
                $meta['idempotency_key'] = $idempotencyKey;
            }

            /** @var DiamondTransaction $tx */
            $tx = new DiamondTransaction([
                'user_id'        => $lockedUser->getKey(),
                'delta'          => $delta,
                'balance_before' => $before,
                'balance_after'  => $after,
                'reason'         => $reason,
                'meta'           => $meta,
            ]);

            if ($related) {
                $tx->related()->associate($related);
            }

            $tx->save();

            $lockedUser->diamonds_balance = $after;
            $lockedUser->save();

            return $tx;
        }, 3);
    }

    public function debit(
        User $user,
        int $amount,
        string $reason,
        ?Model $related = null,
        array $meta = [],
        ?string $idempotencyKey = null
    ): DiamondTransaction {
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'diamonds' => 'Valor de débito inválido.',
            ]);
        }

        return $this->apply($user, -$amount, $reason, $related, $meta, $idempotencyKey);
    }

    public function credit(
        User $user,
        int $amount,
        string $reason,
        ?Model $related = null,
        array $meta = [],
        ?string $idempotencyKey = null
    ): DiamondTransaction {
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'diamonds' => 'Valor de crédito inválido.',
            ]);
        }

        return $this->apply($user, $amount, $reason, $related, $meta, $idempotencyKey);
    }
}
