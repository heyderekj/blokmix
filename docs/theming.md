# Theming

A plan, not built yet. Written 2026-11-13 after a read of the whole theming path (skins, feel, palettes, block looks,
the start, Jev). Findings marked "today" describe the code as of that date. Delivery is phased PRs; each phase ships on
its own. Copy on screen follows `docs/simple-vision.md` and the brand guide's voice: plain words, no "skin", "kit" or
"Jev" in anything a person reads.

## Why

Theming doesn't hold up. A person making a bakery site is offered Lo-fi, Dream Pop and Flyer, because themes are
offered by counting overlapping feel words. The brief's industry barely reaches them, the themes themselves are thin,
the cards that show them say little, and Jev only reads their names. We want themes that fit the site you're making,
that look finished, that you can change one part of at a time, and that Jev ranks, steers and checks.

Goals:

- Many more themes that fit an industry, each a whole, polished look.
- A shared kit of parts, so one theme can become several industry flavors and a person can swap one part without
  losing the rest.
- Jev controls, all four: rank themes for this site, change the look in words, swap one part at a time with ranked
  options, and check how the look reads against the brief.
- Everything works with suggestions off: code makes every candidate and orders them; Jev only ranks and picks from
  closed sets.

## Today (2026-11-13)

### What's there

- `Skin` (`core/skins.ts`): id, name, words, mode, feel, tokens, effects, textStyles, components, sections, picture.
  Files in `samples/skins/*.json`, loaded by `data/skins.ts`. Eight: wireframe, afterhours (dark), dreampop, flyer,
  liner-notes, lofi, studio, vinyl (dark). Named like records (commit 70ce849). Six light, two dark.
- `applySkin` writes a skin into the mix's own guide as one undo step and respects the contract per area; with a brand
  color and Color on Tweak it remakes the palette from the brand (`paletteFrom`). `surpriseMe` rolls areas from other
  skins (shown as "Mashup"). `closestSkin`, `dressSavedMix` dress mixes saved before skins when they open.
- `guide.skin` is only a label, `{id, name}`. Nothing on the server reads it; `mixFile`, `mixSync`, versions and drafts
  pass it through.
- Feel: eight words (`FEEL_WORDS`), `themesFor` ranks by the count of matching words and pads with non-matches.
  `NUDGES` (bolder, quieter, rounder…) turn Feel dials a step. The sentence in the new-mix start has its own 28 feels
  (`core/jev/sentence.ts` `FEELS`), each hand-mapped to two skins.
- Industry: `INDUSTRIES` (16) in `core/brief.ts`. `INDUSTRY_FEEL` gives 14 of them two feel words, used only by
  `feelFrom` in `core/startFlow.ts`, as a fallback when the sentence gave no feel. The Look panel ignores the brief
  (`ui.feelWords` starts empty and nothing fills it from the start).
- Jev: ranks skins in `core/jev/describe.ts` (a Choice over "Name: words", first 40, no agreement needed between option
  orders) and the `skin` intent in `core/jev/say.ts`. Find colors (`core/jev/palettes.ts`, `swatch.ts`,
  `state/jevColors.ts`) is the best existing pattern: code makes AA palettes, draws each as a little page, Jev scores
  fit and harmony per candidate, two rounds. The bench has suites `types` and `describe` only.

### What a theme can say today (and what the eight actually use)

| skin | display / body | radius | tone | button (main / quieter) | card | bands and backdrops |
|---|---|---|---|---|---|---|
| afterhours | Geist / Geist | 8 | dark | layout's own / ghost | bordered | hero, nav grid; cta spotlight |
| dreampop | Plus Jakarta Sans / same | 20 | light | layout's own / soft | glass | cta mesh |
| flyer | Archivo Black / Archivo | 0 | light | caps / outline | offset | hero, nav brand; testimonials inverse |
| liner-notes | Fraunces / Newsreader | 2 | light | layout's own / arrow | flat | hero, nav grain; testimonials soft; cta brand |
| lofi | Young Serif / Figtree | 16 | light | pill / soft | tinted | hero orb; features soft; cta brand |
| studio | General Sans / Inter | 10 | light | layout's own / outline | bordered | hero grid; testimonials soft; cta inverse |
| vinyl | Instrument Serif / Hanken Grotesk | 0 | dark | layout's own / arrow | rule | hero spotlight; testimonials soft |
| wireframe | Inter / Inter | 4 | light | none | none | none |

