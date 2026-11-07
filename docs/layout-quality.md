# The layout bar

What every built-in layout (`samples/clips/<type>/layout-*`) meets before it ships, so a page built from them reads
as one considered site rather than a template. Layouts are bones: arrangement, type roles, spacing, hairlines and
working interactions. The look is the skin's. The checks marked **(lint)** run in `npm test` through `lintBones`
(`core/lint.ts`). The rest are for the person or agent writing the layout, checked by eye in the renders.

## Icons

- **A bare glyph.** The layout draws the icon with no tile, circle, ring, fill, border or shadow. A box around an
  icon is the skin's icon look (`components.icon`: Tile, Circle, Ring, Accent, Raised), and most skins choose none.
  **(lint)**
- **Sized by its words.** Give the icon its title's font-size; the glyph is `1.25em` of that (`.icon svg` in
  `samples/layout-primitives.css`), so its size and stroke follow the type and the Type dial. Never px. **(lint)**
- **Placed with its title.** Top-left above the title in a card or column, or `.icon.inline` beside the first line of
  a row's words (contact details, checklists). Never centred over left-aligned text.
- **Named for what the item says.** `data-mx-icon` from `ICON_NAMES` is what redraws in the style guide's pack, so it
  must fit the item's words: calendar for “How soon can we start?”, credit-card for payments. The same icon repeated
  down a list says nothing, so use a different name per item, or no icon (ticks in a list of features are the
  exception: there the tick is the meaning).
- **Only where it helps.** An icon earns its place by helping someone scan. A grid where every card leads with an
  icon of the same weight as the title is decoration; let the title lead.

## Hierarchy

- One heading per section, clearly larger than item titles, which are clearly larger than body text. Muted color is
  for secondary words only (leads, meta, body under a title), never for a title.
- **One main action.** At most one `.btn.primary` per section; every other action is `.secondary` or a link. **(lint)**
- **One eyebrow.** At most one eyebrow or badge in a head. Badges elsewhere only when they carry information (a plan's
  “Most popular”, a date, a count). **(lint)**
- One expressive treatment per section at most, and in a bare layout none: gradients, accents, tilts, shadows and
  display treatments are the skin's (`lintBones` already refuses them). **(lint)**

## Spacing and alignment

- **On the scale.** Padding, margins and gaps come from `--mx-space-*` (0 and hairlines are fine). Siblings share
  one step. A head's content sits `--mx-space-9` below it (`--mx-space-8` on phones). **(lint)**
- Text in repeated items starts at the left unless the layout is about centring (a centred stack, a big number).
- Filled containers get at least `--mx-space-5` of padding on phones and `--mx-space-6` on desktop.
- One corner shape per section (plus pill buttons).

## Fewer layers

- No decoration that competes with the words: stray dots, extra hairlines, nested bands, a border plus a fill plus a
  rule on the same card. Remove filler; keep the arrangement that makes the layout distinct.
- Three identical bordered cards with centred text is a template, not a decision. In a bare layout prefer open items
  with a top rule, or let the skin's card look (`components.card`, `item`) box them.
- Pictures never cross words. A picture behind words is named `backdrop` so it gets soft art (`pictureFor` in
  `core/sectionDefaults.ts`); one beside words never overlaps them at any width.

## Never shift block ids

Block ids are positional (`b0`, `b1`… in document order), and people's edits are saved against them. In an existing
layout never add, remove or reorder `data-mx-block` elements. Classes, CSS, icon names and static text are free.

## Before it ships

1. `npx vite-node scripts/lint-clips.ts <type>` is clean.
2. Render it under three skins that pull apart, and under the bare layout source with the dials at their ends:
   `npx vite-node scripts/render-clips.ts <clip id> --skins calm,bold,nightowl` and
   `npx vite-node scripts/render-clips.ts <clip id> --variants base,min,max,dark`. Look at every shot at 1440 and 390:
   nothing overflows, spills past the gutter or cuts text off (the script flags these), and it still reads as the
   layout it is.
3. `npm test`: lint, `lintBones`, skins at AA, and the layout matches itself first (`tests/match.test.ts`).
