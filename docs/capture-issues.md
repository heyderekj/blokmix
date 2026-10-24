# Capture: what still translates badly

A running list from real captures (diabrowser.com, shotbase.com, graphicalui.com, captured 2026-10-24 and
mixed into the blokmix.com home page). Each item is a general rule to fix in `extension/src/capture/`, never a
per-site patch. Re-run with `extension/scripts/recapture.ts` and check `.out/inspo/compare/`.

## Copy that doesn't become fields
- **Repeating steps keep their source words.** Dia's steps only fielded the first two titles; the other titles
  and every step body ("Before the day kicks in, Dia’s Morning Brief…") stayed as static text, so your copy
  never reaches them. Every repeated unit's copy must be numbered fields (`f3Title`, `f1Body`…).
- **Hero sub copy and actions are missing.** Dia's hero kept only `headline`: no subhead or call to action, so
  the section can't carry the pitch.
- **Source names survive in static text.** "Record once, Shotbase follows the action", "Buy for $89",
  eyebrow tags from the source. Rule 8 says static text never names the source brand: anything with the site’s
  name, a price or a sentence should be a field, and the rest dropped.

## Source art that should be a slot or dropped
- **Wordmarks and logos stay drawn.** The DIA wordmark behind A’s hero and the Graphical logo pill in C’s hero
  are the source’s brand, kept as SVG. A big logo in a hero should become an image slot (`logo`) or be dropped.
- **Logo marquees keep the source’s customers** (Automattic, Clerk, Spotify…). Logos should become `logo1…`
  image slots with placeholder marks.
- **Product UI mock-ups keep their insides.** Graphical’s agent window carries its chat, list and avatars as
  live markup with Graphical’s words; it overflows and overlaps when restyled. A dense UI illustration should
  become one image slot the size of the window.

## Layout
- **Placeholders dominate.** Big pale-pink boxes stand in for every screenshot; on a page of them nothing reads.
  Placeholders should be quieter (surface tone, smaller glyph) and the art should carry the section’s accent.
- **Text overlaps in rows.** Shotbase’s capture rows render a garbled line where a caption and a profile
  card overlap; Graphical’s window text runs into its heading area.
- **A light nav on a light page disappears.** Shotbase’s dark pill nav came out with white links on a near-white
  pill in B; colors that only worked over the source’s photo need a contrast check against the new background.
- **Extra list items appear.** C’s feature grid shows a stray seventh card ("Nothing a team tool makes you set
  up first") built from leftover copy.

## Where this shows
The three blokmix.com versions in the live mix (A · Studio, B · Tour, C · Quiet tool). The site build replaces
the leftovers by hand; the capture fixes above are what make the next mix not need that.
