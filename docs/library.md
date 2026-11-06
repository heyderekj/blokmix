# Library of Clips — Landbook-Inspired

Blokmix starts from real web material instead of blank prompts or AI defaults. A curated library of sections (and mixes) is one of the main ways people enter that loop, especially non-designers who need a place to begin.

This is inspired by how Landbook organizes real site sections and examples by visual style, type, color, and other attributes—making it easy to browse considered work rather than generic templates.

## Purpose

- Give people who are not designers immediate, non-slop starting points.
- Let anyone begin with real sections that already work, then dial a style guide so they transform under a coherent look.
- Complement (not replace) personal clipping. You can still clip from any site; the library is the ready-made entry when you don’t have references yet or want variety fast.
- Support "take what works, make it yours": the unit is real sections (or short mixes of them), not locked themes.

## What lives in the library

- **Sections** — Individual blocks (heroes, feature grids, pricing, footers, etc.) captured or curated from real sites, cleaned so they can be restyled. Organized by attributes similar to Landbook: visual style, layout type, color tendency, density, industry-agnostic patterns, etc.
- **Starter mixes** — Short, ready combinations of sections under a sample style guide. These act as the modern replacement for templates: open one, dial the style, mark notes, and you have a considered starting point.
- Optional later: user-shared mixes that others can duplicate as starting points (light gallery, not a full marketplace).

## How it fits the loop

1. **Start** — Pick from the library (sections or a starter mix) or clip your own. No forced order.
2. **Style** — Apply or dial a style guide; the chosen sections transform live.
3. **Mark & hand off** — Add notes, export for your agent, or publish the mix to your account-specific blok.page.

The library is an entry point, not the product. The value remains the transformation under a style you control and the notes you leave.

## Free vs paid

- **Free**: three layouts per section type (`"tier": "free"`), your own clips, the starters made of those, the Feel dials, marks and export.
- **Mix pack, $20 once**: three mixes open at a time (packs stack), every layout, every control, effects and shaders. See `docs/pricing.md`.

This keeps the free tier useful for completing one starting point while the license unlocks breadth.

## Curation and growth

- Begin curated and small. Quality and variety matter more than volume. Focus on sections that mix cleanly and look intentional under different style guides.
- Organize for browsing the way Landbook does—by style, type, and other visual traits—so non-designers can find something that feels right without design vocabulary.
- Later, optionally allow people to share a mix into a gallery so others can start from it. Keep this light (preview + duplicate) to avoid marketplace overhead.
- Personal clips remain first-class. The library never blocks or replaces clipping from the live web.

## What it is not

- Not a traditional template marketplace with locked themes or heavy creator tools.
- Not a replacement for clipping.
- Not tied to production hosting. Library items become part of your mix; publishing is still the noindex, account-specific snapshot on blok.page.
- Not an AI-generated default library. The point is real, varied sections that already exist in the wild.

## What's built

- **Two shelves.** *Plain* is Blokmix's own built-in layouts (neutral structure that takes any style guide). *Real
  sites* is sections captured from live sites. A clip's shelf follows where it came from; it isn't stored.
- **Tags** in each `clip.json`: `feel` (one or more of calm, friendly, editorial, technical, bold) and `density`
  (airy, balanced, dense). Layout type is the clip's `rhythm` (centered, split, grid, stack, band); tone (light,
  dark, vivid) is read from the clip's own colors. The Crate's Library tab filters by all of these in plain words.
- **Starter mixes** live in `samples/starters/*.json`: a name, what it's for, a feel, and its pages' sections.
  The guided start offers the ones that match first.
- A layout's `tier` is `free` (on Free) or left out (in a mix pack). `core/library.ts` `layoutOpen`/`pickable` enforce it
  when `library.paid === false`; every type keeps at least three free layouts (`tests/plan.test.ts`).

## Open questions

- Exact size and makeup of the free limited selection.
- Whether early library content includes a small set of high-quality community mixes from the start. For now it is
  curated by us.
- How (or whether) to keep any Landbook-style organization in sync with external inspiration sources over time.
- Real-site sections join the shared library only once capture cleans them fully (`capture-issues.md`): every piece
  of copy in fields, no source names or logos left in, quiet placeholders. Nothing in the library carries another
  brand.

Last updated: 2026-10-29
