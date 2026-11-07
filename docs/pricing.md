# Blokmix Pricing

Free, and Plus: $25 once. No subscription. Sold through Polar in Blokmix's own organization.

| | Free | Plus, $25 once |
|---|---|---|
| Mixes | 1 open at a time (archive it to start another) | As many as you like |
| Layouts and themes | The core layouts (`"tier": "free"` in clip.json) and the free themes (Wireframe, Studio, Lo-fi, Flyer), plus every clip you capture | Every layout and theme, Mashup |
| Style | The Feel dials, Light/Dark, your brand colors and fonts | Every style guide control, source picks, block looks, saved style guides |
| Treatments | Preview only | Effects, backdrops, generative pictures, UI mockups, live shaders |
| Room | 100 MB of images and video | 10 GB |

Both have everything else: the guided start, the Crate and your clips, the site library (on Free, sections land as the
closest open layout), drafts, versions, notes, collections, export, handing off to your agent, and publishing to
blok.page (with a small "Made with Blokmix" badge on Free).

## How it works

- **Three limits on Free, nothing else to count.** One mix, the core set, the Feel dials. Storage is a guardrail, not a
  feature.
- **It follows the owner.** What a mix opens depends on its owner's plan, and only the owner's mixes count. Editors and
  viewers never need Plus.
- **Nothing is taken away.** Work over a limit (after a refund, or a mix that already uses a locked layout) is kept and
  still exports; only adding more is refused. An archived mix stays in your gallery, read-only (marks aside) and
  exportable. Free users can preview effects and backdrops; using them opens the buy sheet.
- Agents hear the same rules: a command that needs Plus refuses with why.

## Principles

- Pricing matches the product: niche, useful, and simple. Two plans, one price.
- No seat math, no recurring billing, no "am I using it enough?"
- Free is complete enough for one real site; Plus opens breadth, finer control and as many sites as you make.

## Later: hosting

blok.page is a preview and share link (noindex), not hosting, and stays free on both plans. A subscription only comes
if Blokmix ever hosts your site on your own domain: then that hosting, per site, is the one thing billed monthly. Making,
mixing and exporting stay pay once.

## Setup (Polar)

`config/billing.php`. In Blokmix's Polar organization (sandbox and production): a one-time product "Plus" at $25, a
webhook to `/api/polar/webhook` with `order.paid` and `order.refunded`, and an organization access token. Then set
`POLAR_SERVER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_PLUS` and, when ready,
`BLOKMIX_PRICING_ENABLED=true` (and `BLOKMIX_WAITLIST_MODE=false`, which until then puts everyone on Plus). Until then
the buy buttons say Plus opens at launch. `order.paid` sets `users.plan = plus` once per order; a full refund sets it
back to free unless another order still holds it.

## Domain split

- blokmix.com — the product and marketing
- blok.page — published, noindex, account-linked snapshots of mixes + style guide

Last updated: 2026-11-06
