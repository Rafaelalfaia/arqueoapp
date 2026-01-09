<?php

namespace App\Services;

use App\Models\DiamondTransaction;
use App\Models\TournamentEntry;
use App\Models\TournamentResult;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DiamondWalletService
{
    public function debitEntry(User $user, TournamentEntry $entry, int $amount): DiamondTransaction
    {
        if ($amount <= 0) {
            throw new RuntimeException('Valor inválido para débito.');
        }

        return DB::transaction(function () use ($user, $entry, $amount) {
            $u = User::query()->lockForUpdate()->findOrFail($user->id);

            $before = (int) $u->diamonds_balance;
            if ($before < $amount) {
                throw new RuntimeException('Saldo insuficiente.');
            }

            $after = $before - $amount;
            $u->diamonds_balance = $after;
            $u->save();

            return DiamondTransaction::create([
                'user_id' => $u->id,
                'delta' => -$amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'reason' => 'tournament_entry',
                'related_type' => TournamentEntry::class,
                'related_id' => $entry->id,
                'meta' => [
                    'tournament_id' => $entry->tournament_id,
                    'entry_id' => $entry->id,
                ],
            ]);
        });
    }

    public function creditPrize(User $user, TournamentResult $result, int $amount): DiamondTransaction
    {
        if ($amount <= 0) {
            throw new RuntimeException('Valor inválido para crédito.');
        }

        return DB::transaction(function () use ($user, $result, $amount) {
            $u = User::query()->lockForUpdate()->findOrFail($user->id);

            $before = (int) $u->diamonds_balance;
            $after = $before + $amount;

            $u->diamonds_balance = $after;
            $u->save();

            return DiamondTransaction::create([
                'user_id' => $u->id,
                'delta' => $amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'reason' => 'tournament_prize',
                'related_type' => TournamentResult::class,
                'related_id' => $result->id,
                'meta' => [
                    'tournament_id' => $result->tournament_id,
                    'result_id' => $result->id,
                    'rank' => $result->rank,
                ],
            ]);
        });
    }
}
