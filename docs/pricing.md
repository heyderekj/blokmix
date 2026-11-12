# Blokmix Pricing

Free to make. $30 a site when you ship it.

A site is one mix. Everything in the app is free for everyone: every layout and theme, every style control, effects,
backdrops and the other treatments, as many mixes as you like. You pay once, per mix, when you ship it. No
subscription. Sold through Polar in Blokmix's own organization.

## How it works

- **Shipping is what's paid for.** Downloading the export (blokmix.json, BLOKMIX.md, tokens, the Astro or Next.js
  project), copying the style guide for your agent, and handing a version to an agent to build (Build, and
  `prepare_build` over MCP). An unpaid mix asks for $30 at that moment, in the buy sheet.
- **Once paid, it stays shipped.** Every version, draft, branch and re-export of a paid mix is free from then on.
- **Anyone who can edit may pay.** The owner or an editor; viewers hear it's an editor's call. The payment belongs to
  the mix, not the person.
- **A copy is a new site.** Duplicating a mix makes an unpaid one; the gallery's Duplicate says so.
- **Free, whatever you pay:** publishing to blok.page for feedback (with a small "Made with Blokmix" badge until the site
  is paid for; publish again after paying to drop it), share links, marks, versions, collections, the Crate and
  capture. The mix file (Download a copy) is a backup, not an export, and stays free.
- **Nothing is taken away.** A full refund un-pays the mix: the mix, its versions and anything already downloaded stay;
  only shipping again asks to pay.
- **Plus from before still counts.** Anyone who has Plus (the old $25 one-time unlock, `users.plan = plus`, bought or
  given by hand), and the people who run Blokmix (BLOKMIX_OWNERS), ship every mix they own without paying.
- **The waitlist has no paywall.** While `BLOKMIX_WAITLIST_MODE` is on, every mix ships free.
- **Storage is a guardrail, not a feature.** 100 MB of images, video and published pages per owner; 10 GB once they've
  paid for a site (or have Plus). It's never printed as a selling point.
- Agents hear the same rules: `prepare_build` on an unpaid mix refuses with why and how to pay.

## Principles

- Pricing matches the product: niche, useful, and simple. One price, per site, once.
- Pay when it's worth something: making and trying is free, shipping is the moment the site has value.
- No seat math, no recurring billing, no "am I using it enough?"

## Later: hosting

blok.page is a preview and share link (noindex), not hosting, and stays free. A subscription only comes if Blokmix ever
hosts your site on your own domain: then that hosting, per site, is the one thing billed monthly. Making stays free and
shipping stays pay once.

## Setup (Polar)

`config/billing.php`. In Blokmix's Polar organization (sandbox first, then production):

1. Create a one-time product "Site" at $30 (one price, no recurring interval). Its description can be the line above.
2. Keep the webhook to `/api/polar/webhook` with `order.paid` and `order.refunded`, and the organization access token.
3. Set `POLAR_PRODUCT_SITE` to the new product's id, plus `POLAR_SERVER`, `POLAR_ACCESS_TOKEN` and
   `POLAR_WEBHOOK_SECRET`. Keep `POLAR_PRODUCT_PLUS` set to the old Plus product's id (archive it in Polar so it can't be
   bought) only so refunds of Plus orders are still recognized.
4. When ready, `BLOKMIX_PRICING_ENABLED=true` and `BLOKMIX_WAITLIST_MODE=false` (until then every mix ships free, and the
   buy sheet says paying opens at launch).

The checkout (`POST /api/mixes/{mix}/checkout`) carries `user_id`, `mix_id` and `product: site` in its metadata and comes
back to the mix with `?paid=1`. `order.paid` marks that mix paid (`mixes.paid_at`, `paid_order_id`) once per order
(`billing_orders`, one row per Polar order, with `mix_id`); a full `order.refunded` un-pays it unless another order for
the same mix still holds it.

## Domain split

- blokmix.com — the product and marketing
- blok.page — published, noindex, account-linked snapshots of mixes + style guide

Last updated: 2026-11-12