Thin spots, all checked in the files:

- Every skin uses the same `motion.ease`; `space.base` is always 4px; `space.content`/`space.text` are never set;
  `stroke.width` is 1px except Flyer.
- Text styles: only `label` is ever set (and tests forbid `display`).
- Block looks: only badge, card, icon and button (heading on two). Nothing for link, text, banner, image, input, item,
  though `core/blocks/variants.ts` has 73 variants.
- Section defaults: six skins paste one identical motion preset on 13 section types. No skin sets section spacing.
  Each uses 1–3 bands or backdrops.
- Effects: glass never used, glow once. Backdrops: gradient, dots, lines, topo, halftone, stripes and all six shaders
  never used. Picture styles: 5 of 15 used, grain-gradient three times.
- Fonts: 8 display/body pairs from `FONT_LIBRARY` (178 fonts). A brand color remakes only the eight colors, through
  one recipe with fixed lightness steps and six pairings; type and shape don't respond to it.
- `motion.duration` drives hover and press transitions on buttons and links, yet Liner Notes is 700ms, Vinyl 600,
  Dreampop 420, Lofi 360. The craft rule is under 300ms.
- Theme cards (`ui/skins/SkinSpecimen.tsx`) draw the site's name, one button and a 26×15 card chip. Flat and tinted
  cards look like the default. Body font, accent, effects, backdrops, pictures and icons aren't shown.

### Bugs found

1. `layeredShadow` (`core/treatments/effects.ts`) gives negative y offsets at the default 180° angle: shadows fall
   upward. Flyer's 135° offset shadow goes up-left.
2. `surpriseMe` hard-codes `mode: 'light'` and applies a "hold" contract that leaves rolled areas on Tweak. A color
   the person set to Surprise becomes Tweak, and with a brand color set the rolled palette is replaced by
   `paletteFrom(brand, 'light')`. That contradicts `applySkin`, where Surprise means the theme's colors win.
3. The weight dial writes `stroke.width` (a shape token), but `areasOfCommand('set_dial', weight)` and
   `NUDGE_AREAS.bolder` report only `type`. Keeping Shape doesn't stop it.
4. The new-mix start's `guideFor` saves `brand: {color}` with no variant and no mode: a pairing or light/dark chosen
   there is lost on the next theme swap.
5. `set_palette` (Find colors) uses `chooseTokens` and never sets `guide.brand`, so the next theme swap replaces it.
6. `hueCandidates` interleaves 12 hues × 2 then takes the first 18, so hues 280°, 310° and 340° are never offered.
7. The bench's describe suite never imports `data/skins`, so `skinList()` is empty and the look question isn't asked.
8. `themesFor` with "different" returns 0–2 themes (picking three feel words can leave none); the start tops it up,
   the Look panel doesn't. No sentence feel maps to "serious", and some map to the wrong word (`retro` → bold,
   `soft` → warm, `precise` → modern).
9. The new-mix theme carousel clips early: `Carousel` (`ui/start/parts.tsx`) scrolls inside `<main>`'s padded box
   (`px-5 sm:px-7`) and bleeds only `-mx-1`, so the next card is cut 28px short of the panel's edge, under the ›
   arrow.
10. Stale text: `list_skins` says "free"; `set_dial`'s description omits width; `data/skins.ts` mentions free skins;
    `GuideState.brand` has two doc comments; CLAUDE.md mentions `tier` and `skinOpen`, both removed in 0fada2c.
11. `ui/start/FeelColors.tsx` is imported by nothing.

Default offers today (reproduced from the code, by industry feel words): saas gets dreampop, studio, afterhours;
food gets lofi, dreampop, flyer; fintech gets studio, afterhours, dreampop; nonprofit and agency are 1-1-1 ties broken
by list order; services and other get no feel words at all.

