# Blokmix — Simple Vision

A niche, useful, and simple tool for starting a website from real sections instead of a blank prompt or AI defaults.

## Core idea

Blokmix is a place to begin with real web material. You clip or pick sections you like (or start from a light wireframe), apply and dial a style guide so they transform into coherent previews, mark notes for an agent, and optionally publish the current mix as a noindex snapshot. That is the loop. No forced journey, no full site builder, no production hosting.

It stays incomplete on purpose. The value is a grounded starting point and clear notes you can hand to whatever AI tool or stack you already use.

## Who it is for

People who are not designers (founders, marketers, developers who do not design) and who want to explore better design than the current wave of AI-slop defaults. They need a place to start from real sections that already work, then tune them under a coherent style.

Secondary: designers who want a fast remix surface, but the primary promise is the non-designer starting point.

## The loop

1. **Start** — Clip real sections, pick from the library (sections or a starter mix, see `library.md`), or let the
   guided start suggest one. Built-in layouts begin as wireframes: grey and plain, for deciding the layout first.
   No required sequence.
2. **Style** — A style guide (from the clips, from an existing site/brand, or dialed) transforms the sections into live previews. Simple dials for tuning by feel (spacing, type, color, radius, light/dark).
3. **Mark & hand off** — Notes and marks live on the sections ("keep this layout", "try tighter"). Export a packet (styled components + notes + tokens) for your agent, or publish the mix.

Optional: publish the current mix to a noindex/nofollow page on blok.page so you can share the styled sections and style guide without it becoming a public site.

## What it is not

- Not a full website builder or host (not Squarespace, not Relume Publish).
- Not a forced multi-step process.
- Not a team inbox or project board (that is Koati).
- Not the place the final site lives.
- No AI of its own; your agent builds from the notes and export.

## Domains

- **blokmix.com** — marketing site and the app.
- **blok.page** — published, noindex snapshots of a mix + style guide (lightweight shareable view only).

## Guided start

New mix asks what you're making (a product, a studio, a local business, an event, a portfolio, a newsletter). It then
shows three raw starts side by side, A/B/C, to pick a structure: matching starter mixes first, then mixes put together
from the library. That page then goes under the skins, side by side, with one brand color if you have one. Each start is measured before you see it, in plain words: does the headline and button show on a
laptop and a phone without scrolling, does anything spill sideways at any width. The other two starts stay as versions to come back to.

The measuring borrows from Shu Ding's "The Calculus of Interfaces" (a page is a function of a few inputs, so you can
ask what fills the first screen and what moves it). We don't compile pages into math; we render the real sections
in hidden frames at several widths and read what we see.

## Pricing direction

See `pricing.md`: a free tier that completes one real starting point, and a $29 one-time license for the full
library and unlimited mixes. No subscription. Editors and viewers free. No seat math.

## Relationship to the rest of the suite

Blokmix can exist as a small, separate product because the job is different from Koati (personal exploration and handoff vs. team intake and deciding what to work on). The generation/style engine can be shared later if useful. Primary focus for revenue remains Koati; Blokmix stays ruthlessly small.

## Notes from conversation

- Clipping real sections is the fun part ("everything is a remix").
- Style guide is the active transformer; Dialkit-style dials make exploration fast.
- Marks become notes the agent keeps.
- Flexible entry (clips or wireframes) avoids Relume-style forced flows.
- Friend feedback (software dev who is not strong at websites): useful handoff to existing AI tools/stacks, stands apart from Figma-like apps, do not become Squarespace.
- Published pages are snapshots for sharing, not production sites.

Last updated: 2026-10-29
