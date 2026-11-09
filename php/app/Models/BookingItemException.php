<?php

namespace App\Models;

use RuntimeException;

class BookingItemException extends RuntimeException
{
    public function __construct(public readonly int $itemIndex, string $reason)
    {
        parent::__construct($reason);
    }
}