## Design

### Principles

- Code makes every candidate (AA by construction through `paletteFrom`; fonts from `FONT_LIBRARY`). Suggestions only
  rank and pick from closed sets. With suggestions off, code order stands.
- Whole themes and flavors go through `composeTheme → Skin → applySkin`, so exports, packets and tests keep their
  meaning. A single-part swap uses a new `swapParts` that touches only that area's keys. (Reusing `applySkin` with a
  hold contract would turn every held token into a hand-edited `custom` choice and freeze candidate choices.)
- `guide.skin` stays a label: `{id: base theme id, name, flavor?}`. The id stays the base theme's so `skinById` keeps
  working (`jevDress`, `jevPhotos`, the "here" marks, `surpriseMe`'s exclusion). `skinRefOf` spreads the ref instead of
  rebuilding it. The current part per area is read from the values (`partNow`, like `closestSkin`), never stored, so a
  hand edit can't make it stale. No server change, no migration.
- Commands first, then UI. Every write is one undo step; Keep refuses (`contractRefusal`).
- Name new commands "theme", not "look": "Look" already means the panel and treatment sets (`apply_look`).

### The parts

A theme is eight parts, the same eight areas Rules for your agent already uses (`core/contract.ts` `STYLE_AREAS`).
On screen:

| Area | On screen | Holds |
|---|---|---|
| color | Colors | the eight colors; seed brand + mode + `PaletteVariant` |
| type | Type | font pairing, scale ratio, display weight, text styles |
| shape | Corners and lines | radius, stroke, card shadow, icon set |
| space | Spacing | space base, section padding, content and text widths |
| motion | Motion | duration, enter presets and speeds per section type |
| looks | Buttons and cards | block looks, label style, effects (gradient, grain, glass, glow) |
| sections | Section backgrounds | bands, backdrops, section spacing |
| pictures | Pictures | what empty pictures show |

Three cross-wirings must be fixed first, or Keep won't mean what a part says:

1. Card shadow sits in two areas: the `shadow.card` token is shape, but `effects.shadow` is looks, and the effect's
   `--mx-shadow-card` is written after the tokens and wins. Move `effects.shadow` to shape (the contract's own label
   for Shape says "card shadows"). `applySkin` (L131) and `surpriseMe` already let looks overwrite shape.
2. A type pairing needs its own heading and label styles: move `guide.textStyles` to type (`update_text_style`);
   `set_text_style` (a block picking a style) stays in looks.
3. The motion area owns two tokens; section motion lives in sections. Move `SectionDefault.motion` to motion
   (`set_section_motion`). Section spacing stays in sections. `icon.set` stays in shape.

Contract stores only a setting per area, so this needs no data change; update `AREA_LABEL` words.

A flavor is a base theme with some parts swapped (hand-made, one per industry at most). A mashup is parts from several
themes. A brand color overrides every palette part (`applySkin` remakes the palette when Color is Tweak), so a flavor
must not rely on a palette swap to look different, and with a brand color set the Colors options are its pairings in
light and dark (`PAIRINGS`); kit palettes go under "Other colors" and say plainly they drop your brand color.

### Kit data

```ts
interface Part { id: string; area: StyleArea; name: string; words: string; tags: Tag[]; industries?: Industry[]; from?: string; values: PartValues }
interface PartValues { tokens?: Partial<TokenSet>; effects?: EffectsState; textStyles?: TextStyleEdits; components?: GuideState['components']; sections?: Partial<Record<SectionType, SectionDefault>>; picture?: PictureDefault; seed?: { brand: string; variant?: PaletteVariant }; mode?: Mode }
```

`samples/kit/<area>.json` (arrays), loaded by `data/kit.ts`, plus every theme's own parts (`partsOf(skin)`, ids like
`type:studio`). Kit-only parts, kept small at first: ~12 type pairings, 6 shapes, 4 buttons-and-cards sets, 4
section-background patterns, 4 motion styles, 3 densities, 3 picture styles. Motion varies by enter preset, stagger,
speed and a duration of 300ms or less; the craft rules allow only ease-out, so a varied ease adds little.

