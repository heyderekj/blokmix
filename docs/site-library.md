# Site library and layout engine

A Landbook-style library of real websites to browse and clip from. Each site's pages are split into sections and every
section is matched to one of Blokmix's built-in layouts. Clipping lands that layout, so what you get is always a clean,
re-themeable section; the site's look can join your style guide as a candidate, and the screenshot stays a reference
linked to the live site. No site's words or images are reused.

Layouts are the source of truth. When a section matches none of them, Blokmix drafts a new layout, a person reviews it,
and it joins the library. Running the pipeline over more sites is how the engine learns: each run shows which shapes
the layouts don't cover yet.

## Decisions

- **Curated:** the people who run Blokmix pick and publish the sites (`samples/library/seed.json`, the top five per
  industry from Land-book, with Godly and Awwwards as backups). Users browse; they don't submit.
- **Clipped as the matched layout**, with the site's tokens offered as a style candidate.
- **Draft, then review** for sections nothing matches.
- **Screenshots only**: sections take your copy and placeholder art.

## The loop

1. **Capture** (`scripts/library/capture-site.ts`): headless Chrome at 1440, robots.txt respected, cookie banners
   rejected, lazy content settled. Page and section screenshots (WebP), a 390 pass and a thumbnail.
2. **Split** (`findSections`): descends through wrappers to the page's sections, treats fixed and sticky bars as the
   nav, records each section's box on the page.
3. **Type** (`guessSectionType`): nav, hero, header, gallery and the rest, with a confidence; under 0.5 is flagged.
4. **Snapshot and capture**: each section goes through the extension's `captureClip` (structure normalized onto the
   layout primitives). The capture is kept for matching and drafting only.
5. **Site tokens** (`siteTokens`): one style guide for the whole site, from every section weighted by area, the page's
   own colors, buttons, `:root` variables and fonts.
6. **Match** (`core/match.ts`): the capture and every layout of its type get the same structural signature; the
   closest layout wins at or above `MATCH_THRESHOLD`.
7. **Draft** (`scripts/library/draft-layouts.ts`): a brief per unmatched section; an agent authors the layout
   (`status: "draft"`, `inspiredBy`), it passes the layout gates and review removes the status.
8. **Publish**: `scripts/library/upload.ts` posts the bundle; owners curate at `/library/admin` (override a match, hide
   a section, set industry and tags, publish).

## First run (October 2026)

Three contrasting sites: linear.app, aesop.com, pentagram.com, home pages only. After tuning the matcher (pictures on
one side only now cost a section the match; overlapping layouts only match overlapping sections), 38 of 47 sections
matched (81%): Linear 13/13, Aesop 8/12, Pentagram 17/22. The rest became five draft layouts: a product row, a category
strip, two large footers and a stacked editorial testimonial.

Known weak spots: section boxes stop at the content (a band's padding is missed), CSS-drawn quotes and div-built
product mock-ups read as plain features, product grids have no section type of their own (they type as pricing), and
very tall pages' full screenshots stop at 16,000px (section crops are complete).

## Where things live

- Engine: `scripts/library/`, `extension/src/sections.ts`, `extension/src/capture/siteTokens.ts`, `core/match.ts`.
- Coverage: `docs/layout-coverage.md`.
- Server: `library_sites`, `library_pages`, `library_sections`, `library_assets`; `Api\LibraryController`.
- Board: `lib/siteLibrary.ts`, `ui/library/SiteLibrary.tsx`, commands `list_library_sites`, `get_library_site`,
  `clip_from_site`, `use_site_style`.
