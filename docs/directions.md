# Directions

A library of whole-page directions, each a theme and the page's arrangement curated to suit each other, ranked by
what a site's owner has shown they want. Written 2026-11-19. The engine and its commands are built; the screens wait
for the new-site start rewrite (another work session, see "Seams" below).

## Why

Before this, style and layout were never chosen together. The guided start built three pages in one theme ("they
differ in layout only"), theme and feel words had no effect on which layouts were picked, and a starter's own theme
was thrown away. Nothing learned: "Show me different ones", Shuffle, nudges and restyle text were all forgotten, and
the only saved direction was the brief's feel words. And a new site opened with Drafts B and C already beside it,
the pages you didn't pick.

## What's built

- **A new site is one draft.** `lib/start.ts` `mixFromStart` keeps only the page you open, as Draft A. The others
  were a way to choose, not drafts you asked for.
- **Directions** (`core/directions.ts`, `samples/directions/<id>.json`, loaded by `data/directions.ts`). A direction is
  a theme (or a theme's variant, `acoustic/practice`), optional parts swapped in, its own layouts per section type
  (best first; short names like `"split"` mean `hero.layout-split`), a density, the kinds, industries and formats it
  suits, how odd it is (0 safe, 1 a little unexpected, 2 strange) and one plain line on what it is and why it works.
  It isn't a fixed page: it dresses whatever sections the brief asks for (`directionPage`, through `core/start.ts`
  `fillPage`'s `prefs`), its own layouts first and the usual ranking for the rest. 21 curated, plus every starter as
  one (`directionFromStarter`, so a starter's theme finally counts). `checkDirections` keeps them honest in `npm test`.
- **Traits** (`core/traits.ts`): a closed set of words read off any style guide and list of layouts, never
  hand-tagged: the theme's feel, dark or light, serif/sans/mono/script headings, square/soft/round corners, vivid or
  muted color, airy or dense, the opener's family (`heroFamily`), picture-led or type-led, still or lively, plain or
  odd. `TRAIT_WORD` says each in a sentence.
- **Taste** (`core/taste.ts`, `content.taste`): events of what the owner showed (more, less, picked, passed, kept,
  swapped, dropped, note), each with traits, who said it (you, an agent at half weight, a reviewer) and optionally
  what it was about. `leanOf` sums them with newer ones counting more (and the brief's feel as a standing lean);
  `traitsFromWords` reads "warmer, not corporate" a clause at a time from a closed table; `tasteWords` says the lean
  ("Leaning warm, serif headings. Less dark."). It rides in `content`, so sync, the site file and undo carry it,
  and it's shared by every draft (`SHARED_CONTENT`). Context, never copy.
- **Ranking** (`rankDirections`): the theme's fit to the brief (`themeFit`, shared with `rankThemes`), the
  direction's kind, industry and format, the lean against its traits, a nudge for curated ones, and a heavy cost for
  odd ones until someone leans that way. Rows never repeat an opener family or theme; what was just passed on stays
  out; once there's any taste, the last place is a stretch that tries something not yet said either way. Pins hold
  the look or the layouts and vary the other half. When the curated ones run out, themes and openers are put together
  on the spot (`composeDirection`), ranked below. `directionStarts` turns a row into start candidates.
- **Commands** (`core/commands/schema/directions.ts`): `list_directions`, `suggest_directions` (count, more, less,
  words, exclude, odd, pin), `get_taste`, `note_taste` (more, less, words, or a ref with a reaction), `drop_taste`,
  `clear_taste`. Writes are one undo step; an agent's notes count less than yours.
- `npx vite-node scripts/render-directions.ts [--only ids] [--kind local]` screenshots each at 1440 and 390.
- `tests/directions.test.ts`, `tests/taste.test.ts` (including a made-up person with a hidden preference who only
  reacts: three rounds later the rows match it better than rows ranked without taste).

## Next

1. **The start row** (built: `core/startVersions.ts`, `ui/start/Versions.tsx`; a line to type what to change and
   removable leans are still to come). Its row of whole-page versions asks `rankDirections` /
   `directionStarts` instead of crossing themes with layouts. Each card gets "More like this" and "Not this"
   (`note_taste` with `ref`), the row a line to say what to change (`words`) and the "Leaning…" line with each lean
   removable (`drop_taste`). Mix re-rolls with the taste so far; pins are `pin`; "how odd" is `odd`. The start's
   reactions go into the new site's `content.taste` (the pick as `picked`, the rest as `passed`).
2. **The board learns too.** A taste event in the same store update as applying a theme, a part swap, a nudge, light
   or dark, a Keep in Rules for your agent, a new opener and a deleted draft, so undo takes both back. Accepted and
   dismissed agent returns (`lib/iterations.ts` `decideReturn`) and notes add events with their source. "Try another
   direction" in the Drafts panel: a row from `rankDirections`, opened as a new draft with your words carried
   (`apply_direction`). Look's themes and a section's layout arrows read the same lean.
3. **Words the table can't read** go to Jev (a `shuffled` choice per trait group: more, less or leave), with a bench
   suite; later the reader the start rewrite adds.
4. **More directions**, drafted from the site library (each captured site's matched layouts and `closestSkin` look),
   approved by a person.

## Seams

The start rewrite owns `ui/start/*`, `core/startFlow.ts`, `startVersions` and the `suggest_starts` schema. This work
adds files beside those and one function for them to call (`rankDirections` / `directionStarts`). Its plan kept the
unpicked versions as drafts; that's now one draft, and the others are recorded as passed.
