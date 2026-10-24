<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The waitlist, for the people who run Blokmix (Gate run-blokmix): who joined from blokmix.com, from which form and
 * when, as a page and a CSV. Everyone else gets a 404, as if it weren't here. Joining is Api\WaitlistController.
 */
class WaitlistController extends Controller
{
    public function index(): Response
    {
        $this->owner();

        return Inertia::render('waitlist/index', [
            'people' => DB::table('waitlist')->latest()->get(['id', 'email', 'source', 'created_at']),
        ]);
    }

    public function export(): StreamedResponse
    {
        $this->owner();

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['email', 'source', 'joined']);
            foreach (DB::table('waitlist')->oldest()->cursor() as $row) {
                fputcsv($out, [$row->email, $row->source, $row->created_at]);
            }
            fclose($out);
        }, 'blokmix-waitlist-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Take someone off the list (when they ask). */
    public function destroy(int $id): RedirectResponse
    {
        $this->owner();
        DB::table('waitlist')->where('id', $id)->delete();

        return redirect()->route('waitlist.index');
    }

    private function owner(): void
    {
        abort_unless(Gate::allows('run-blokmix'), 404);
    }
}
