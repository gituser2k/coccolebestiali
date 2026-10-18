<?php

use App\Models\Booking;
use Illuminate\Support\Facades\Schedule;

Schedule::call(static function (): void {
    (new Booking)->reconcile();
})->everyFiveMinutes()->name('reconcile-bookings')->withoutOverlapping();
