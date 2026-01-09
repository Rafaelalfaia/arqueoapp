<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Revisor = 'revisor';
    case User = 'user';

    public static function values(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }
}