## Phase 1a: fixes and polish (PR 1)

1. `layeredShadow`: `dx = cos(rad)`, `dy = sin(rad)`, so shadows fall down.
2. `surpriseMe`: mode from the rolled color theme (else `toneOfGuide`); the hold contract keeps the person's Surprise
   areas; the shadow follows shape.
3. Contract mapping above (`areasOfCommand`, `AREA_LABEL`, mirrored in `applySkin`/`surpriseMe`); `set_dial` weight and
   the bolder/quieter nudges write type and shape.
4. `themesFor`: stable tiebreak (a hash of the words, not pool order); "different" sorts by least fit, always fills
   `count`, skips the current theme.
5. `guideFor` keeps `brand: {color, variant}` and mode (`StartInput` gains `variant`). `set_palette` sets `guide.brand`
   (seed and variant) so a theme swap keeps it. `set_brand_color` gains `pairing?` (ids from `PAIRINGS`).
6. `hueCandidates`: `count/2` hues spread over 360°. Bench describe suite imports `@/data/skins`.
7. Copy: items 10 and 11 above, `SENTENCE_FEEL` (trustworthy and precise map to serious), `FEELS` minimal pairs with
   studio and afterhours. Delete `FeelColors.tsx`.
8. Carousel: bleed the row to the column's edges (`-mx-5 sm:-mx-7`, matching `px-*` and `scroll-px-*`), keep the
   arrows on the row's inner edge, keep the selected card's pink ring whole on the first and last card. Check at the
   540px column and the wide layout, and wherever else `Carousel` is used.
9. Enrich the eight theme files: `motion.duration` ≤ 300ms; section motion varied by type; heading text styles h2–h4
   (never display); looks for link, input and heading from `core/blocks/variants.ts`; `space.content`/`space.text`;
   2–4 bands or backdrops; a distinct picture style each. Review with `npx vite-node scripts/render-skins.ts`.
10. Richer theme cards: `core/kit/specimen.ts` (pure): `specimenScene(look, words) → Scene` and `sceneSvg(scene)`;
    headline, a body line, main and quieter button, a card, a band strip, the picture style. `SkinSpecimen.tsx` draws it
    inline (fonts through `FontLinks`); the Look panel's Themes tile goes to two columns. Phase 3 reuses the scene.

Tests: shadow y positive at 180°; surpriseMe with a dark theme and a brand color gives a dark palette, and Surprise
color keeps the rolled palette; contract moves (Keep shape refuses the weight dial, Keep motion refuses
`set_section_motion`); `themesFor` different always fills; brand variant survives start → swap and Find colors → swap;
`hueCandidates` spans 360°; every theme file ≤ 300ms. Update `tests/skins.test.ts`, `feel.test.ts`,
`jev-looks.test.ts`, `make-it-yours.test.ts`.

## Phase 1b: the kit and "Change one part" (PR 2)

- `core/kit/types.ts` (above). `core/kit/areas.ts`: `AREA_FIELDS`, one map from each area to its token keys and guide
  fields (sections split per field); `applySkin` and `surpriseMe` refactor onto it.
- `core/kit/index.ts`: `parsePart`, `registerKit`, `kitList`, `partsOf(skin)`, `composeTheme(base, parts, meta) →
  Skin`, `swapParts(guide, parts, contract) → GuideState | null` (null when kept), `partNow(guide, area)`,
  `partOptions(area, ctx)` (ordered by code: tags, industry, mode).
- Commands (`core/commands/schema/skins.ts`, `state/commands/skins.ts`): `list_theme_parts {area?}` (read),
  `set_theme_part {area, part}`, `set_theme_parts {parts}` (one undo step; `areasOfCommand` maps them). Store action
  `swapThemeParts`.
- UI: `ui/panels/guide/Parts.tsx` in Look, "Change one part": a row per area (name, current part or "Your own",
  ‹ n of m ›), each step one undo step with a flash; a kept area reads "Kept" and links to Rules for your agent.
