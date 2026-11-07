# Blokmix

Start a website from layouts, skins and palettes that already work (built in, or clipped from sites you like),
mix them into something that's yours under one style guide, and hand a packet to an agent that builds Astro or
Next.js. What comes back (captures, an agent's changes) should only add options, never change your picks
(`docs/simple-vision.md`). Frontend only for now; the layout (`resources/js`, `@/` alias,
`pages/`) mirrors the Laravel React starter kit so it can move into Laravel +
Inertia on Laravel Cloud later.

## Commands

- `npm run dev`: Vite on http://localhost:5173 (Browser pane: launch config "blokmix")
- `npm test`: Vitest (core logic, clip lint, exporters)
- `npm run typecheck`, `npm run build`
- `npm run export:demo`: writes the seeded demo packet to `.out/`

## Laravel (phase 4)

Laravel 13 + Inertia 3 sit at the repo root around the same `resources/js`. The board still runs on its own:
- `npm run dev:laravel` (or `composer dev`): `php artisan serve` on http://localhost:8000 plus Vite on 5174.
  `/` is the gallery of your mixes (signed in), `/{short}` is a mix's board (`mixes.short`, e.g. `/k3x9`: 4+ letters and digits
  with at least one digit, `Mix::SHORT_PATTERN`; old `/mixes/{ulid}` addresses forward there), `/local` the browser-only mix. `resources/views/app.blade.php` marks the page
  (`<meta name="blokmix-host">`, `lib/host.ts` `isHosted()`), and `app.tsx` then mounts Inertia pages from
  `resources/js/pages/` instead of the bare board.
