# Blokmix Clipper (Chrome extension, MV3)

Clips a section of any live site into Blokmix's clip format (CLAUDE.md, rules 1–14).

## Use it

1. `npm run extension:build`, then in `chrome://extensions` turn on Developer mode → **Load unpacked** →
   `extension/dist`.
2. Click the toolbar button (or Alt+Shift+B). The side panel opens and the page shows the pink pick
   outline: hover a section, press ↑/↓ to widen or narrow it, then click it.
3. Choose its type (the guess is highlighted; Enter accepts it). The capture shows up in the panel with a
   preview at 1440 and 390, its lint results by rule, what capture changed, and the files.
4. **Save to Blokmix** writes straight into the repo (pick the repo folder once, or its `samples/`), or
   **Download .zip** and run `npm run clip:add -- <zip>`. Reload Blokmix and the clip is in the tray
   under Your clips. A site's first capture writes `samples/sources/<site>.json`. Later captures keep that
   file and carry their own tokens in `clip.json`.

## How it works

- `src/snapshot.ts` runs in the page as one self-contained function. It finishes entrance animations,
  parks loops, moves `:hover` off the section, and reads the DOM plus the computed styles that matter. It
  also collects `:hover` rules, keyframes and font links (cross-origin sheets are fetched by the
  background worker). The output is a plain JSON `Snapshot`.
- `src/capture/` is pure TS that turns a snapshot into a clip (it runs in the panel, tests and scripts).
  It reuses `core/` for lint, parse/serialize, icons and fonts:
  - `tokens.ts` infers the `Source` tokens: colours by role (button fill → primary, reading text →
    muted…), fonts (library or the page's Google Fonts link), type base and ratio, radius, stroke, shadow,
    section padding, motion.
  - `structure.ts` drops screen-reader-only and invisible nodes, swaps raster media for placeholder art
    (`image` blocks), turns text runs into leaves, swaps whitespace spacing for flex `gap` (rule 9), and
    sanitizes SVGs to `currentColor`.
  - `icons.ts` names icons by exact drawing match against the four curated packs, then by hints in the
    markup (`lucide-arrow-right`, `aria-label`, `data-icon`).
  - `semantics.ts` finds repeating siblings, names copy from `FIELD_SCHEMA` (numbered per item:
    `f1Title`, `t2F3`, `col1L2`), and marks blocks, cards, mirrors and the nav/footer brand.
  - `css.ts` writes `clip.css`. Each element gets only what differs from Blokmix's base CSS and the
    browser defaults, mapped to `--mx-*` tokens (colours become tokens or `color-mix()` of two, sizes go
    on the type scale, spacing on the space scale, borders use `--mx-stroke`). It adds hover states under
    `(hover: hover)` and a generic `@media (max-width: 760px)` layout.
  - `motion.ts` writes `motion.css`: animations with keyframes renamed under the root class, and
    transitions timed from the motion tokens.
- `src/picker.ts` and `src/content.ts` run the in-page picker; `src/background.ts` runs the worker;
  `src/panel/` is the side panel.

## Checks

- `npm test` includes `tests/capture.test.ts`. It captures every section of the saved fixtures in
  `extension/fixtures/` in real Chrome (via `playwright-core`; skipped when no Chrome is installed) and
  asserts the clips lint clean, use schema fields, and load through `buildLibrary`.
- `npm run extension:fixtures -- [--shots] [--samples] [name]` writes the fixture captures to
  `.out/captures/` (with original-vs-clip screenshots), or into `samples/`.
- `npx vite-node extension/scripts/e2e.ts` loads the built extension in Chrome for Testing, picks a
  section with the mouse, and screenshots the panel.

## What capture can't keep (and why the rules stay as they are)

- **Inline styling inside copy** (a coloured word in a headline, a smaller `/mo` after a price) is
  flattened. Rule 8 puts each field on a leaf element, so styled spans inside copy can't survive. The
  panel notes each one.
- **Multi-colour SVGs** become one colour (`currentColor`). Rule 3 allows no colour literals, and SVG
  presentation attributes can't hold `var()`.
- **Photos and background images** become placeholder art (rule 5). The real image can be filled back
  in on the canvas.
- **Copy with no schema field** (a "Learn more" link on a feature card) stays as static text and is
  listed. Rule 8 wants all copy in fields, but `FIELD_SCHEMA` has no slot for it. Items beyond a schema's
  count are dropped, and the panel says how many.
- **Responsive layout** is inferred, not captured. Computed styles exist only at the capture width, so
  the 390px rules are a generic pass: grids stack or pair up, wide flex rows stack, nav links hide.
- **JS-driven motion and scroll-driven animations** are left out (rule 6: CSS only, frames don't scroll).
  So are hover states in cross-origin stylesheets the extension can't fetch.
