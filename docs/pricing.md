# Blokmix Pricing

No subscription. Free to start; mix packs are bought once and kept (ReviseMy-style packs, sold through Polar in
Blokmix's own organization).

## Free

- 1 mix open at a time, 40 clips, 100 MB of images and video, 1 collection of 25 entries
- The core layouts: three per section type (`"tier": "free"` in clip.json), plus every clip you capture yourself
- The guided start, the Crate, the site library (sections land as the closest open layout), marks, versions, export
  and handing off to your agent
- The Feel dials, Light/Dark, your brand colors and fonts, section surfaces and widths
- Starter mixes made only of open layouts (the others show a lock)

## Mix pack — $20 once

- Three mixes open at a time, for good. Packs stack: two packs, six mixes.
- Every layout, every style guide knob and source pick, block looks and saved style guides
- Effects, section backdrops, generative pictures, UI mockups and live shaders
- Unlimited clips and collections, 10 GB of images and video

## How it works

- **Slots, not credits.** A pack's mixes are places, not uses: archive a mix and its place is free again. An archived
  mix stays in your gallery, read-only (marks aside) and exportable, and comes back when you have room.
- **It follows the owner.** What a mix opens depends on its owner's packs, and only the owner's mixes count. Editors and
  viewers never need a pack.
- **Nothing is taken away.** Work over a limit (after a refund, or a mix that already uses a locked layout) is kept and
  still exports; only adding more is refused. Free users can preview effects and backdrops; using them opens the
  buy sheet.
- Agents hear the same rules: a command that needs a pack refuses with why.

## Principles

- Pricing matches the product: niche, useful, and simple.
- No seat math, no recurring billing, no “am I using it enough?”
- Free is complete enough for one real starting point; a pack opens breadth and finer control.

## Setup (Polar)

`config/billing.php`. In Blokmix's Polar organization (sandbox and production): a one-time product "Mix pack" at $20,
a webhook to `/api/polar/webhook` with `order.paid` and `order.refunded`, and an organization access token. Then set
`POLAR_SERVER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_MIX_PACK` and, when ready,
`BLOKMIX_PRICING_ENABLED=true`. Until then the buy buttons say packs are coming soon.

## Domain split

- blokmix.com — the product and marketing
- blok.page — published, noindex, account-linked snapshots of mixes + style guide

Last updated: 2026-10-30