- `npm run build:laravel` writes `public/build`; `npm run build` still writes the Vite-only `dist/`.
- `php artisan test` runs the PHP feature tests (`tests/Feature`); Vitest only picks up `tests/**/*.test.ts`.
- Mixes are saved in the database (`mixes`: name + `data` json with site, guide, content, notes, heads, draftId;
  `mix_versions`: one row per version node; `mix_drafts`: one row per draft, at most `Mix::MAX_DRAFTS`). `/{short}` hands the board the mix as props, and
  `lib/mixSync.ts` `openMix` points the store's persist at it: saves go out 800ms after a change, one at a
  time, with only what changed (`PUT /api/mixes/{id}`, `If-Match: "<lock>"`; a stale lock gets 412 and the
  mix as it is now, which replaces what's on screen). The store's `merge` migrations run on server data too.
  This device's view (ui, camera) and unsent edits stay in localStorage (`blokmix:mix:<id>`), so offline
  edits survive a reload. `/local` is the browser-only mix (the Vite-only app's), which the index can
  copy to the server ("Save to your mixes").
- `/api/*` skips Laravel's TrimStrings and ConvertEmptyStringsToNull: words are saved exactly as written.
- Laravel Cloud: app `blokmix` (org Testament Made, us-east-1), environment `production` at
  https://blokmix-production-l9esns.laravel.cloud with Postgres 18. Pushing `main` deploys. Build runs
  `npm run build:laravel`; deploy runs `php artisan migrate --force` and `php artisan optimize`. The `cloud`
  CLI (`composer global` laravel/cloud-cli) is signed in: `cloud deploy blokmix production`, `cloud cmd:run`.
- Accounts (Fortify: sign up, sign in, sign out; Inertia pages in `pages/auth/`). Sign-up is open. Password reset
  emails go through Resend (Cloud's Email resource, sender hello@notifications.blokmix.com; DNS on Cloudflare). The board takes your account's name for marks and versions.
- `/` is your mixes when signed in (`/mixes` redirects there): a gallery of cards, each drawing its first page in its own
  style guide (`ui/mixes/MixThumb.tsx`, its main heading in the mix's display font) with its versions' status rings.
  Cards rename in place (`PATCH /api/mixes/{id}/name`, owners and editors, no lock bump) and duplicate
  (`POST /api/mixes/{id}/duplicate`: data, versions and uploads into a new mix you own); the gallery searches and sorts. `MarkSignedIn` sets a plain `blokmix_signed_in=1`
  cookie while you're signed in, so the edge in front of blokmix.com can send `/` to the app or the website.
- Password reset by email (Fortify): the "Forgot password?" link shows only when MAIL_MAILER is a real mailer
  (Cloud's Email resource connects Resend). Signing up from a share link names the mix you're invited to.
- Uploads (`mix_assets`, `AssetController`) live on the uploads disk (Cloud bucket `blokmix_production`, disk
  `uploads`, default), per mix. The browser stays the cache: `lib/assets.ts` `syncAssets` (run by `openMix`)
  downloads what it lacks and sends up what the server lacks; new uploads go up as they're added. Unsplash goes
  through `/api/unsplash` with UNSPLASH_ACCESS_KEY on the server (the Vite-only app still uses its VITE_ key).
- A mix exports to and imports from one file (`lib/mixFile.ts`, `blokmix.mix/v1`, uploads included): Export in
  the board menu; Import on the mixes page (a new saved mix) or in the menu without Laravel (replaces the local mix).
- Captured clips (`clips`, `ClipController`, `lib/userClips.ts`): the extension's zip, added from the Crate, linted
  in the browser, saved to your account. You get yours and those of people you share mixes with; they join the
  library (`core/library.ts` `extendLibrary`) before the board opens a mix.
- Drafts (`core/drafts.ts`, `state/slices/drafts.ts`): a mix holds a few, side by side, each one you can work on. "Mix"
  on screen means only the project. The open draft's body is the mix's top-level site, guide, content and contract, so
  every action edits it; the others keep a `body` until opened (`switchDraft`, one undo step; the site's name, logo and
  brief are shared and follow you). A guided start makes three (A, B, C; `mixFromStart`); a mix saved before drafts opens
  as one, "Draft A", holding every version (`draftsFromLegacy`, run by the store's `merge`). Saved versions belong to a
  draft (`VersionNode.draftId`, letters A1, A2…): its history, in the Drafts panel under the top bar's
  "Mix / Draft A ▾ / Page" (`ui/drafts/DraftsPanel.tsx`: open, new draft from this, rename, delete; history: go back to
  this, new draft, export, show on canvas). On the canvas the other drafts are columns beside the open one
  (`placeDrafts`, `ui/frames/DraftFrame.tsx`, a click opens one); version frames are only builds, versions you chose to
  show (`ui.pinnedVersions`) and versions with notes (`placeVersions`). Sync sends drafts one by one like versions. Free has
  3 drafts in a mix, a pack 6 (`FREE_DRAFTS`, `MAX_DRAFTS`). Export and Publish can pick another draft (`draft:<id>`,
  `lib/packet.ts` `sourceVersion`). Agents: `list_drafts`, `switch_draft`, `new_draft`, `update_draft`, `delete_draft`.
- Each mix has its own clip set (`clips` in its data): captures added while it's open join it, the Crate's ✓ keeps or
  drops one, and sections it uses always count. A section's arrows (‹ Layout n of m ›, ← →, Shuffle, `get_options`)
  step through the built-in layouts plus this mix's clips only (`core/library.ts` `cycleIds`), never another mix's or a
  collaborator's; picking one from All your clips (`setClip`) adds it to the mix. Stepping onto a built-in layout turns
  off a captured clip's own words and look (`withClip`), so layouts always show your words and style. The Crate and Alternatives show This mix / All your clips / Layouts (a focused section opens nothing by itself: the dock's Layouts button grows its alternatives);
  agents use `list_mix_clips`, `add_clips_to_mix`, `remove_clip_from_mix`.
- Site library (Landbook-style, `lib/siteLibrary.ts`, `ui/library/SiteLibrary.tsx`): real sites captured offline, each page's
  sections matched to built-in layouts (`GET /api/library`, `GET /api/library/sites/{slug}`; Vite-only dev uses the made-up
  `data/librarySample.ts`). Opened from the Crate's "Sites". Clipping lands the MATCHED LAYOUT (never the site's words or
  pictures) and credits it (`slot.inspiredBy`, shown in the Source tab, written to blokmix.json and BLOKMIX.md; a slot
  without one falls back to its clip's). A site's look joins the style guide as candidates `src:site:<slug>#<group>`
  (`promoteSource`, `candidateSource`). Agents: `list_library_sites`, `get_library_site`, `clip_from_site`, `use_site_style`.
  Starting a mix from a site is gone for v1 (`mixFromSitePage` stays for the Crate's Sites).
- Saved style guides (`style_guides`, `Api\StyleGuideController`, `lib/styleGuides.ts`): save a mix's guide under a
  name from the Style guide panel, or swap one in (`replaceGuide`, one undo step). The guided start's "Or start from"
  offers a starter (posts `site`, `guide` and `name` to `/mixes`, which stores `data = {guide, site}`; the board fills
  the rest from a blank mix), a saved style guide or another mix's (the questions go on with that guide, and the look
  step folds away), a blank page or a mix file. Every mix keeps its own copy, so edits never spread.
- Plans (`config/blokmix.php` `plans` and `pack`, `docs/pricing.md`): Free is 1 mix, 40 clips, 100 MB, the core layouts
  and the Feel dials; a mix pack ($20 once, `users.mix_packs`) is 3 mixes open at a time (packs stack), every layout,
  control and treatment, unlimited clips and 10 GB. Mixes are slots: archived ones (`mixes.archived_at`, `POST
  /api/mixes/{id}/archive|unarchive`, owners only) don't count and are read-only like a viewer's. Mixes and uploads
  count toward the mix's owner (an editor's upload uses the owner's room); clips toward whoever saved them; shared
  mixes, layouts and placeholder art never count. `User` `mixSlots`/`mixRefusal`/`clipRefusal`/`uploadRefusal` say
  why, and the controllers refuse with 403 and that message (the web New mix gets it as `errors.mix`). Existing work
  over a limit is kept; only adding more is refused. The people who run Blokmix (and `plan = plus` set by hand) have
  no mix limit. Inertia shares `auth.plan` (name, limits, usage, packs, pack, buy, receipts).
- Feature gates follow the mix's owner (`toBoard` `paid`): `library.paid = false` limits `pickable`, matching, starters
  and the site library to `"tier": "free"` layouts (`core/library.ts` `layoutOpen`), and store actions ask
  `state/plan.ts` `needsPack` before locked layouts, knobs outside `FREE_TOKENS`, source picks, block looks, saved
  guides, effects, backdrops and generative/mock/shader fills (`core/plan.ts`). On the board that opens
  `ui/shell/BuySheet.tsx`; agent commands run `strictly` and refuse with why.
- Mix packs are sold at Polar (`config/billing.php`, `Services/PolarClient` ported from ReviseMy, `Services/MixPacks`):
  `POST /api/billing/checkout`, `GET /api/billing/receipts`, and the signed webhook `POST /api/polar/webhook`
  (`order.paid` grants one pack per order once, a full `order.refunded` takes it back). Off until
  `BLOKMIX_PRICING_ENABLED`; then the buy buttons go to Polar's checkout and back to `/?bought=1`.
- Publishing (blok.page): the board builds every page like an export (`core/export/publish.ts` `publishFiles`, `referenceHtml`'s
  `web` mode: noindex, media as files, root links under `PUBLISH_BASE`), zips them and posts them (`lib/publish.ts`,
  `POST /api/mixes/{id}/publication`, owners and editors; `GET` reads, `DELETE` unpublishes). `publications` (one per mix)
  keeps the code (Mix::SHORT_PATTERN, never reused) and slug; files at `published/<code>/` on the uploads disk; the server
  swaps the base for `/<code>/<slug>` and adds the "Made with Blokmix" badge for a Free owner. `PublishedController` serves
  `blok.page/<code>/<slug>/<page>` on `Route::domain(config('blokmix.publish_host'))` without the web middleware (no
  session, cookies or CSRF; noindex, CSP); an old slug redirects, unpublished is 410, nothing else answers there.
  `BLOKMIX_PUBLISH_URL` (default https://blok.page, http://blok.localhost:8000 locally). Free has one live publication;
  published bytes count toward the owner's upload room (`User::publishRefusal`). UI: Publish in the top bar (hosted
  only); agents: `publish`, `get_publication`, `unpublish`. BLOKMIX.md lists the address while it's live.
- Agents on the live site: the local MCP bridge also accepts Blokmix's hosted HTTPS origins (`HOSTED_ORIGINS` in
  `core/commands/bridge.ts`, plus BLOKMIX_ORIGINS). Chrome may ask once to let the site reach this device.
- Waitlist (`waitlist`, `Api\WaitlistController`): blokmix.com's form posts to `POST /api/waitlist` (public, no CSRF
  token, throttled, a hidden `website` field drops bots). JSON gets `{joined: true}`; a plain form post goes back to
  `/?joined=1#waitlist`. One row per email.
  The people who run Blokmix (`config('blokmix.owners')`, BLOKMIX_OWNERS, default Derek's account; Gate `run-blokmix`)
  see it at `/waitlist` (linked from the mixes page): search, copy emails, Export CSV, take someone off. Others get 404.
- Site library (server): real websites captured by the library CLI (`library_sites` → `library_pages` →
  `library_sections`, screenshots in `library_assets` on the uploads disk under `library/<slug>/`, never counted toward
  a plan; `Api\LibraryController`). Owners (Gate `run-blokmix`, else 403) `POST /api/library/sites` a bundle (multipart
  `site` = site.json plus the WebP/PNG/JPEG screenshots it names by file name, as `files[]` or one zip `bundle`, since
  PHP takes 20 files per request; 15 MB each, 200 MB in all): it
  upserts by slug, replacing pages, sections and files but keeping status (new sites are drafts) and whatever site.json
  leaves out. Signed in: `GET /api/library` (published cards; owners `?drafts=1`), `/api/library/sites/{slug}` (hidden
  sections only for owners), `/api/library/assets/{ls_id}`. Owners `PATCH` sites (name, industry, tags, status) and
  `sections/{id}` (layout_id, status, type; a layout id matches a section), and `DELETE` a site with its files.
  `/library/admin[/{slug}]` (owners, 404 otherwise; linked from the mixes page) curates over the screenshot.
  site.json may carry `effects` (Treatments below), validated to the five effect ids.
- Mixes have members (`mix_members`): owner (shares, deletes), editor (changes anything), viewer (looks and
  leaves marks). Non-members get 404. Share links (`mix_share_links`, `/share/{token}`) add whoever opens them
  with a role (never lowering one); signed-out people sign up first. The Share panel (top bar, hosted only) makes
  and revokes links and changes roles. Viewers: the server keeps only `notes` from their saves, `lib/mixSync.ts`
  puts any other change back on the board, and commands other than add_note/update_note/reply_note refuse.
- Collections (`collections`: ulid, owner `user_id`, `slug` unique per owner, `name`, `schema` + `entries` json, `lock`;
  `collection_assets` like `mix_assets`, files at `collections/<id>/` on the uploads disk) belong to an account.
  `Api\CollectionController` at `/api/collections` (index, show, store, update, destroy) saves like a mix: `PUT` with
  `If-Match: "<lock>"`, a stale lock gets 412 and `{collection}` as it is now; a slug clash is 409 with `errors.slug`; 2 MB
  of JSON at most. `Api\CollectionAssetController` at `/api/collections/{id}/assets` mirrors `AssetController`. Access
  (`Collection::roleOf`): the owner does anything; anyone else comes through `?mix=<id or short>`, a mix they're in
  whose data binds the slug (`"collection": "<slug>"` anywhere) and that the collection's owner can edit. Its editors
  (and its owner) change entries only, viewers read; everyone else gets 404. Index lists yours plus those reached
  through your mixes (each with `role` and `mix`). Plans add `collections` and `entries` (per collection; Free 1 and 25,
  provisional): `User::collectionRefusal`, counted against the collection's owner, and its uploads use the owner's room.

## Guided start

The audience is non-designers first (`docs/simple-vision.md`). New mix (the gallery's tile, the browser-only mix's first
visit, or "Start a new mix" in its menu) opens `ui/start/StartGuide.tsx`: plain questions one at a time on the left, the
page they add up to on the right (`startCandidates`' first, drawn at once; measuring waits for the end). The first screen is
a sentence to fill in, "I'm making a site for [a bakery] called [Fern & Co]. It should feel [cozy] and help people [order
ahead]. Show [our menu]…" (`core/jev/sentence.ts` `startSentence`, `fillStart`; `ui/jev/Sentence.tsx`: each blank a row of
options Jev puts in order, `rankRequest`, or your own words, matched to the nearest, `matchRequest`), with a box under it
to paste what you already have. The page on the right follows the sentence as you fill it. Whatever it fills answers
those questions and folds them (`answersFromSentence`, `heardFromSentence`, `SENTENCE_GOAL`, `SENTENCE_FEEL`). Answered
questions fold into one line each with Change; "Skip, show me pages" takes every suggestion. The questions
(`core/startFlow.ts`, pure: `QUESTIONS`, `nextQuestion`, `folded`, `skipToPages`, `briefFrom`, `sectionsFrom`):
1–2. The sentence (its name, what it is), or the words you already have (`textMode` tells a paste apart) 3. The kind
of site and industry, folded when the first sentence settled both 4. What should it do for you? (goals, something else,
who it's for) 5. What should the main button say? (`actionChoices`, or your own words) 6. What goes on the page? (section
chips, ✕ and +; folded for pasted words) 7. How should it feel? (feel words from the industry and kind, three themes,
brand color, light/dark, colors by feel) 8. Three ways to lay it out: measured, in the theme you picked; the one you open
is the mix and the other two are kept (A/B/C).
The answers are the brief (see The brief): `recipeFor` shapes the kind's page by format and goals, `contentFor` puts the
main button's words in the buttons. Jev only ranks what's offered: one request (`describeRequest`: the kind, each
optional section, the look, the format, the industry and each goal, `readDescribe`, `sureGoals`) after question 2, while a
keyword guess (`guessHeard`, `guessBrief`) shows at once; with suggestions off the same questions are ranked by keywords
alone. Pasted words become a page from your words in three arrangements (`lib/startFromText.ts` `wordsCandidates`, the
pure `state/jevPage.ts` `wordsPage`, a nav and footer from `chromeFor`; lines it wasn't sure of ride along in
`content.tray`). `startCandidates` offers matching starter mixes (`samples/starters/*.json`, ranked by their `industries`
and `formats`, checked by `checkStarters`) first, then fills the recipe from the library with `suggestClip`, built-in
layouts first. Its words come from `core/startWords.ts`: every field of every section, per kind, read as a believable site
(tests keep instructions, greetings and Blokmix's own demo words out). `lib/start.ts` measures each at a laptop, a phone
and widths between (`lib/measure.ts` `measureFirstScreen`) and `core/score.ts` `scorePage` says in plain words how its
first screen holds up (after Shu Ding's "The Calculus of Interfaces"). Under the first questions, "Or start from": a
starter, a saved style guide (hosted), a blank page, a mix file (`ui/start/StartFrom.tsx`). Hosted, a start posts to
`POST /api/mixes`; agents use `suggest_starts` and `apply_start` (both take `text`, `sections`, `format`, `industry`,
`goals`, `main_action` and `who`). The flash says how many spots still hold sample words.

## Skins and the contract

On screen (`docs/simple-vision.md`, the brand guide's B3): Your mix (not working mix), Design (the panel; `look` in code), Content (your words; `words` in code), Themes (skins),
Rules for your agent (the contract), Style guide (every value, behind Look), Options (candidates), Crate (the clips drawer), Original / Your style, Export (code) vs Download a copy
(the mix file), Notes (not marks). Word tags read Your words · Placeholder · Original · Saved. No "packet", "tokens" or
"slot" in anything a person reads.

Layouts are the bones; a skin is the whole look over them (`core/skins.ts`, `samples/skins/<id>.json`, `data/skins.ts`): tokens,
effects, text styles, block looks (`components`), section defaults per type (`guide.sections`: surface, backdrop, motion,
spacing) and a picture style for empty pictures in built-in layouts (`guide.picture`; never a logo). A skin's button look keeps
one main action: `components.button.secondary` styles the quieter one (`defaultFor`, `BlockInfo.secondary`). `applySkin` writes it into the mix's own
guide as one undo step; candidates and swatches stay. Section defaults and pictures sit under what a section or block chose
(`core/sectionDefaults.ts`, used by both `composePage` and `frameStateFor`), so a swap never rewrites a slot. Words stay readable
over any band or backdrop, whatever the palette: `readBackdrop` picks the text color or softens the backdrop, `sectionTokens` applies
it (`tests/skins.test.ts` checks every combination), and the Style panel says when it did. Every skin must
pass AA and load its fonts (`tests/skins.test.ts`). `tier` decides who gets one (`skinOpen`). Surprise me (`surpriseMe`) mixes
skins: areas come whole from other skins; on screen it's "Mashup" (so "mix" only ever means the project), drawn before it lands.
Look (`ui/panels/guide/Look.tsx`, the panel's first view, `ui.guideView`) is for people who aren't designers: How should it feel?
(`core/feel.ts` `FEEL_WORDS`, a skin's `feel` in its JSON, `ui.feelWords`) brings up three themes that fit (`themesFor`), or with
"Something different" two that match none of the words plus a mix (the same `surpriseMe` roll, drawn first); every theme is a card in
its own look (`ui/skins/SkinSpecimen.tsx`, drawn as `applySkin` would leave this mix, so kept parts and your brand color show).
Nudge it (`NUDGES`, `nudgeTokens`: Bolder, Rounder, Darker…) turns Feel dials a step, one undo step each. Your color is the brand
color. The Style guide door opens everything else (`GuideBoard`: Feel, the group tiles, text styles, effects, contrast, Rules for
your agent, Copy for your agent).
A mix saved before skins dresses itself when it opens (`dressSavedMix`, in the store's `merge`, versions too): its own values stay, and block looks, section defaults and pictures come from the closest skin (`closestSkin`; Wireframe only if it was already plain greys). A guide with no skin and no built-in layouts is only marked `OWN_LOOK`, and so are saved guides you swap in.
The contract (`core/contract.ts`, `contract` in the mix's data, not the guide) sets each area to Keep, Tweak or Surprise, plus
your own lines. Swaps and Surprise me leave Keep alone; agent commands that write to a kept area are refused
(`areasOfCommand`, `contractRefusal`); your own controls aren't. Exports write `CONTRACT.md`, and `agentRules` opens or closes
the packet's rules to match. A section's `slot.keep` is more specific and wins. UI: themes in Look, the contract as Rules for your agent in the Style
guide behind it (on screen a skin is a Theme and the contract is Rules for your agent; code keeps `skin` and `contract`); a section's own options dock in the Style panel at the window's side (`ui/frames/SectionPill.tsx`), and `frameBeside`
moves the canvas so the section shows beside it. Agents: `list_skins`, `suggest_themes`, `apply_skin`, `nudge_look`, `surprise_me`, `get_contract`, `set_contract`.

## Jev (TypeSafe)

Jev, TypeSafe's System One model (docs.typesafe.ai), places, picks and checks real things; it never writes words. Typed
questions (choice, score, noul, box) about a JSON state, ~100ms, near free. Weak at counting, maths, hex colors and
dates: code does those.
- Layer: `core/jev/` (pure: question builders, `shuffled`/`merged` ask a choice in both orders to cancel its first-option
  lean, `vocab.ts` section types and kinds in words, one file per feature with its QUESTIONS and THRESHOLDS on top).
  `lib/jev.ts` `askJev` posts to `/api/jev` and returns null when off, slow or failing, so every caller falls back;
  `setJevTransport` swaps in a fake (`tests/helpers/fakeJev.ts`; `npm test` never uses the network).
- Key: `TYPESAFE_API_KEY`, server only. Hosted: `Api\JevController` (signed in, `throttle:jev` 120/min 3,000/day, checks
  shape and image sizes, passes the body on unchanged). Vite-only dev: `scripts/jev/devProxy.ts` reads `.env.local`. No key
  means Jev is off. Per device: "Suggestions" in the board menu (`ui.jev`, on by default). Everyone gets it, Free too.
- On screen there's no "Jev" and no feature names, only plain words: Suggestions (the menu switch, whose credit line,
  "Suggestions by Jev (TypeSafe)", is the one place the name shows; `tests/jev-name.test.ts` checks it), "From what you wrote", "Suggested", "Suggestions are off (Blokmix menu)", "What do you want to change?" (the
  bar), "Add your text to this page", "Make a page from your text", "Text not placed yet", "Background ideas", "Find colors",
  "Is it clear?", "Best match first". Code names (`core/jev`, commands, files) stay. Without a server key the Say bar isn't
  drawn (`useJevServer`, `checkJevServer` in `lib/jev.ts`); command errors come from `jevOffMessage`.
- Features (commands first, `core/commands/schema/jev.ts`, `state/commands/jev.ts`): `place_links` (smart links; the
  checklist's dead-link fix, "Suggested" in the link menu), `five_second_test` (the first screen's words to a visitor;
  "Is it clear?" card in the export panel), `find_subject` (`MediaFill.focus` → object-position; the Image
  menu's pad) and stock photos best match first, `understand` (Say it, ⌘K: an allow-listed intent plus closed-set
  arguments from the page → one ordinary command), `pour_words` and `page_from_words` (your words placed verbatim; "Text not placed yet"), `suggest_palettes`/`set_palette` (Find colors in the Feel tile; candidates are AA by construction,
  drawn as swatch cards), `suggest_treatments` (Background ideas in a section's Style panel), and the start box
  (`describe.ts`, `suggest_starts` with `text`; see Guided start).
- On the board Say it is a bar above the Dock (`ui/jev/SayBar.tsx`), hidden until ⌘K or the Dock's wand button opens it; it
  hides again on a click elsewhere with nothing typed (a "n not placed" chip still shows). Empty and
  focused, it offers a verb-led sentence ("Make [Pricing] [darker]", "Move [Testimonials] [above] [Features]", "Add [a FAQ
  section]", `barSentence`); `fillBar` builds the same action Say it would (`buildAction` on certain answers). It also takes a
  typed command, or a paste of two or more lines: "Add to this page" / "Make a new page" hand the words to `WordsSheet`
  (`useJevTools.auto`), which places them at once. Text not placed yet (`content.tray`, saved and undone with the mix's words;
  `trayLines`, `setTray`) unfolds from the "n not placed" chip beside the bar.
- What to make next: `npx vite-node scripts/library/gaps.ts [--all]` reads every library screenshot (type, shape, ~30
  elements and treatments) into `.out/library/gaps.md`; unmet asks from Say it, Pour and Dress it up are counted by name
  only (`jev_wants`, `POST /api/jev/wants`) and shown to owners on `/library/admin`.
- Bench: `npx vite-node scripts/jev/bench.ts [suite] [--runs 3]` (accuracy against today's rule, coverage at thresholds,
  calibration, option-order flips, latency, cost). Change thresholds only on its numbers.

## Agents

Everything you can do on the canvas is a command in `resources/js/core/commands/schema/` (zod schemas →
tool definitions, one file per area: page, blocks, notes, versions), run by `resources/js/state/commands/`
(`index.ts` runs them; `refs.ts` finds sections, blocks and notes; one module per area) through the same
store actions as the UI. Each write is validated and lands as one undo step; agent edits show a toast.
Commands that need a moment (measuring a page, composing a packet) are async: `prepare`, then `apply` as one
step; the browser link awaits them and the bridge gives them longer (`timeoutFor`). The packet is assembled
by `lib/packet.ts` `packetInputFor`, shared by the export panel and agent commands.
- In the browser: `blokmix.tools()` and `blokmix.run(name, input)`.
- Over MCP: `npm run mcp` starts `scripts/mcp-bridge.ts` (stdio MCP server + a WebSocket on
  127.0.0.1:4317 that only Blokmix's local origins may join). Add it to Claude Code with
  `claude mcp add blokmix -- npm --prefix /Users/heyderekj/blokmix run -s mcp`, then turn on
  "Let agents edit this mix" in Blokmix's menu (off by default). `scripts/mcp-smoke.ts` is a
  quick end-to-end check.
- New capabilities should be added as commands first, then wired into the UI.

## Capture extension

`extension/` is the Chrome (MV3) clipper that writes clips in this format from live sites (see
`extension/README.md`). `npm run extension:build`, then load `extension/dist` unpacked. The page side is
`src/snapshot.ts`; everything else in `src/capture/` is pure and reuses `core/` (lint, parse, icons,
fonts). `npm run clip:add -- <zip>` adds a downloaded clip and lints it. Capture tests run the saved
fixtures in `extension/fixtures/` in real Chrome.
- Capture keeps the section, not how its page built it: `capture/clean.ts` folds wrapper boxes, drops
  stacked image copies, scrims, invisible layers and hidden controls, turns rows of cards into one 12-column
  grid and accordions into `<details>`; `capture/normalize.ts` names what's left on the layout primitives
  (`.container`, `.head`, `.actions`, `.btn`, `.grid`, `.split`, `.band`, `.card`, `.media`). Every rule is
  general, never per site.
- `extension/scripts/capture-url.ts <url> "<selector>=<type>[:<variant>]"` captures from the command line and
  saves each raw snapshot to `.out/inspo/snaps/`; `extension/scripts/recapture.ts [filter]` re-runs capture on
  them offline and writes original-vs-clip pairs to `.out/inspo/compare/`, the loop for improving fidelity.

## Site library engine

Curated real sites become library entries offline (`docs/site-library.md`): capture → split → type → match → draft.
- `npx vite-node scripts/library/capture-site.ts <url> [--pages /,/about] | --seed <industry|firstRun>` (seed list:
  `samples/library/seed.json`) writes `.out/library/<slug>/`: WebP screenshots (page at 1440 and 390, one per section,
  thumb), `site.json` (sections with box, type + confidence, captured clip, signature, top matches) and `upload.json`
  (the `POST /api/library/sites` shape). It respects robots.txt, rejects cookie banners, settles lazy content. Page side:
  `extension/src/sections.ts` (`findSections`, `guessSectionType`, `pageFacts`, `dismissConsent`); site-wide tokens:
  `extension/src/capture/siteTokens.ts`. `--debug` draws the section boxes.
- Matching (`core/match.ts`, pure): `signatureOf` reads the same structural signature off a layout or a capture
  (rhythm, main list's items and columns, cards, pictures and where, video, centered head, band, form, accordion,
  tabs/slides, scrolling row, nested lists, overlap, buttons); `similarity` scores two with the misses that cost most;
  `matchLayouts` ranks a type's layouts (drafts only when asked). At or above `MATCH_THRESHOLD` a section shows as that
  layout; below, it needs one. Every layout must match itself first (`tests/match.test.ts`).
- `npx vite-node scripts/library/match.ts [--rematch [--save] [--include-drafts]] [--compare]` prints match rates per
  site and type (the engine's training number), the common misses and the sections needing a layout; `--compare`
  renders each match under the site's tokens beside its screenshot.
- `npx vite-node scripts/library/draft-layouts.ts` writes a brief per unmatched section to `.out/library/drafts/`; an
  agent authors the layout with `"status": "draft"` and `"inspiredBy"` in clip.json (drafts stay out of suggestions and
  matching until review removes the status), then `match.ts --rematch --save` points the section at it.
- `npx vite-node scripts/library/upload.ts <slug|--all> [--base http://localhost:8000]` posts bundles as an owner (refuses
  production hosts without `--production`).
- Bundles kept in the repo (`database/library/<slug>/`: upload.json and its screenshots) import on any server with
  `php artisan library:import [dir] --publish`, as an owner, through the same checks (on production: `cloud cmd:run
  production --cmd="php artisan library:import --publish"`). `docs/layout-coverage.md` maps archetypes to layouts.

## Layout

- `resources/js/core/`: pure TS, no React or Vite APIs (reused by the future extension and MCP server)
- `resources/js/data/library.ts`: loads `samples/` via `import.meta.glob`
- `resources/js/core/site.ts`: the site model. Each page holds its own sections; one nav and one footer are shared
  (`site.shared`) and a page can hide them. `pageView` reads a page top to bottom, `allSlots` every section, and the
  store's `currentSlots` is the open page. Links are `#anchor` on the same page and `/path#anchor` across pages.
- `resources/js/state/`: zustand store (persist + zundo undo)
- `resources/js/frame/`: sandboxed iframe rendering + postMessage bridge
- `resources/js/ui/`: canvas, frames, panels
- `samples/sources/*.json`: Blokmix's built-in layouts (`layout.json`, `kind: "layout"`) and their tokens. The
  library starts fresh from these (the fictional sample sites and earlier captures are gone); captured clips join
  per account. A source clipped from a site is `kind: "site"`.
- `samples/clips/<type>/<source>-<variant>/`: `clip.html`, `clip.css`, `motion.css` (optional), `clip.json`.
  Built-in layouts use the `layout` source: `samples/clips/<type>/layout-<variant>/`.

## Clip authoring rules (enforced by `core/lint.ts`, checked in `npm test`)

Clips are what the capture extension will emit later. They must re-theme under ANY
source's tokens (light or dark), swap copy, and export cleanly to Astro and JSX.

1. One root element: `<section|header|footer|nav class="mx-<type>-<folder>" data-mx-section="<type>">`.
2. All CSS nests under `.mx-<type>-<folder> { & .x { … } }` (explicit `&`). Keyframes are named
   `mx-<type>-<folder>-*`. Nothing else at the top level. Short class names inside the root are fine.
3. Every color, font, radius, shadow, duration and easing comes from `var(--mx-*)`. No hex, rgb(),
   hsl(), oklch() literals. Tints: `color-mix(in oklab, var(--mx-color-primary) 15%, transparent)`.
   `transparent` and `currentColor` are fine. Never assume the background is light or dark.
   Border widths are `var(--mx-stroke)` (or `calc(var(--mx-stroke) * n)` for heavier rules), never fixed px,
   so a heavy-lined source thins out when adapted to a hairline style guide. Focus outlines stay fixed.
4. No `vh` units (iframes auto-size to content): use `calc(var(--mx-vh) * 80)`. `vw` and `%` are fine.
5. No `style=""`, no `<script>`, no `on*=` handlers, no raster images (inline SVG or CSS art only),
   links are `href="#"`.
6. Motion lives only in `motion.css` and is CSS-only (keyframes, transitions on :hover are fine in
   clip.css). `clip.css` must render the final, at-rest state; `motion.css` adds the entrance/loop.
   Turning motion off just drops `motion.css`. No scroll-driven animations (frames don't scroll).
7. Interactions without JS: `:hover`, `:focus-visible`, `<details>`, radio inputs + `:has()`. Sliders are the one exception (see Sliders): they scroll natively without JS, and a shared script adds their controls.
8. Copy: `data-mx-field="<name>"` on LEAF text elements only, names from `FIELD_SCHEMA` in
   `core/content.ts`. Put every piece of real copy in a field so "your copy" replaces it fully.
   Decorative static text (labels like "01", "↗", "Fig. 1") must not mention the source brand.
   A duplicate of a field (e.g. the second half of a seamless marquee) uses `data-mx-mirror="<field>"`
   so it follows the swapped copy too.
9. Siblings that need visual space between them get it from flex/grid `gap`, never from whitespace
   between inline elements (JSX drops it).
10. Use typographic quotes (’ “ ”). Avoid `{` `}` in text unless inside `<pre>`/`<code>`.
11. Each clip must look right at 1440px and 390px, and at 1080 and 768 in between. Breakpoints answer to the section, not
    the viewport: nest `@container (max-width: 616px)` (phones) and `@container (max-width: 952px)` (tablets) inside the
    root for what's inside it. The container is the root's content box, the viewport less its two 64px gutters and any
    scrollbar, so those are the 760px and 1080px viewport breakpoints for a full-width section (`GUTTERS` in `core/containerize.ts`). Every section root
    is a size container (`.mx-section`, `[data-mx-section]` in the base CSS), so a layout fits wherever it sits: a page, a
    column, a preview. A container can't query itself, so the root's own declarations (its gutter) and rules on the root
    itself (`&.reverse`, `&::before`) stay in `@media`. Lint warns on viewport width breakpoints; `npx vite-node
    scripts/containerize-clips.ts [ids]` converts them (`core/containerize.ts`, also run on every capture). Bleeds to the
    window's edge (`calc(50% - 50vw)`) stay in `vw`.
12. `clip.json` sets `rhythm` (`centered | split | grid | stack | band`): the section's dominant shape.
    Suggestions use it to pick layouts that contrast with their neighbours. It also sets `density` (`airy | balanced |
    dense`). Built-in layouts have no `style` or `feel`, since those belong to the skin; a captured clip may carry them.
13. Blocks: mark what people will select, swap and restyle with `data-mx-block="<kind>"`.
    - Small blocks go on the element itself (often the same element as its `data-mx-field`):
      `heading`, `text`, `button`, `link`, `badge` (eyebrows, tags, pills), `icon`, `input`.
      A button or link may hold an icon plus its field; other small blocks hold no blocks.
    - `card`: a self-contained group (a panel, a quote card, a form card). Give it a short
      `data-mx-label` ("Panel", "Quote", "Form").
    - Repeating units are `item`s directly inside a `list`: `<ul data-mx-block="list" data-mx-list="features">`
      then `<li data-mx-block="item" data-mx-label="Feature">`. Use a singular noun for the label.
      Number each item's fields by its place (`f1Title`, `f1Body`, `f2Title`…; a nested list inside an item
      continues the number: `t1F1`, `t1F2`). That number is how a section adds, duplicates and reorders items
      (`core/lists.ts`), so every item needs it. A count printed in the item ("01", "2.") as its first static
      text follows position; an attribute only the first item has (`open`, a wide first tile) belongs to the
      first position (`firstPosition` compares only the items' own attributes). Anything else about an item
      travels with it, so a treatment for "whichever comes first" is better written as `:first-child` in CSS.
    - Bloks can be added to a section on the canvas (`core/inserts.ts`, `slot.inserts[clipId]`, the block bar's + / A,
      agents `add_block`): a button, link, text, heading, badge, picture or icon after a block, or after it in every item of
      a list. A new blok copies the nearest block of its kind (else primitives + `INSERT_CSS`), gets a fixed id (a1, a1f3)
      and `data-mx-extra`, and is drawn after stamping, so a clip's own ids never shift. Hiding one removes it; hidden
      blocks come back from the same menu ("Bring back") or the section's Style tab.
    - Pictures (CSS/SVG art standing in for a photo, illustration, screenshot or avatar):
      `data-mx-block="image" data-mx-media="<name>" data-mx-ratio="<w>/<h>"`. Keep the placeholder inside (a bare layout's is the wireframe cross); a real image replaces it later. Media names are unique in the clip.
    - Don't mark the section root, layout wrappers, decoration, or `data-mx-mirror` duplicates
      (the hidden half of a marquee). Logo wordmarks are `image` blocks (`data-mx-media="logo1"`).

14. Icons: give every inline icon `<svg>` a meaningful name, `data-mx-icon="<name>"`, from `ICON_NAMES` in
    `core/icons.ts` (arrow-right, mail, star…). In "Your style" named icons redraw in the style guide's icon
    set (Lucide, Phosphor, Tabler or Heroicons at a weight, token `icon.set`); a source's own set is identified
    from its named icons. Logos, illustrations and decoration stay unnamed. An icon whose inner shapes carry
    classes (an animated plus/minus) keeps its own drawing. Regenerate the curated icons with
    `npx vite-node scripts/build-icons.ts`.

### Craft (applies to clips, layouts, block looks and the app itself)

Our own distillations of public craft sources, the same lenses ReviseMy uses: IIDS (Matt D. Smith / Shift
Nudge) for hierarchy, spacing and type; Laws of UX for behavior; Emil Kowalski's design-engineering skill
(emilkowal.ski/skill) for motion and feel. `core/advise.ts` turns them into suggestions, tagged by lens.
- **Wrapping:** headings `text-wrap: balance`, body `text-wrap: pretty` (both in the shared base CSS);
  long words break. Body lines 45–75 characters; headings under ~60 characters.
- **Hierarchy:** one solid primary action per section; one expressive treatment (gradient, marker,
  hollow, caps, offset) per section; display treatments only at display sizes.
- **Spacing:** only spacing-scale steps; siblings share a step; filled containers get at least medium
  padding; one corner shape per section (plus pill buttons).
- **Interaction:** everything pressable has a pointer cursor and `scale: 0.97` on `:active`; hover styles
  only under `@media (hover: hover) and (pointer: fine)` (block looks do this automatically); tap targets
  44px.
- **Motion:** name the properties (never `transition: all`); animate transform and opacity; ease-out
  (`cubic-bezier(0.23, 1, 0.32, 1)`), never ease-in; UI motion under 300ms and exits shorter than
  entrances; stagger 30–80ms; never from `scale(0)` (start ~0.95 with opacity 0); nothing on keyboard
  actions or things seen many times a day; reduced motion keeps fades, drops movement. Lint warns on
  `transition: all`, `scale(0)` and `ease-in`. Motion presets (`core/motion.ts`) are written to these
  rules; a section preset replaces the clip's own motion.css.

### Browsing, starters and dials

From `docs/library.md` and `docs/simple-vision.md`: start from real sections, dial a style by feel.
- The Crate searches and filters (`core/browse.ts`): words match title, pattern, type, source and tags; facets are
  layout (`rhythm`), `density` and (on captured clips) `style` from clip.json, plus tone, color family and pictures read off the clip
  itself (OR within a group, AND across groups; a group shows only when the shelf's clips differ in it). Search and
  filters live in `ui.crateQuery` / `ui.crateFacets` and survive picking another section.
- Starter mixes (`samples/starters/<id>.json`, `core/starters.ts` `buildStarter`): pages of layout ids plus `tokens`,
  a sample style guide that lands as your own values. The demo seed (layouts, neutral guide) is built the same way. New mix
  offers them; agents use `list_starters` and `start_from_starter` (replaces pages and guide, one undo step).
- Dials (`core/dials.ts`, the Feel tile atop the Style guide; Look's nudges turn them in words): spacing, type size, roundness, weight and width (the content
  and reading columns together) each move a few tokens at once (`chooseTokens`, one undo step); Light/Dark (`setTone`) swaps background and text, re-mixes
  surface, border and muted, and lifts a primary that would vanish. Agents use `set_dial` and `set_tone`; `get_page`
  reports `dials` and `tone`. The Type dial stops at a 1.333 ratio (bigger ones outgrow phones; the knob has them).
- Section surfaces (`slot.surface`, `core/surface.ts`): page, soft, inverse or brand, a band in the guide's own colors,
  set from the dots in the section bar or `set_section_surface`. Frames and exports re-mix that section's tokens only.
- Text styles (`core/textStyles.ts`, Figma's way): Display, Heading 1–4, Body large, Body, Small, Caption and Label, each a
  font, a type scale step (and one for phones), weight, line height, letter spacing and case; defaults come from the type
  scale and your edits live in `guide.textStyles`. A block uses one when picked (`BlockStyle.text`, 'none' keeps the clip's
  type) or, once that style is edited, when it reads as it (`autoTextStyle`: headlines Display, section headings Heading 2,
  item titles Heading 4, intros Body large, eyebrows Label); `BlockStyle.size` sizes one block. Layouts look as authored
  until then. Block CSS writes them (`textDecl`, phone sizes in its @media), so frames and exports match. UI: the block bar's
  Text menu, the Style panel's Text styles tile. Agents: `list_text_styles`, `update_text_style`, `set_text_style`.
- Locking (`slot.locked`, the section bar's Lock): only you change a locked section. Shuffle skips it, and agent commands naming it refuse, apart from marks. A captured section's own look, words and motion are switches where they belong (Style, Content, Motion's As clipped).
- Section widths (`slot.width`, `widthTokens`): narrow, standard, wide or full, against the guide's content width, from
  the width picks in the section bar or `set_section_width`. `sectionTokens` applies surface then width.
- Moving around (`ui/canvas/Canvas.tsx`, pure math in `ui/canvas/camera.ts`): the page scrolls like a website by default
  (`ui.canvasMode: 'page'`): it fits the free space's width (`fitWidth`, 100% at most), the wheel scrolls it with a give at
  either end, and pinching zooms around the pointer's height. Pinching out below 60% of fitting (`leavesPage`) or ⇧1 opens
  the free canvas (`'canvas'`, every version); Esc, ⌘0 or a click on the page goes back. Keys (`zoomKey`): ⌘+ ⌘− + − step
  `ZOOM_STOPS`, ⌘0 fits the width, ⌘1 and ⇧0 are 100%, ⇧1 fits everything, ⇧2 the selection, PgUp/PgDn (and ↑ ↓ with nothing
  selected) scroll. Docked panels set `ui/canvas/insets.ts` `setInset(side, px)` and the page refits beside them. Each page's
  scroll spot is kept per device (`ui.pageScroll`); opening a page shows its top. `canvasApi` has `setMode`, `fitWidth`,
  `zoomTo`, `zoomStep`, `zoomToSelection`, `scrollToY`, `scrollBy`, `revealRow(slotId, 'top' | 'nearest')`, `pageTop`, and
  `onPaint`/`onSettle` to follow it. Screen-sized chrome in world space reads `--zl` (written every frame) for transforms,
  outlines and shadows, and `--z` (written once the camera rests) for anything that takes layout: widths, heights,
  margins, container queries. Camera-only saves skip the mix's diff and write the view a second later (`sameMix`).
- Selecting: one click picks the smallest block under the pointer, in any section (focusing it on the way); a click on a
  section's empty space, its rail or Escape selects the section. Both bars hang below what they belong to, so it stays in
  view; the section bar holds still while you point at it (‹ › don't slide away as the height changes), and on anything
  taller than the screen both stop just above the dock (`ui/canvas/useBarFloor.ts`, which also reports how far a bar
  hangs below the last section so Add a section makes that much room). Both share one look (`ui/frames/bar.ts`). Esc
  closes the thing on top first (`useEscape` in `ui/shell/keys.ts`: a menu, a tab, the shortcuts sheet) and stops there;
  Enter and Space press a focused button instead of saving or shuffling (`pressable`). The block bar is slim like the section bar (name with its
  parents, ‹ Look ›, words, picture, link, item add/duplicate/remove, Style, note, ⋯); everything about how a block or a
  section looks is in one Style panel at the window's side that follows the selection (`ui/panels/SelectionStyle.tsx`).
  ← → step the selected block's looks, else the section's layouts (the section bar's ‹ Layout n of m ›). Over a skin's
  default look, Original is stored as `variant: 'original'` (`ORIGINAL`), so it can be picked.
- List items move by dragging: selecting anything in an item shows one grip on its corner; drag it, or press on the item
  and move (the frame posts `dragItem`/`dragMove`/`dragEnd`). The list reflows live in the frame (a preview `move`), the
  nearest item counts, the canvas pans near the window's edges and with the wheel, Escape cancels, letting go commits one
  `move`. ⌥ + arrow keys swap with the on-screen neighbour (`tileNeighbor`; agents: `edit_list` op `swap`).
- Sections move by dragging their rail or the section bar's grip (`ui/frames/SectionDrag.tsx`: a drop line at the nearest
  seam, frames let go of the pointer via `[data-dragging-section]`), or ⌥↑ ⌥↓ with the section selected. A Crate clip
  dropped on a section replaces it (same type) or goes after it.
- Stress-test layouts against the dials: `npx vite-node scripts/render-clips.ts <types> --variants min,max,dark`
  (also `<dial>0`/`<dial>100`); it flags page overflow, spill past the gutter and clipped text. On phones a `.grid`'s
  column gap stays at `--mx-space-4` or less (its 11 gaps must fit a phone at the widest spacing), single columns are
  `minmax(0, 1fr)`, and big prices cap at a share of the viewport (`min(var(--mx-text-5xl), 17vw)`).

### Sliders

A slider is a list in a natively scrolling track, so it holds any number of slides, each with its own picture and words (`[data-slider]` around `[data-slider-track]`, plus `[data-slider-prev]`, `[data-slider-next]`, `[data-slider-dots]` and `[data-slider-count]`). Swiping needs no script; `core/export/slider-runtime.ts` runs the arrows, dots and count in frames and ships as `/mx-slider.js`. `clip.json` `slider` says what can be arranged (`slide`, `show`, `intro`; the first of each is how the layout comes), `slot.slider` holds the choice, and compose writes it to the root as `data-slide`, `data-show` and `data-intro` for the clip's CSS. UI: the Style panel. Agents: `set_slider`, and `edit_list` for slides. Frames let sliders, tabs, toggles and accordions work while editing.

### Collections

Your content apart from any one section (blog posts, team, products), with a schema, like Astro content collections
or Sanity's JSON; the UI says Collections, inside Content, never "CMS". They belong to your account and every mix you
use them in shows the same entries.
- Model (`core/collections.ts`, pure): `Collection { slug, name, schema { fields, titleField }, entries }`, field types
  text, longText, markdown (rich text), image (a `MediaFill` subset), date (YYYY-MM-DD), number, url, select, list.
  `inferSchema` learns fields from a list's items (keys as in the content file: title, excerpt, cover);
  `entriesFromList` turns its items into entries; rename/retype/remove fields migrate entries.
- Store (`state/collections.ts` `useCollections`): its own zundo history (mix undo never rewinds your content), saved
  in localStorage (`blokmix:collections`) until the server sync lands. Toasts take `undo: 'collections'`.
- Binding (`slot.bind`): `lists[listKey] = { collection, map (item key → field), image?, sort?, filter?, limit? }`, and
  on a template page `entry.fields` (field → entry field, `body#2` = a rich-text field's 2nd paragraph) and
  `entry.media`. `applyBindings` derives the section (lists, words, pictures, each item's link to its entry page) and
  never writes back; SlotRow, compose (exports, versions, measure) and the read commands (`shownSlot`) all use it.
  Typing into a bound field updates the entry; list ops on a bound list act on entries (`listOpOnEntries`); unbinding
  keeps the words it showed.
- Template pages (`Page.template`, path `/<collection>/[slug]`; `normalizePath` keeps one `[param]`): sections bound to
  "the entry" preview one at a time (`ui.previewEntry`, the switcher in the frame header).
- UI: Content → Collections (`ui/panels/collections/`: entries, entry form, fields), the block bar's Collection button
  on a list item (make one from these items, show one you have, open, stop showing), Pages → "A page for each entry of".
- Commands: `list_collections`, `get_collection`, `create_collection` (with `from` a list), `update_schema`,
  `add_entry`, `update_entry`, `remove_entry`, `reorder_entries`, `bind_list`, `unbind_list`, `add_collection_page`,
  `preview_entry`, `bind_field`.
- Exports (`core/export/collections.ts`): Astro writes `src/content.config.ts` (a `glob` loader and zod schema per
  collection) and one file per entry (`.md` with the rich-text body, else `.json`); Next writes
  `content/collections/<collection>/*.json` and a typed `lib/collections.ts`. Bound lists are filled from `entries()`
  in the page (shaped like the section's content file, so components don't change); template pages become
  `[slug].astro` with `getStaticPaths` / `app/…/[slug]/page.tsx` with `generateStaticParams`. Entry pictures go to
  `public/media/collections/`.
- Not yet: the account sync on the server (`collections` tables, API, access, plan limits) and rendering a whole
  rich-text body as HTML in a section (template pages show its first paragraphs).

### The brief

What the site is for (`core/brief.ts`, `content.brief`): a format (landing page, small business site, portfolio, blog,
event page), an industry (the site library's ids plus services and other), goals (take bookings, get sign-ups…), who
it's for and what it is in the owner's words, and the main button's words. Context, never copy: nothing composes from
it, except the main button's words, which `contentFor` puts in the hero, nav, cta and footer buttons (yours only when
typed). `content.kind` stays and follows it (`kindOf`); a mix without one reads one from its kind (`briefOf`). It steers
Jev's requests (`briefContext` is the one sentence they get), Add section (goal sections first, "Suggested for…"),
starters (`industries`/`formats` in their JSON), the photo search's first words (`INDUSTRY_PHOTO`), and goes to the agent
as "What this site is for" in BLOKMIX.md and `brief` in blokmix.json. Store: `setBrief` (one undo step). Agents:
`get_brief`, `set_brief`; `get_page` includes it.

### Content

Words are content (`core/words.ts`, `core/lists.ts`, `core/outline.ts`); the UI calls it Content, never "CMS".
- The board's left side is a slim rail, Design · Content · Notes (`ui/shell/LeftPanel.tsx`, `ui.leftPanel` look/words/notes, G
  and W; on a narrow window the same three start the dock and open a sheet from the bottom); the open one docks beside the page, which stays in view and fits beside it (`setInset`).
  The top bar holds the mix, draft and page on the left and Share · Publish · Export · Save version on the right.
- Words (`ui/words/WordsPanel.tsx`) is your words beside the page: the site's name and logo, "What it's for" (the brief, to
  change), "18 of 31 are yours" and Next (the first spot still holding sample words), then each section top to bottom
  (`ui/content/PageDoc.tsx`: each field at its size on the page, by `roleOfField`, typed into in place; focusing one selects
  its block and scrolls the page to it). Under each section's name, the layouts that hold its words (`core/wordsFit.ts`
  `itemsOf`, `layoutsThatFit` over `cycleIds` and `capacity`, built-in first) and, with suggestions on, "These words read
  like a FAQ" with Make it one (one Jev request per page, `readsAsRequest`, cached by its words, `state/wordsFit.ts`;
  `state/retype.ts` `retypeSection` pours the section's own words into a layout of that type, same id, one undo step).
  Write or paste at the end (the whole start of an empty page): Show me sections reads it (`planPage`) and lists what it
  would make, in three arrangements, to add as a new page or replace this one; or place the lines into the sections here
  (`pour_words`). Text not placed yet is listed below. The panel and the page follow each other as you scroll
  (`useScrollSync`, `canvasApi.revealRow`, `onSettle`). Whose words they are comes from `core/ownWords.ts` (`fieldOwner`,
  `pageOwnership`): yours (in `slot.words`, or `content.mine`) or not yet (sample words, muted and marked). Agents:
  `suggest_layouts_for_words`, `retype_section`.
- Your site's name (`content.brand`, Content → "Your site's name", `set_brand`) changes everywhere it's written when you
  finish typing: fields, each section's words and kept options, whole words only (`renameBrand`), one undo step.
- Your logo once (`content.logo`, `set_logo`) fills the nav's and footer's logo spot (`isSiteLogo`) wherever it has no
  picture of its own, clipped or built in (`pictureFor`'s `site` argument).
- Colors are picked in Blokmix's own picker (`ui/color/ColorPicker.tsx`, `ColorButton`; never `<input type="color">`): the hex first
  (paste or type, `core/colorInput.ts` `parseColor` takes hex, short hex and rgb()), copy and the eyedropper; a ring of hues around
  a disc of the color (drag round it, ← →); one Shade slider, Deep to Light, in OKLCH (the knob is the Feel dials'); named swatches (`NAMED_COLORS`); for a brand color, the palette
  it makes. Escape puts it back; Use this color or a click outside keeps it.
- One brand color (`guide.brand`, the Feel tile, `set_brand_color`) makes a whole AA palette (`paletteFrom`), and
  `applySkin` remakes the theme's colors from it unless the contract keeps color (stays) or sets it to Surprise.
- Trying another layout keeps your pictures and links (`carryEdits`, run by `withClip`): by picture name (any logo spot
  to any logo spot), then the rest in page order; links by the words they hold. Never over what the layout has.
- Every field's words have options (`slot.options`): your copy, the clip's words, and options you or an
  agent kept. ‹ 2/3 › in the block bar (or `[` `]`) cycles them; Keep, Retire, Put it back and "Another way
  to say it" are Koati's words.
- Adding items: the pill by an item's grip adds one right after it (`editList` add `after`), duplicates or removes it. A
  grid whose count changed rebalances (`rebalance`: another per-row count that fills every row, else the last row
  centred, as `data-mx-span`/`data-mx-start` drawn by `GRID_SPAN_CSS` on wide screens); a copy drops classes that place
  one item (a bento's `c1`); a new item's title reads "New feature" until you write one.
- Lists (`slot.lists`, by the key their fields are numbered by) add, duplicate, remove and reorder items on
  the canvas (block bar, ⌘D, ⌥←/→, ⌫) or in the Content view. Frames patch the changed list in place
  (`FrameState.lists`); blocks in a copied item get ids like `b5.f4`, so edits and notes follow items.
- Navs can add an announcement banner (`slot.banner`, `core/banner.ts`): the same `banner` block a clipped
  ticker is, with notice fields, the same looks, inserted just before the nav's root (so the nav's own
  padding stays). A nav clipped with its own ticker uses that one; hiding either removes it.
- Exports write each section's words to `src/content/<section>.json` (Next: `content/`). Components read
  `{content.heading}`, map lists whose items are built alike (`{content.features.map((item, i) => …)}`), and
  carry `data-mx-src="<file>#<path>"` (Koati's `data-koati-src` idea). BLOKMIX.md points to Keystatic as an
  optional editor.

### Links

Clips write links as `href="#"`; sections decide where they lead (`core/links.ts`, `BlockEdit.link`): a
section on the page (exports give every section an anchor, `#pricing`), another page (`/about`, listed in
BLOKMIX.md for the builder to create), a web address (new tab, `rel="noopener noreferrer"`), email or phone.
Unset links follow their words ("Pricing", "Questions" → that section; emails and numbers → mailto/tel).
A block is linkable when it is, or holds, its own `<a>`. Previews follow section links on the canvas.

### Fonts

The style guide's fonts come from your clips or the font library (`core/fonts.ts`): ~180 free fonts from
Google Fonts, Fontshare and Fontsource (free for commercial use), sorted by vibe after "Usable Google Fonts",
plus a "Studios & open source" collection crediting each maker (Vercel's Geist, GitHub's Mona Sans, IBM Plex…). The picker
previews each in your brand name (Pica-style), hover previews on the page, and agents use `list_fonts` +
`set_token`. Frames and exports load one stylesheet per provider (`fontHrefs`). `npx vite-node
scripts/check-fonts.ts` checks every library font still loads.

### Images

Image blocks take a fill (`BlockEdit.media`, `core/media.ts`): a placeholder SVG drawn from the
current palette (re-themes with the style guide), an upload (downscaled WebP in the browser's
IndexedDB via `lib/assets.ts`, never in the persisted store), or an Unsplash photo (hotlinked, credited,
download-tracked; needs `VITE_UNSPLASH_ACCESS_KEY` in `.env.local`). Frames and exports layer an
`<img class="mx-media">` over the block's own art, which keeps the size and shape. Exports write
`public/media/*`; `npm run export:demo` squeezes raster images with Dinky's CLI (dinkyfiles.com) when
`dinky` is on the PATH (or `DINKY=/path/to/dinky`), and BLOKMIX.md tells the agent the same command.
Image blocks can also hold moving media: a video, a Lottie (`.lottie`/`.json`) or a YouTube/Vimeo embed
(poster first, player on click), with a trigger (autoplay, hover, in view, click, scrub for Lotties), loop,
lightbox and a custom thumbnail. `core/export/media-runtime.ts` is the one player for both the canvas frames
and exports (`public/mx-media.js`); a frame's lightbox opens over the whole app. Reduced motion never autoplays.
Authored clips still use CSS/SVG art only (rule 5).

### Treatments

The visual layer (`core/treatments/`): parameterized, palette-driven generators tuned with DialKit-style dials
(`ui/dials/DialPanel.tsx`: presets, scrub-a-label sliders, palette colors that open when asked, Shuffle/Reset; dragging previews,
letting go is one undo step). One spec (`params.ts` `ParamSpec`) drives the dials, the agent schema (`zodFor`), the
packet text (`describeParams`) and the defaults. Colors are palette roles (`primary`, `accent`…) so they re-theme.
- **Effects** (`effects.ts`, `guide.effects`, Style guide → Effects tile): shadow, gradient, grain, glass, glow become
  `--mx-shadow-sm/card/lg`, `--mx-gradient`, `--mx-grain`, `--mx-glass-fill/blur/edge`, `--mx-glow` after the tokens
  (the shadow effect is also the `shadow.card` token). Looks read them with their old values as fallbacks (gradient
  buttons and headings, glass/grain/glow cards, lifted shadow, glow hover). Curated sets: `samples/treatments/*.json`.
- **Backdrops** (`backdrops.ts`, `slot.backdrop`, the Style panel): each sits where `anchor` says (the whole section, or a spot on a 3×3 pad) and fades out by `reach`, on a masked `::before` (a live one masks its `.mx-backdrop`); new picks start at `backdropPlace`. They are: gradient, mesh, grain, dots, grid, lines, topo,
  halftone, op-art stripes, spotlight, orb, as background layers on the section root in `@layer effects`
  (`LAYER_ORDER` is `base, clip, effects, motion, blocks`). Inverse flips the section to primary.
- **Generative fills** (`fills.ts`): more `PLACEHOLDER_STYLES` (dither, halftone, topo, flow, blocks, ascii, op-art,
  marble, grain-gradient) drawn as small SVGs; `MediaFill.params` holds their dials.
- **UI mockups** (`mocks.ts`, `samples/mocks/<id>/mock.{html,css,json}`, `lintMock`): small screens in HTML/CSS
  (tokens only) in a browser/phone frame with tilt, surface and seeded numbers; `MediaFill {source: 'mock'}`. Frames
  insert the markup; exports write it into the section with its CSS.
- **Live shaders** (`shaders.ts`, Paper Shaders `@paper-design/shaders`, Apache-2.0): mesh gradient, grain flow,
  dithering, liquid metal, fluted glass (looking through a palette placeholder) and god rays, as backdrops (after the
  CSS ones in `BACKDROP_IDS`, plus strength; like every backdrop they draw in the section's surface colors) and as fills (`MediaFill {source: 'shader', shader}`); all
  `live: true` in `treatmentList`. `shaderSpec`/`media.ts` `shaderFor` turn dials into uniforms (palette colors as
  0–1 RGBA; seed is the start frame). One element everywhere: `<div class="mx-shader mx-media|mx-backdrop"
  data-shader='{id,u,speed,frame,image?}'>` (a live backdrop is the section root's last child at z-index -1; its CSS
  stand-in, isolation and strength come from `backdropCss`).
  - The player is `frame/shader-runtime.ts` (`installShaders`, `mountShader`), bundled by
    `npx vite-node scripts/build-shaders.ts` into `core/export/shaders-runtime.generated.ts` (`SHADERS_JS`; rerun after
    updating the package, a test checks the version). Frames ask for it once they show a shader (`needShaders` →
    `shadersJs`), get the backdrop as `FrameState.backdrop`, and update uniforms in place while you drag a dial. Only
    the clip on show runs shaders (`withoutShaders` for hidden alternatives): each holds a WebGL context.
  - Exports write `public/mx-shaders.js`, `SHADER_CSS` in base.css and a poster PNG per shader (`ComposedPage.shaders`).
    Compose writes a stand-in poster (`standInPoster`, pure TS); the export panel and `prepare_build` bake the real
    one in the browser (`lib/shaderPosters.ts` `withBakedPosters`, which also draws picker thumbnails). Reduced motion
    and browsers without WebGL keep the poster; frames have none, so they draw one still frame.
- Agents: `list_treatments`, `set_effect`, `apply_look`, `set_section_backdrop` (shader ids too), `set_mock`,
  `set_image` params (and `shader` + `preset` for live fills).
- Capture: `extension/src/capture/effects.ts` `detectEffects` puts a section's effects in clip.json (`effects`); the
  site library keeps a site's in `library_sites.effects` (summary lists which, full site gives the values).

### Built-in layouts

Layouts are clips from the `layout` source, moving to bare wireframes: structure only, with every look left to the skin. They
follow every rule above, fill every field in their type's schema where it makes sense and avoid any brand name in static text.
All of them (`BARE_TYPES`, `core/lint.ts`) pass `lintBones` in `npm test`: no accent, gradient, shadow,
tilt, filter, `::before`/`::after`, fixed container width or `motion.css`, and pictures hold only the wireframe cross
(`svg.x`, in `samples/layout-primitives.css`). A logo is plain words (`data-mx-media="logo…"`). A nav shares the page's background: no filled bar. Keep what makes a layout distinct: its arrangement, fields, blocks and working
interactions. One main button per section; every quieter action has the class `secondary`. The section root is always the page color, since bands are the skin's. All must read clearly under every skin.

### Layout primitives

Built-in layouts share one set of class names, so the library reads as one component system and captured clips
can later be normalised onto the same names. `samples/layout-primitives.css` holds the canonical rules: a clip
copies the ones it uses under its own root (rule 2) and adds its own after them. `npx vite-node
scripts/lint-clips.ts <type|clip id>` lints and summarises clips; `npx vite-node scripts/render-clips.ts <type|clip id>
--sources layout` screenshots them at 1440 and 390 into `.out/renders/clips/`.
- **Section** (the root): surface, `--mx-space-section` top and bottom, a `--mx-space-8` gutter (`--mx-space-5` on phones).
- **`.container`**: the content width, `max-width: var(--mx-width-content)` (1200px by default); `.container.narrow`
  `var(--mx-width-text)` (760px) for reading columns and centered stacks. Never a fixed px width (lint warns).
- **`.head`**: the header group, in order `.eyebrow`, `.heading` (`.heading.display` for the hero-sized one), `.lead`
  (intro, subhead, lead), `.actions`; `.head.center` centers it. Whatever follows a head sits `--mx-space-9` below.
- **`.actions`** of `.btn.primary` (one per section) and `.btn.secondary`; `.note` for the small line under them.
- **`.stack`**: a vertical run sharing one spacing step.
- **`.grid`**: a 12-column rail. Children take `.col-N` (span N) and `.start-N`: 2-up `col-6`, 3-up `col-4`, 4-up
  `col-3`, splits `col-7` + `col-5`, a centered column `col-8 start-3`. Below 1080px `.t-col-6`/`.t-col-12` re-span;
  at 760px every child goes full width unless it is `.m-col-6`. Lists are grids too (`<ul class="grid">` of
  `<li class="col-4">`), so added items keep their span. Other spans and starts (`col-10`, `start-7`) follow the same
  pattern; a clip's own 1080px re-span must be repeated in its 760px rule, or it beats `.grid > *` there. A grid nested
  in a column needs room for its 11 gaps (352px): nest one in `col-6` or wider, or narrow its `column-gap`.
- **`.split`** (on a `.grid`): copy and media side by side, centered (`.top` aligns to the top, `.reverse` puts the
  last child first on desktop).
- **`.band`**: an inset surface panel; `.band.inverse` flips to the primary color (eyebrow, lead and buttons follow).
- **`.card`** (bordered; `.card.soft` filled) holding `.title`, `.body` and `.meta`.
- **`.media`**: a picture's frame (`data-mx-block="image"`) with placeholder art from `.art`, `.dots`, `.orb`, `.slab`;
  `.avatar` is a gradient circle with initials.

### Token variables

| Var | Meaning |
|---|---|
| `--mx-color-bg/surface/text/muted/border/primary/on-primary/accent` | colors |
| `--mx-font-display/body/mono` | font stacks |
| `--mx-type-display-weight` | display font weight |
| `--mx-text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl/6xl` | modular type scale from base × ratio |
| `--mx-space-0…10` | 0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32 × space unit (unit is 4px in every sample) |
| `--mx-space-section` | vertical section padding |
| `--mx-radius-sm/--mx-radius/--mx-radius-lg/--mx-radius-pill` | radii (pill is 0 when radius is 0) |
| `--mx-stroke` | line weight for borders and rules (`stroke.width`) |
| `--mx-shadow-card` | card shadow |
| `--mx-motion-duration/--mx-motion-ease` | motion |
| `--mx-width-content` / `--mx-width-text` | the content column and the reading column (tokens `space.content`, `space.text`) |
| `--mx-vh` | 1% of the captured viewport height |
