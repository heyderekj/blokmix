<?php

use App\Http\Controllers\Api\LibraryController;
use App\Models\LibrarySite;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Site-library bundles kept in the repo (database/library/<slug>/: upload.json and the screenshots it names), imported
// on the server through the same checks as an upload, as one of the people who run Blokmix. --publish shows them.
Artisan::command('library:import {dir=database/library} {--publish}', function (string $dir) {
    $owner = User::query()->whereIn('email', config('blokmix.owners'))->first();
    if (! $owner) {
        $this->error('No account for any of the people who run Blokmix (BLOKMIX_OWNERS).');

        return 1;
    }
    auth()->setUser($owner);
    $root = base_path($dir);
    foreach (glob("{$root}/*/upload.json") ?: [] as $json) {
        $folder = dirname($json);
        $zipPath = tempnam(sys_get_temp_dir(), 'bundle').'.zip';
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE);
        foreach (glob("{$folder}/*.{webp,png,jpg,jpeg}", GLOB_BRACE) ?: [] as $image) {
            $zip->addFile($image, basename($image));
        }
        $zip->close();
        $request = Request::create('/api/library/sites', 'POST', [], [], [
            'site' => new UploadedFile($json, 'upload.json', 'application/json', null, true),
            'bundle' => new UploadedFile($zipPath, 'bundle.zip', 'application/zip', null, true),
        ]);
        $request->setUserResolver(fn () => $owner);
        try {
            $site = app(LibraryController::class)->store($request)->getData(true);
            $this->line("Imported {$site['slug']}: ".count($site['pages']).' page(s)');
            if ($this->option('publish')) {
                LibrarySite::where('slug', $site['slug'])->update(['status' => 'published']);
                $this->line("Published {$site['slug']}");
            }
        } catch (ValidationException $e) {
            $this->error(basename($folder).': '.json_encode($e->errors()));
        } finally {
            @unlink($zipPath);
        }
    }
})->purpose('Import the site-library bundles kept in the repo (and publish them)');
