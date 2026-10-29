# Roadmap

Ideas we mean to build, not yet started. Each one names what changes for the person using Blokmix and where
the work would land.

## Capture straight to your account

The extension sends a clip to the live app in one click, instead of downloading a zip you then add in the
Crate. The panel would sign in to Blokmix (or reuse the signed-in session) and post to `/api/clips`, the same
endpoint the Crate uses today (`ClipController`, linted in the browser, saved per account).

## Agents without the local bridge

A hosted MCP server, so agents can work on the live site from anywhere, not just on the machine running
`npm run mcp`. It would relay the same commands (`core/commands/schema/`) to the open board, so agents keep one
set of tools whether they connect locally or to the hosted app.

## Live editing together

Laravel Reverb, so two editors see each other’s changes as they happen, instead of the second save being
refused (today a stale `If-Match` lock gets a 412 and the mix as it is now).

## Start from your existing site

Paste the address of a site you already have, and a new mix starts from it: its pages and sections as clips, and
its tokens (colors, fonts, type scale, radius, spacing, motion) as the mix's style guide. You then remix from what
you have instead of a blank page or a neutral guide. It would reuse the extension's capture (`extension/src/capture/`
turns live sections into clips; `core/` already reads a source's tokens) to clip each section of each page, add the
clips to the mix's own set (`addMixClips`), and fill the guide with `replaceGuide`. It joins New mix's "Start from"
list beside Neutral, a saved guide and another mix's guide. Importing a design-token file (Tailwind config, CSS
variables, Figma or W3C tokens JSON) is the smaller first step: the style guide alone, no sections.

## Feel dials

A handful of dials in plain words (roomier ↔ tighter, softer ↔ sharper corners, bigger ↔ smaller type, light ↔ dark,
one brand color → a whole palette) over the token controls that exist today. Each dial says what it does to your
first screen, from the same measuring the guided start uses ("Tighter puts your button above the fold on a phone").

## Publish to blok.page

A noindex, nofollow snapshot of a mix and its style guide at an account address on blok.page. Rendered in the
browser with `referenceHtml` (it already inlines media), uploaded, and served with `X-Robots-Tag: noindex, nofollow`.

## One-step hand-off

Today it's Export → pick a framework → download → unzip → open in your tool → paste the prompt. Collapse that into
"Copy prompt for Cursor / Claude Code" (pointing at a hosted packet URL) and a variant that inlines the essentials for
tools that can't open a folder (v0, Lovable).

## License checkout

The $29 one-time license (`pricing.md`): checkout, a license on the account, and the library's `tier` enforced
(Free sees the free selection; the license unlocks the rest). Replaces today's "Plus, coming soon" wording.
