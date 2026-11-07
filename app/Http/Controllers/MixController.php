<?php

namespace App\Http\Controllers;

use App\Enums\MixRole;
use App\Models\Mix;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mixes as pages: yours and the ones shared with you, and one open on the
 * board. "local" is the mix kept in this browser only.
 */
class MixController extends Controller
{
    /**
     * Your mixes as a gallery: enough of each to draw it small (the first page's sections and the style guide, resolved
     * in the browser), its versions' letters and statuses, open marks, and who owns the ones shared with you.
     */
    public function index(Request $request): Response
    {
        $mixes = $request->user()->mixes()->withCount('versions')->latest('updated_at')
            ->get(['mixes.id', 'mixes.short', 'mixes.name', 'mixes.created_at', 'mixes.updated_at', 'mixes.archived_at', 'mixes.data']);
        $ids = $mixes->pluck('id');
        // A card's rings are its drafts (A, B, C); a mix from before drafts shows its versions.
        $drafts = DB::table('mix_drafts')->whereIn('mix_id', $ids)->orderBy('letter')
            ->get(['mix_id', 'letter', 'node->status as status'])->groupBy('mix_id');
        $heads = DB::table('mix_versions')->whereIn('mix_id', $ids)->orderBy('letter')
            ->get(['mix_id', 'letter', 'node->status as status'])->groupBy('mix_id');
        $owners = DB::table('mix_members')->join('users', 'users.id', '=', 'mix_members.user_id')
            ->whereIn('mix_id', $ids)->where('role', MixRole::Owner->value)->pluck('users.name', 'mix_id');

        return Inertia::render('mixes/index', [
            'mixes' => $mixes->map(function (Mix $m) use ($heads, $drafts, $owners) {
                $site = $m->data['site'] ?? null;
                $page = $site['pages'][0] ?? null;
                $slots = collect($page['slots'] ?? []);
                $sections = $slots->pluck('type');
                // The page's main heading, to set in the mix's own display font on its card.
                $lead = $slots->first(fn ($s) => in_array($s['type'] ?? null, ['hero', 'header'], true));
                $fields = $lead ? [...($m->data['content']['fields'][$lead['type']] ?? []), ...($lead['words'] ?? [])] : [];
                $heading = $fields['headline'] ?? $fields['heading'] ?? null;
                if ($page && ($page['show']['nav'] ?? true) && isset($site['shared']['nav'])) {
                    $sections->prepend($site['shared']['nav']['type'] ?? 'nav');
                }
                if ($page && ($page['show']['footer'] ?? true) && isset($site['shared']['footer'])) {
                    $sections->push($site['shared']['footer']['type'] ?? 'footer');
                }

                return [
                    'id' => $m->id,
                    'short' => $m->short,
                    'name' => $m->name,
                    'created_at' => $m->created_at,
                    'updated_at' => $m->updated_at,
                    'versions' => $m->versions_count,
                    'heading' => is_string($heading) ? Str::limit(trim($heading), 80) : null,
                    'role' => $m->pivot->role,
                    'archived' => $m->isArchived(),
                    'owner' => $owners[$m->id] ?? null,
                    'pages' => count($site['pages'] ?? []),
                    'sections' => $sections->filter()->values(),
                    'guide' => $m->data['guide'] ?? null,
                    'drafts' => count($drafts[$m->id] ?? []),
                    'heads' => ($drafts[$m->id] ?? $heads[$m->id] ?? collect())->map(fn ($v) => ['letter' => $v->letter, 'status' => trim((string) ($v->status ?? ''), '"') ?: 'in-progress'])->values(),
                    'marks' => collect($m->data['notes'] ?? [])->filter(fn ($n) => in_array($n['status'] ?? 'open', ['open', 'in_progress'], true))->count(),
                ];
            }),
        ]);
    }

    public function local(Request $request): Response
    {
        return Inertia::render('mixes/show', ['mix' => ['id' => 'local', 'paid' => $request->user()->hasPlus()], 'role' => MixRole::Owner->value]);
    }

    public function show(Request $request, Mix $mix): Response
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);

        return Inertia::render('mixes/show', ['mix' => $mix->load('versions', 'drafts')->toBoard(), 'role' => $role->value]);
    }

    /** An old /mixes/{ulid} address: forward to the mix's short one (members only, like the board). */
    public function moved(Request $request, Mix $mix): RedirectResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);

        return redirect()->route('mixes.show', $mix, 301);
    }

    /** A new mix you own; the board fills in whatever it doesn't bring on first save. */
    public function store(Request $request): RedirectResponse
    {
        // A new mix can start from a style guide (a saved one, or another mix's), or from a starter mix's pages and
        // guide; it keeps its own copy.
        $request->validate([
            'guide' => ['nullable', 'array'],
            'guide.base' => ['required_with:guide', 'array'],
            'site' => ['nullable', 'array'],
            'site.pages' => ['required_with:site', 'array', 'min:1'],
            'name' => ['nullable', 'string', 'max:120'],
        ]);
        if ($why = $request->user()->mixRefusal()) {
            return back()->withErrors(['mix' => $why]);
        }
        // as sent: validate() keeps only the keys that have rules
        $data = array_filter(['guide' => $request->input('guide'), 'site' => $request->input('site')]);
        $mix = Mix::create(['name' => trim((string) $request->input('name')) ?: 'Untitled mix', 'data' => $data ?: null]);
        $mix->admit($request->user(), MixRole::Owner);

        return redirect()->route('mixes.show', $mix);
    }
}
