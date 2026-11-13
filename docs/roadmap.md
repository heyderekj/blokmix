# Roadmap

Ideas we mean to build, not yet started. Each one names what changes for the person using Blokmix and where
the work would land.

## Capture what you like

Today the extension clips a whole section and the app decides later what to keep (`slot.keep`, Add as candidate).
Instead, the panel (`extension/src/panel/main.ts`) asks "What do you like here?" (Layout · Words · Look · A piece ·
The whole site's look, plus an optional note), written to clip.json as `liked` and `note`. The picker
(`extension/src/picker.ts`) gets a piece mode for any element (a button, a card, a heading); today it snaps to boxes
at least 60% of the window wide. Each answer lands as an option in the mix, never applied on its own:

| You liked | It lands as |
|---|---|
| Layout | Joins this mix's clips, so it's in the section's arrows (`cycleIds`) |
| Words | Kept word options on this mix's sections of that type (`slot.options`, `by: 'clip'`) |
| Look | Token candidates (`promote` / `promoteSource`) and effect candidates |
| A piece | A block look, marked "From <site>" first in the Looks strip (data looks, below) |
| The whole site's look | A skin built from it (`skinFromSite`: the site's tokens, fonts and effects over `closestSkin`'s block looks and section defaults), saved to your account under "Yours" in the Skin tile |

Gaps it closes: captured `effects` are dropped when a clip loads (the `Clip` type has no field for them);
`capture/siteTokens.ts` is only used by the owners' library tool; nothing makes a skin; block looks are fixed code
(`VARIANTS` in `core/blocks/variants.ts`).

## Bring it back

What your agent builds (or changes later) comes back as more options, never as changes to your picks. Every item is
marked where it came from ("From Claude"), can be dismissed, and taking it is one undo step.
- Data: account skins (a `skins` table, or `style_guides` with a kind, checked by `parseSkin`); data block looks
  (`guide.looks[kind]`, the `{id, label, hint, css}` shape of `VARIANTS`, linted tokens-only like clip CSS).
- Commands: `add_token_candidates` (wraps `promoteSource` with `src:agent:<name>`), `add_block_look`, `save_skin`,
  `add_clip` (lint plus `POST /api/clips`, joins the mix); `word_options` already keeps words. Only shipping is paid
  (`state/shipping.ts`). BLOKMIX.md (`core/export/packet.ts`) gets a short "When you're done, bring it back" next to
  `report_build`.
- Without MCP: "Bring back changes" in the board menu reads a built project's `tokens.css` and content files
  (`src/content/*.json`, Next `content/`), compares them with the packet (`data-mx-src` paths), and offers what
  changed as token candidates and word options. blokmix.com is the first test: it has drifted from its packet
  (`Puzzle.astro`, `HeroShot.astro`).
- UI: one "What came back" list with Use / Dismiss, and a "New" chip where each addition lives.

Today nothing reads a build back: `lib/mixFile.ts` imports only Blokmix's own file, and agents report progress only
(`report_build`, `import_review_marks`). Skins, block looks and palettes are a fixed set agents can choose from but
not add to; saved style guides have no agent command.

## Theming

Themes that fit the site you're making, and ways to steer them. Today there are seven themes, offered by counting
feel words, so a bakery gets Lo-fi, Dream Pop and Flyer; industry barely reaches them and Jev only reads their names.
The plan: a kit of parts (the eight style areas Rules for your agent already uses), about sixteen themes with industry
flavors, "Change one part", and Jev to rank themes for your brief, change the look from words, and check how it reads.
Phased PRs: fixes and the kit, then industry themes, then Jev. The full plan, with what's wrong today, is in
`docs/theming.md`.

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
its tokens (colors, fonts, type scale, radius, spacing, motion) as the mix's style guide. You then mix from what
you have instead of a blank page or a neutral guide. It would reuse the extension's capture (`extension/src/capture/`
turns live sections into clips; `core/` already reads a source's tokens) to clip each section of each page, add the
clips to the mix's own set (`addMixClips`), and fill the guide with `replaceGuide`. It joins New mix's "Start from"
list beside Neutral, a saved guide and another mix's guide. Importing a design-token file (Tailwind config, CSS
variables, Figma or W3C tokens JSON) is the smaller first step: the style guide alone, no sections.

## One-step hand-off

Today it's Export → pick a framework → download → unzip → open in your tool → paste the prompt. Collapse that into
"Copy prompt for Cursor / Claude Code" (pointing at a hosted packet URL) and a variant that inlines the essentials for
tools that can't open a folder (v0, Lovable).

## Shipped

Feel dials (`core/dials.ts`), publishing to blok.page, and paying once at Polar (now $30 a site when you ship it, in
`pricing.md`) were on this list and are built; see CLAUDE.md.