- Tests (`tests/kit.test.ts`): composing a theme from its own parts equals `applySkin` (resolved tokens and guide
  fields match); `swapParts` changes only its area; Keep refuses; every color part passes AA on every band and with any
  brand color (added to the existing readability loop, sampled if it nears the timeout); every type part's fonts load
  at its weight; every motion part ≤ 300ms; `partNow` finds each theme's parts.
- CLAUDE.md: the kit, `swapParts`, part names on screen, the area mapping, motion ≤ 300ms, commands.

## Phase 2: themes by industry (PR 3)

- Eight new themes in `samples/skins/`, named like records, filling gaps. Working names: Gatefold (architecture,
  premium), Deep Cut (AI, dark), Mastered (fintech), Acoustic (health), Field Recording (travel, nonprofit), Mixtape
  (shops, food), Press Kit (media, events), Homeroom (education). Sixteen in all.
- `Skin` gains `industries?`, `formats?`, `tags?` and `flavors?: {id, name, words, industries, parts}[]`, about one
  hand-made flavor per industry, never palette-only. Never show computed flavors to people.
- `core/kit/tags.ts`: one feel vocabulary (~16 tags; `FEEL_WORDS` a subset, the Look chips stay eight). `FEELS` in
  `sentence.ts` drop their hand-picked skin pairs for tags; `fill.looks` comes from the ranker.
- `core/kit/industries.ts`: `INDUSTRY_PROFILE: Record<Industry, {tags, avoid, mode?}>`; `INDUSTRY_FEEL` and `briefFeel`
  derive from it (type-only imports to avoid a cycle). Covers `services` and `other` too.
- `core/kit/rank.ts`: `themeCandidates({brief, tags, mode?, current?})` (ids `studio` or `studio/clinic`) and
  `rankThemes(cands, n, {different?})`, with diversity on palette family, type and mode. `themesFor` wraps it.
