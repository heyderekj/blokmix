# Layout coverage

Which shapes real sites use, per section type, and the built-in layout (`samples/clips/<type>/layout-<variant>/`)
that covers each. The matcher (`core/match.ts`) lands a captured section on the closest one; a shape with no layout
here is what the draft queue fills (`status: "draft"`, `inspiredBy`). Keep this file in step when layouts are added.

Archetypes: centered · split (media left/right) · media below · 2/3/4-up grid · bento · list · tabs ·
carousel/slider · gallery (grid, masonry, filmstrip) · off-grid/overlap · sticky media · full-bleed media ·
video · inverse band · timeline · comparison.

| Type | Archetype → layout | Gaps |
|---|---|---|
| nav | simple bar → `simple`, centered logo → `centered`, pill → `pill`, stacked → `stacked`, cells → `cells`, notice above → `notice`, menu button → `menu`, tool links → `tools`, mega menu (`<details>`) → `mega` | transparent over hero (handled by the hero's backdrop) |
| hero | centered → `centered`, split → `split`/`portrait`, media below → `media-below`/`product`, full-bleed → `backdrop`, video background → `video-backdrop`, inline video → `video-inline`, off-grid → `overlap`/`collage`, bento → `bento`, slider → `slider`, form → `form`, editorial type → `editorial`, with logos → `logos` | oversized headline bleeding past the column |
| header | centered → `centered`, split → `split`, media → `media`/`backdrop`, video → `video`, band → `band`, flanked → `flank`, ruled → `rule`, minimal → `minimal` | — |
| logos | row → `row`/`inline`, grid/wall → `grid`/`wall`, cards → `cards`, band → `band`, marquee/slider → `marquee`/`slider`, roster → `roster` | — |
| features | 2/3/4-up → `two-up`/`grid`/`four-up`, list → `list`/`checklist`, alternating split → `alternating`, bento/mosaic → `bento`/`mosaic`, tabs → `tabs`/`tabs-top`, carousel → `carousel`, sticky media → `sticky`/`story`, off-grid → `staggered`, comparison → `compare` | — |
| gallery | grid → `grid`, masonry → `masonry`, filmstrip → `filmstrip`, spotlight → `spotlight`, mosaic → `mosaic`, rows → `rows` | radio slider with dots |
| content | prose → `prose`, columns → `columns`, aside → `aside`, image/media → `image`/`media`, quote → `quote`, steps → `steps`, timeline → `timeline`, sticky → `sticky`, overlap → `overlap`, video → `video` | — |
| stats | row → `row`, big → `big`, cards → `cards`, band → `band`, bars → `bars`, split → `split`, highlight → `highlight`, over media → `media`/`over-media` | — |
| testimonials | big quote → `big`/`quote`, cards/wall → `cards`/`wall`, row → `row`, split → `split`, with logos/stats → `logos`/`stats`, slider → `slider`, video → `video` | — |
| team | grid/4-up → `grid`/`four-up`, circles → `circles`, list → `list`, split → `split`, founder → `founder`, group photo → `group`, bento → `bento`, carousel → `carousel` | — |
| pricing | tiers → `tiers`, columns → `columns`, two → `two`, single → `single`, table → `table`, rows → `rows`, packages → `packages`, band → `band`, monthly/yearly → `toggle` | — |
| faq | accordion → `accordion`, two columns → `columns`/`double`, sidebar → `sidebar`, cards → `cards`, rows → `rows`, band → `band`, compact → `compact` | — |
| blog | cards → `cards`, featured → `featured`, 4-up → `four-up`, list → `list`, magazine → `magazine`, masonry → `masonry`, overlay → `overlay`, scrolling row → `row`, minimal → `minimal` | — |
| cta | centered → `centered`, band → `band`, banner → `banner`, big → `big`, card → `card`, split → `split`, media → `media`, newsletter → `newsletter`, video → `video`, sticker → `sticker` | — |
| contact | form → `form`, split → `split`, sidebar → `sidebar`, cards → `cards`, map → `map`, details → `details`, band → `band`, minimal → `minimal` | — |
| footer | columns → `columns`, centered → `centered`, minimal → `minimal`, inverse → `inverse`, newsletter → `newsletter`, CTA → `cta`, index → `index`, big wordmark → `wordmark` | — |

## Conventions the new families use

- **Video** stays inside an image block: `data-mx-block="image" data-mx-media-kind="video"`, with CSS poster art.
  The Image menu opens on Upload for these; the media runtime plays whatever video, Lottie or embed is set.
- **Sliders** are CSS only: scroll-snap rows with a peek of the next slide, or radio inputs + `:has()` with dots.
- **Galleries** are the `gallery` type: an `images` list of items `g1…`, each an image block plus `g#Caption`.
- **Off-grid** uses `.grid` with `.start-N` offsets and negative margins on the media, never absolute pixel layouts.

## Measuring coverage

`npx vite-node scripts/library/match.ts` prints the match rate of captured library sites per site and per type and
lists sections below `MATCH_THRESHOLD`: those are the next layouts to draft.
