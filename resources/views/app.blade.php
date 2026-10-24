<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {{-- Tells app.tsx it's an Inertia page here, not the Vite-only board. --}}
    <meta name="blokmix-host" content="laravel" />
    <title inertia>{{ config('app.name') }}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23ff6aa8'/><g fill='%231b0d14'><rect x='6' y='6' width='9' height='9' rx='2.5'/><rect x='17' y='6' width='9' height='9' rx='2.5'/><rect x='17' y='17' width='9' height='9' rx='2.5'/></g><rect x='7' y='18' width='7' height='7' rx='2' fill='none' stroke='%231b0d14' stroke-width='1.5' stroke-dasharray='2 2' opacity='.5'/></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    @viteReactRefresh
    @vite('resources/js/app.tsx')
    @inertiaHead
  </head>
  <body>
    @inertia
  </body>
</html>
