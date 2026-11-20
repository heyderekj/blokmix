# Theme standards

The bar every built-in theme (`samples/skins/*.json`) is checked against, and the brief for new ones. A theme is the
whole look over bare layouts: it should look like a good designer made it for one kind of site, and be clearly its own
next to every other theme. `tests/theme-distinct.test.ts` checks the parts that are numbers; the rest is read off the
renders (`npx vite-node scripts/render-skins.ts --flavors --widths 1440,390`).

## Every theme

- **Type.** Its own `h1`–`h4`, `bodyLarge`, `small` and `caption` text styles (weight, tracking, leading, case) and its
  label style, never `display` (layouts size the headline to the window). Ratio 1.2, 1.25 or 1.333, never above. A
  1.333 scale sets phone steps on `h1`–`h3` so a phone heading stays two or three lines. Weights only from what the
  font loads (`core/fonts.ts`).
- **One main action.** A main button look and a quieter one that differs from it (`components.button`).
- **Contrast.** AA for text, muted text and the button label on the page and on every band the theme uses.
- **Its own neutrals, card shadow and label.** No two themes share all three. Every pair is at least 20 apart by
  `lookDistance`.
- **Pictures and icons.** One picture style no other theme uses, one icon set no other theme uses.
- **Motion.** Ease-out only, 300ms or less (Craft). Entrances differ by section type: the hero, lists (features,
  pricing, team, blog), quotes, stats and the closing call each get their own; FAQs never move. No easing, ratio or
  set of heading styles on more than half the catalog.

## Kinds of site

| Kind | Type | Density | Contrast | Main button | Pictures | Motion |
|---|---|---|---|---|---|---|
| Product / SaaS | Grotesk display, tight negative tracking, 1.2–1.25 | Balanced to dense; wide content | Crisp neutrals, one bright or deep accent | Solid or inverse, small radius | Product UI, mocks, data | Quick rise and stagger; stats pop |
| Editorial | Serif display, light or regular weight, 1.333; serif or quiet sans body | Airy; narrow reading column | Paper and ink, warm | Solid with arrow or text link beside | Print, reading, photographs | Slow fades; quotes blur in |
| Restaurant and local | Warm serif or friendly display, 1.25–1.333, big body (17–18px) | Balanced | Warm paper, one appetite color | Solid, rounded or pill | Food, counters, places | Gentle rise; little pop |
| Studio and agency | Elegant serif or tight grotesk, caps labels, 1.333 | Airy; wide gallery width | High, restrained palette | Square caps or inverse | Architecture, work, full-bleed | Slow blur on the hero, fades |
| Shop | Chunky display, 1.2–1.25 | Balanced | Bold primary on light | Solid, offset or pill | Products, sketches with prices | Pop on cards |
| Event | Condensed or poster display, often caps, 1.2–1.25 | Dense; schedule cards | Loud: bright band, dark ink | Caps or offset | Tickets, posters, halftone | Quick drop and slide |
| Personal | Friendly sans or serif, 1.25 | Airy | Soft | Pill or soft | Portraits, shapes | Slow, light |

## The catalog against it

| Theme | Kind | Notes |
|---|---|---|
| Studio | Product / SaaS, agency | Neutral grotesk, solid button, raised cards, dot labels |
| Mastered | Product / SaaS (finance) | 1.2 scale, compact bold headings, navy neutrals, inset fields |
| Afterhours | Product / SaaS (dev tools), dark | Tightest tracking, inverse button, mono links |
| Deep Cut | Product / SaaS (AI), dark | Green-black neutrals, glow cards, mono small text, slide-in lists |
| Gatefold | Studio and agency (architecture) | 1.333 serif, square caps button, rule cards, no shadow |
| Vinyl | Studio and agency, dark | Light serif, flat cards, thin icons, slow blur |
| Liner Notes | Editorial | Oxblood ink, solid button + arrow, a print picture |
| Field Recording | Editorial (travel, nonprofit) | Olive paper, light serif headings, serif lead, dotted links |
| Press Kit | Editorial (media), event, dark | Poster caps headings over serif body, grain |
| Counter Service | Restaurant and local | Tomato red, 18px body, raised cards, bakery picture |
| Lofi | Restaurant and local (café), personal | Pill everything, grain cards, popping lists |
| Acoustic | Restaurant and local (health, services) | Sage paper, pill + outline, slow blur |
| Mixtape | Shop | Cream with hard ink shadows, solid labels, op-art pictures |
| Dreampop | Shop, personal | Glass cards, filled icons, mesh pictures |
| Homeroom | Personal (education) | 1.2 scale, soft blue shadow, raised cards |
| Day Planner | Event (programs, education) | Condensed caps headings, caps button, grid pictures |
| Flyer | Event, agency | Black rules, offset main button, caps everything |
| Supper Club | Restaurant and local (sit-down dining, hotels), dark | Bodoni over Karla on candlelit brown, brass pill button, caps dish names, the menu on a soft band, table photos |
| Songbook | Editorial (blog) | White paper, Zodiak over a 19px Source Serif body, a 720px measure, mono labels and captions, solid blue button |
| Headliner | Studio and agency (bold) | Cabinet Grotesk 800 at -0.05em, black inverse button, one signal orange band, square labels, heavier lines |
| Solo | Personal | Bespoke Serif over Onest, plum on soft lilac paper, narrow 980px page, pill button, highlight links, portraits |

## Gaps (next themes)

Glass and glow, brutalist and oversized type are experiments.