- `core/skins.ts`: `themeById` resolves flavors through `composeTheme`; `applySkin` writes `{id, name, flavor}`;
  `dressSavedMix` uses a frozen `LEGACY_DRESS_POOL` (today's eight), since new themes would otherwise change how old
  version snapshots look when they open.
- Brief: `Brief.feel?: Tag[]`, set by the start (`briefFrom`) and `set_brief`; the Look panel's feel chips read and
  write it (one undo step, shared across drafts), so the panel opens on themes for this site.
- Commands: `apply_skin {skin, flavor?}`; `suggest_themes {words?, industry?, format?, different?, count?}` defaulting
  to the brief and returning flavors; `list_skins` returns industries, formats, tags, flavors.
- UI: the start's look step and the Look panel show best fits for the brief; the start's "Best fit" badge becomes
  "Suggested"; point some starters at the new themes (none covers education, travel, nonprofit or other today).
- Tests: pin 16 ids; every new theme and flavor passes the whole-look, AA, fonts and readability checks; every industry
  gets ≥3 candidates with different palettes and type; `rankThemes` is deterministic; every sentence feel brings up ≥2
  themes; `closestSkin` maps each theme to itself. `scripts/render-skins.ts --flavors`.
- CLAUDE.md: themes and industries, `brief.feel`, commands.

## Phase 3: Jev controls (PR 4; restyle may split to PR 5)

Spike first (one day): font-true pictures. An SVG drawn through an `<img>` can't use webfonts, which is why Find colors'
swatches use bars for words. Route: `lib/themeShot.ts` `ensureFonts(tokens[])` (append `fontHrefs`, then
`document.fonts.load('600 48px "Family"')` per face) and `paintScene(scene)` with Canvas 2D `fillText`; placeholder
pictures as SVG through `<img>` then `drawImage`; bands as flat color (CSS backdrops can't be painted). The other route,
embedding woff2 as data URIs, needs CORS from each provider (not checked for Fontshare). Jev then judges a specimen, not
the page, so the words say "how the theme reads". Limits (`core/jev/limits.ts`): 20 images and 200 questions per
request, 280–1568px a side, under 1MB. The slow part is loading ten or more families cold, not the ~100ms calls.

- `core/jev/themes.ts`: per candidate a Score `fit_i` against the brief (`briefContext`, feel, headline) and a Noul
  `together_i`; `rankThemeAnswers`. Pattern: `core/jev/palettes.ts`, `state/jevColors.ts`.
- `core/jev/checkLook.ts`: Jev can't say which area is wrong from one picture, so draw the current look plus one per
  area with its best alternative swapped in (≤9 images) and Score each; the biggest gain is "the one change". The same
  answers fill each part row's "Suggested".
- `core/jev/restyle.ts`: per area a `shuffled` Choice over the kit's options in words plus "keep as is", an industry
  Choice ("like a law firm"), and the NUDGES; `restyleCandidates` builds up to three `set_theme_parts` inputs.
- `state/jevThemes.ts`: `rankByEye` (round one: code's top 10; round two: flavors of the top 3, ≤9), `checkLook`,
  `restyle`. Start the request early in the new-mix flow; show code order at once and never reorder cards under the
  pointer; mark Jev's pick "Suggested".
- Commands (`schema/jev.ts`, async prepare then apply): `rank_themes {count?, flavors?}` (falls back to code order,
  `by: 'words'`), `restyle {text}` (returns options with ready inputs, changes nothing), `check_look {}`.
- Say it (`core/jev/say.ts`): the `skin` intent becomes `theme` and opens restyle; "more premium" leaves the `dress`
  examples. Add a Say it bench suite (none exists).
- UI: "Suggested" on theme cards and part rows; `ui/panels/guide/Restyle.tsx` ("Say how it should change", three
  cards, Use this); `ui/panels/guide/FitCheck.tsx` ("Does it look like a bakery?", a verdict from a closed set code
  writes, a one-tap fix).
- Bench: `scripts/jev/suites/themes.ts` (~40 labelled briefs, top-3 hits against code order), plus `restyle` and `say`.
  Change thresholds only on its numbers.
- Tests (`tests/jev-themes.test.ts`, `fakeJev`, `themeShot` mocked): ≤20 images and ≤200 questions per request, the
  fallback when Jev returns null, one undo step, Keep refuses, options asked in both orders.
- Order: rank and check first (they share the drawing and request code; part "Suggested" comes free), restyle after.
- CLAUDE.md: the Jev feature list, new on-screen words, bench suites.

## Risks and open questions

- Dressing: `dressSavedMix` runs on open for snapshots with no skin; keep it on the frozen pool (Phase 2).
- Contract area moves change what Keep covers. Nothing stored changes, but a mix with Keep on Shape now also holds the
  card shadow, and Keep on Type also holds text styles. Say so in the Rules for your agent words.
- Brand color erases palette flavors; only non-palette parts should carry a flavor's difference.
- Font loading cold is the latency risk for Phase 3; the spike decides canvas against data-URI fonts.
- Section motion per type and a varied look per theme mean more to review by eye: use `render-skins.ts` at 1440 and 390
  for every theme and flavor.
- The 28 sentence feels and the 8 Look chips need one vocabulary (tags) before any ranking is trusted.

## Verification (each PR)

- `npm test`, `npm run typecheck`, `npm run build`; `php artisan test` before merge.
- `npx vite-node scripts/render-skins.ts` (`--flavors` in Phase 2) at 1440 and 390; look at every theme.
- Browser pane (`blokmix` launch config): a new mix as a bakery, a fintech app and an architect; the look step offers
  fitting themes, the carousel runs to the panel's edge, a brand color and light/dark survive a theme swap; the Look
  panel opens on themes for the brief; "Change one part" steps each area with undo; Keep refuses.
- Agents: `blokmix.run('list_theme_parts')`, `set_theme_part`, `suggest_themes`; in Phase 3 `rank_themes`, `check_look`,
  `restyle`, with suggestions on and off.
- Phase 3: `npx vite-node scripts/jev/bench.ts themes restyle say`.
