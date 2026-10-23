# Mixtape

Canvas prototype for clipping website sections, remixing them like a sliding-tile
puzzle, resolving one style guide, and handing a packet to an agent that builds
Astro or Next.js. Frontend only for now; the layout (`resources/js`, `@/` alias,
`pages/`) mirrors the Laravel React starter kit so it can move into Laravel +
Inertia on Laravel Cloud later.

## Commands

- `npm run dev`: Vite on http://localhost:5173 (Browser pane: launch config "mixtape")
- `npm test`: Vitest (core logic, clip lint, exporters)
- `npm run typecheck`, `npm run build`
- `npm run export:demo`: writes the seeded demo packet to `.out/`

## Agents

Everything you can do on the canvas is a command in `resources/js/core/commands/schema.ts`
(zod schemas → tool definitions), run by `resources/js/state/commands.ts` through the same store
actions as the UI. Each write is validated and lands as one undo step; agent edits show a toast.
- In the browser: `mixtape.tools()` and `mixtape.run(name, input)`.
- Over MCP: `npm run mcp` starts `scripts/mcp-bridge.ts` (stdio MCP server + a WebSocket on
  127.0.0.1:4317 that only Mixtape's local origins may join). Add it to Claude Code with
  `claude mcp add mixtape -- npm --prefix /Users/heyderekj/mixtape run -s mcp`, then turn on
  "Let agents edit this tape" in Mixtape's menu (off by default). `scripts/mcp-smoke.ts` is a
  quick end-to-end check.
- New capabilities should be added as commands first, then wired into the UI.

## Layout

- `resources/js/core/`: pure TS, no React or Vite APIs (reused by the future extension and MCP server)
- `resources/js/data/library.ts`: loads `samples/` via `import.meta.glob`
- `resources/js/state/`: zustand store (persist + zundo undo)
- `resources/js/frame/`: sandboxed iframe rendering + postMessage bridge
- `resources/js/ui/`: canvas, frames, panels
- `samples/sources/*.json`: fictional source sites (`*.example`, `kind: "site"`) and Mixtape's built-in
  layouts (`layout.json`, `kind: "layout"`), with their tokens
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
11. Each clip must look right at 1440px and 390px (nest `@media (max-width: 760px)` inside the root).
12. `clip.json` sets `rhythm` (`centered | split | grid | stack | band`): the section's dominant shape.
    Suggestions use it to pick layouts that contrast with their neighbours.
13. Blocks: mark what people will select, swap and restyle with `data-mx-block="<kind>"`.
    - Small blocks go on the element itself (often the same element as its `data-mx-field`):
      `heading`, `text`, `button`, `link`, `badge` (eyebrows, tags, pills), `icon`, `input`.
      A button or link may hold an icon plus its field; other small blocks hold no blocks.
    - `card`: a self-contained group (a panel, a quote card, a form card). Give it a short
      `data-mx-label` ("Panel", "Quote", "Form").
    - Repeating units are `item`s directly inside a `list`: `<ul data-mx-block="list" data-mx-list="features">`
      then `<li data-mx-block="item" data-mx-label="Feature">`. Use a singular noun for the label.
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
Nudge) for hierarchy, spacing and type; Laws of UX for behaviour; Emil Kowalski's design-engineering skill
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

### Images

Image blocks take a fill (`BlockEdit.media`, `core/media.ts`): a placeholder SVG drawn from the
current palette (re-themes with the style guide), an upload (downscaled WebP in the browser's
IndexedDB via `lib/assets.ts`, never in the persisted store), or an Unsplash photo (hotlinked, credited,
download-tracked; needs `VITE_UNSPLASH_ACCESS_KEY` in `.env.local`). Frames and exports layer an
`<img class="mx-media">` over the block's own art, which keeps the size and shape. Exports write
`public/media/*`; `npm run export:demo` squeezes raster images with Dinky's CLI (dinkyfiles.com) when
`dinky` is on the PATH (or `DINKY=/path/to/dinky`), and MIXTAPE.md tells the agent the same command.
Image blocks can also hold moving media: a video, a Lottie (`.lottie`/`.json`) or a YouTube/Vimeo embed
(poster first, player on click), with a trigger (autoplay, hover, in view, click, scrub for Lotties), loop,
lightbox and a custom thumbnail. `core/export/media-runtime.ts` is the one player for both the canvas frames
and exports (`public/mx-media.js`); a frame's lightbox opens over the whole app. Reduced motion never autoplays.
Authored clips still use CSS/SVG art only (rule 5).

### Built-in layouts

Layouts are clips from the `layout` source: polished neutral structure (Inter, near-black on white,
10px radius, generous spacing, one quiet pink accent used sparingly). They follow every rule above,
fill every field in their type's schema where it makes sense, avoid any brand name in static text, and
use CSS/SVG placeholders for imagery (soft surface-coloured blocks with subtle shapes, avatars as
initials or gradient circles from tokens). They must look finished under the neutral tokens AND under
every site's tokens, since in "Your style" they take the user's style guide.

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
| `--mx-vh` | 1% of the captured viewport height |
