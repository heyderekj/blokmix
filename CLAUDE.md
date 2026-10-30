# Blokmix

Canvas prototype for clipping website sections, remixing them like a sliding-tile
puzzle, resolving one style guide, and handing a packet to an agent that builds
Astro or Next.js. Frontend only for now; the layout (`resources/js`, `@/` alias,
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
- Mixes are saved in the database (`mixes`: name + `data` json with site, guide, content, notes, heads;
  `mix_versions`: one row per version node). `/{short}` hands the board the mix as props, and
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
  is off until there's a mail service. The board takes your account's name for marks and versions.
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
- Each mix has its own clip set (`clips` in its data): captures added while it's open join it, the Crate's ✓ keeps or
  drops one, and sections it uses always count. The Crate and Alternatives show This mix / All your clips / Layouts (a focused section opens nothing by itself: the dock's Layouts button grows its alternatives);
  agents use `list_mix_clips`, `add_clips_to_mix`, `remove_clip_from_mix`.
- Site library (Landbook-style, `lib/siteLibrary.ts`, `ui/library/SiteLibrary.tsx`): real sites captured offline, each page's
  sections matched to built-in layouts (`GET /api/library`, `GET /api/library/sites/{slug}`; Vite-only dev uses the made-up
  `data/librarySample.ts`). Opened from the Crate's "Sites". Clipping lands the MATCHED LAYOUT (never the site's words or
  pictures) and credits it (`slot.inspiredBy`, shown in the Source tab, written to blokmix.json and BLOKMIX.md; a slot
  without one falls back to its clip's). A site's look joins the style guide as candidates `src:site:<slug>#<group>`
  (`promoteSource`, `candidateSource`). Agents: `list_library_sites`, `get_library_site`, `clip_from_site`, `use_site_style`.
  New mix → "Start from a site" posts a page's layouts plus the site's look (`mixFromSitePage`).
- Saved style guides (`style_guides`, `Api\StyleGuideController`, `lib/styleGuides.ts`): save a mix's guide under a
  name from the Style guide panel, or swap one in (`replaceGuide`, one undo step). New mix → "Start from…" offers
  starter mixes and style guides (neutral, a saved guide, or another mix's): it posts `guide` (and a starter's `site`
  and `name`) to `/mixes`, which stores `data = {guide, site}`; the board fills the rest from a blank mix. Every mix
  keeps its own copy, so edits never spread.
- Plans (`users.plan`, `config/blokmix.php` `plans`): Free is 1 mix you own, 40 clips and 100 MB of uploads; Plus is
  unlimited mixes and clips and 10 GB. Mixes and uploads count toward the mix's owner (an editor's upload uses the
  owner's room); clips toward whoever saved them; shared mixes, layouts and placeholder art never count. `User`
  `mixRefusal`/`clipRefusal`/`uploadRefusal` say why, and the controllers refuse with 403 and that message (the web
  New mix gets it as `errors.mix`). Existing work over a limit is kept; only adding more is refused. The people who run
  Blokmix are always Plus. `plan` isn't fillable: checkout will set it. Inertia shares `auth.plan` (name, limits,
  usage); the mixes page shows it, and the board flashes an upload refusal once and keeps the file in the browser.
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

The audience is non-designers first (`docs/simple-vision.md`). New mix (and the browser-only mix's first visit, or
"Start a new mix" in its menu) opens `ui/start/StartFlow.tsx`: what you're making (`KINDS`), a feel (`core/vibes.ts`:
Calm, Friendly, Editorial, Technical, Bold, Sketch), an optional brand color (`core/palette.ts` `paletteFrom`, AA on
every `CONTRAST_PAIRS`), then three starts. `core/start.ts` `startCandidates` offers matching starter mixes
(`samples/starters/*.json`, checked by `checkStarters`) first, then fills the kind's `RECIPES` from the library with
`suggestClip` plus feel tags. Its words come from `core/startWords.ts`: every field of every section, per kind, with the
name, an email and the year filled in (a test keeps Blokmix's own demo words out). `lib/start.ts` measures each at a laptop, a phone and widths between
(`lib/measure.ts` `measureFirstScreen`) and `core/score.ts` `scorePage` says in plain words how its first screen
holds up (after Shu Ding's "The Calculus of Interfaces"). The pick becomes the mix; every start is kept as a version
(A/B/C). Hosted, it posts to `POST /api/mixes`; agents use `suggest_starts` and `apply_start`.

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
  production hosts without `--production`). `docs/layout-coverage.md` maps archetypes to layouts.

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
7. Interactions without JS: `:hover`, `:focus-visible`, `<details>`, radio inputs + `:has()`.
8. Copy: `data-mx-field="<name>"` on LEAF text elements only, names from `FIELD_SCHEMA` in
   `core/content.ts`. Put every piece of real copy in a field so "your copy" replaces it fully.
   Decorative static text (labels like "01", "↗", "Fig. 1") must not mention the source brand.
   A duplicate of a field (e.g. the second half of a seamless marquee) uses `data-mx-mirror="<field>"`
   so it follows the swapped copy too.
9. Siblings that need visual space between them get it from flex/grid `gap`, never from whitespace
   between inline elements (JSX drops it).
10. Use typographic quotes (’ “ ”). Avoid `{` `}` in text unless inside `<pre>`/`<code>`.
11. Each clip must look right at 1440px and 390px, and at 1080 and 768 in between. Breakpoints answer to the section, not
    the viewport: nest `@container (max-width: 760px)` (and 1080px) inside the root for what's inside it. Every section root
    is a size container (`.mx-section`, `[data-mx-section]` in the base CSS), so a layout fits wherever it sits: a page, a
    column, a preview. A container can't query itself, so the root's own declarations (its gutter) and rules on the root
    itself (`&.reverse`, `&::before`) stay in `@media`. Lint warns on viewport width breakpoints; `npx vite-node
    scripts/containerize-clips.ts [ids]` converts them (`core/containerize.ts`, also run on every capture). Bleeds to the
    window's edge (`calc(50% - 50vw)`) stay in `vw`.
12. `clip.json` sets `rhythm` (`centered | split | grid | stack | band`): the section's dominant shape.
    Suggestions use it to pick layouts that contrast with their neighbours. It also sets `style`
    (`minimal | editorial | bold | playful | technical | warm`, the Crate's facets), `feel` (one or more of
    `calm | friendly | editorial | technical | bold`, the guided start's vibes) and `density` (`airy | balanced | dense`);
    captured clips may leave them out.
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
    - Pictures (CSS/SVG art standing in for a photo, illustration, screenshot or avatar):
      `data-mx-block="image" data-mx-media="<name>" data-mx-ratio="<w>/<h>"`. Keep the placeholder art inside;
      a real image replaces it later. Media names are unique in the clip.
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
  layout (`rhythm`), `style` and `density` from clip.json, plus tone, color family and pictures read off the clip
  itself (OR within a group, AND across groups; a group shows only when the shelf's clips differ in it). Search and
  filters live in `ui.crateQuery` / `ui.crateFacets` and survive picking another section.
- Starter mixes (`samples/starters/<id>.json`, `core/starters.ts` `buildStarter`): pages of layout ids plus `tokens`,
  a sample style guide that lands as your own values. The demo seed (layouts, neutral guide) is built the same way. New mix
  offers them; agents use `list_starters` and `start_from_starter` (replaces pages and guide, one undo step).
- Dials (`core/dials.ts`, the Feel tile atop the Style guide): spacing, type size, roundness, weight and width (the content
  and reading columns together) each move a few tokens at once (`chooseTokens`, one undo step); Light/Dark (`setTone`) swaps background and text, re-mixes
  surface, border and muted, and lifts a primary that would vanish. Agents use `set_dial` and `set_tone`; `get_page`
  reports `dials` and `tone`. The Type dial stops at a 1.333 ratio (bigger ones outgrow phones; the knob has them).
- Section surfaces (`slot.surface`, `core/surface.ts`): page, soft, inverse or brand, a band in the guide's own colors,
  set from the dots in the section bar or `set_section_surface`. Frames and exports re-mix that section's tokens only.
- Section widths (`slot.width`, `widthTokens`): narrow, standard, wide or full, against the guide's content width, from
  the width picks in the section bar or `set_section_width`. `sectionTokens` applies surface then width.
- The block bar steps through a block's looks with ‹ › around Look.
- List items move like sliding tiles: pointing at or selecting anything in an item shows its arrows on each side that
  has a neighbour on screen (`tileNeighbor`, by position, so "below" in a grid is three places on), and a click swaps
  the two (list op `swap`, one undo step; ⌥ + arrow keys too; agents: `edit_list` op `swap`). Its grip drags it: the
  list reflows live in the frame as it passes over the others (a preview `move`), a screen-wide layer holds the pointer
  over the frames, Escape cancels, letting go commits one `move`. `ui/frames/tiles.ts` shares the item rects.
- Stress-test layouts against the dials: `npx vite-node scripts/render-clips.ts <types> --variants min,max,dark`
  (also `<dial>0`/`<dial>100`); it flags page overflow, spill past the gutter and clipped text. On phones a `.grid`'s
  column gap stays at `--mx-space-4` or less (its 11 gaps must fit a phone at the widest spacing), single columns are
  `minmax(0, 1fr)`, and big prices cap at a share of the viewport (`min(var(--mx-text-5xl), 17vw)`).

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

### Content

Words are content (`core/words.ts`, `core/lists.ts`, `core/outline.ts`); the UI calls it Content, never "CMS".
- Every field's words have options (`slot.options`): your copy, the clip's words, and options you or an
  agent kept. ‹ 2/3 › in the block bar (or `[` `]`) cycles them; Keep, Retire, Put it back and "Another way
  to say it" are Koati's words.
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
(`ui/dials/DialPanel.tsx`: presets, scrub-a-label sliders, palette colors, Shuffle/Randomize/Reset; dragging previews,
letting go is one undo step). One spec (`params.ts` `ParamSpec`) drives the dials, the agent schema (`zodFor`), the
packet text (`describeParams`) and the defaults. Colors are palette roles (`primary`, `accent`…) so they re-theme.
- **Effects** (`effects.ts`, `guide.effects`, Style guide → Effects tile): shadow, gradient, grain, glass, glow become
  `--mx-shadow-sm/card/lg`, `--mx-gradient`, `--mx-grain`, `--mx-glass-fill/blur/edge`, `--mx-glow` after the tokens
  (the shadow effect is also the `shadow.card` token). Looks read them with their old values as fallbacks (gradient
  buttons and headings, glass/grain/glow cards, lifted shadow, glow hover). Curated sets: `samples/treatments/*.json`.
- **Backdrops** (`backdrops.ts`, `slot.backdrop`, section Look tab): gradient, mesh, grain, dots, grid, lines, topo,
  halftone, op-art stripes, spotlight, orb, as background layers on the section root in `@layer effects`
  (`LAYER_ORDER` is `base, clip, effects, motion, blocks`). Inverse flips the section to primary.
- **Generative fills** (`fills.ts`): more `PLACEHOLDER_STYLES` (dither, halftone, topo, flow, blocks, ascii, op-art,
  marble, grain-gradient) drawn as small SVGs; `MediaFill.params` holds their dials.
- **UI mockups** (`mocks.ts`, `samples/mocks/<id>/mock.{html,css,json}`, `lintMock`): small screens in HTML/CSS
  (tokens only) in a browser/phone frame with tilt, surface and seeded numbers; `MediaFill {source: 'mock'}`. Frames
  insert the markup; exports write it into the section with its CSS.
- Agents: `list_treatments`, `set_effect`, `apply_look`, `set_section_backdrop`, `set_mock`, `set_image` params.
- Capture: `extension/src/capture/effects.ts` `detectEffects` puts a section's effects in clip.json (`effects`); the
  site library keeps a site's in `library_sites.effects` (summary lists which, full site gives the values).
- WebGL shaders are a later phase (Paper Shaders); everything today is CSS/SVG and exports cleanly.

### Built-in layouts

Layouts are clips from the `layout` source: polished neutral structure (Inter, near-black on white,
10px radius, generous spacing, one quiet pink accent used sparingly). They follow every rule above,
fill every field in their type's schema where it makes sense, avoid any brand name in static text, and
use CSS/SVG placeholders for imagery (soft surface-colored blocks with subtle shapes, avatars as
initials or gradient circles from tokens). They must look finished under the neutral tokens AND under
every site's tokens, since in "Your style" they take the user's style guide.

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
