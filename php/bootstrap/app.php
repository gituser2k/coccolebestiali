<?php

use App\Http\Middleware\RejectEmailHeaderInjection;
use App\Http\Middleware\RequireAdminSession;
use App\Http\Middleware\RequirePortalSession;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/api.php',
        api: null,
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->appendToGroup('web', RejectEmailHeaderInjection::class);
        $middleware->appendToGroup('web', SecurityHeaders::class);
        $middleware->alias([
            'portal.auth' => RequirePortalSession::class,
            'portal.admin' => RequireAdminSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
