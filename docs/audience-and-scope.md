# Audience and scope

Notes from product discussion (Oct 2026) on who Blokmix is for and how complete the app should be.

## Primary audience

Independent designers and small studios (roughly 1–5 people) who regularly build client marketing sites.

They already:
- Keep folders of reference sites / screenshots
- Need to turn those into real visual options a client can react to quickly
- Hand structured work to an AI agent (Cursor, Claude Code, etc.) or a developer
- Care about style consistency, versioning, and light client feedback (marks on a share link) without a full Figma collaboration setup or locked-in no-code host

The export to Astro/Next.js with tokens and build notes matches how many of them already work. The “folder of screenshots → real options the same afternoon” story is the core pain.

Secondary audiences that still fit:
- Solo product designers or marketers building landing pages who want better starting points than pure AI generators (Lovable, v0) but still want ownership of the code
- Small agencies doing a high volume of similar marketing sites who want a faster reference-to-first-draft step

Less ideal:
- Pure developers who prefer starting from code
- Large design-systems teams already deep in Figma
- People who want to publish and host entirely inside Framer or Webflow

This also lines up with the rest of the suite (Koati for capturing and agreeing on requests, ReviseMy for visual feedback). Blokmix fills the “make the first real design options from references” slot.

## Squarespace users who want more customization

A possible adjacent group: non-technical or lightly technical small business owners / freelancers currently on Squarespace (or similar) who hit template limits and want something more unique.

Their expected solution is still something that feels as complete and hands-off as Squarespace (hosting, domain, forms, basic content editing, polished result). That is a full site-builder product with hosting, support, and uptime expectations.

Blokmix as designed is several steps away: it assumes someone who can collect references, make design decisions, and hand a structured project to an AI agent or developer. That is a designer- or semi-technical workflow.

**Recommendation:** do not chase the pure Squarespace user as the core audience. Webflow and Framer already serve the “more customization than Squarespace” designers and semi-technical users for hosted experiences. The pure Squarespace user is better served by those tools or by staying on Squarespace/Wix if they primarily want simplicity and all-in-one hosting.

## How complete should the app be?

Keep it deliberately incomplete for a full end-user site builder.

The distinctive value is the reference-to-styled-first-draft step. Adding true hosting and client-facing content editing would put it in competition with Webflow/Framer on their home turf and add infrastructure, support, and pricing complexity that doesn’t match the current model or the “your agent builds it” positioning.

### Lighter middle path (optional)

If we want to help designers who currently push clients toward Squarespace because custom work is slow:

- Keep the canvas and remix model simple and designer-oriented
- Make the export path smoother: one-click or guided deploy of the Astro output to Cloudflare Pages, Vercel, or Netlify (we already use Cloudflare). This gives designers (and more technical clients) a live site without us running a full hosting business
- Optionally add a very lightweight “publish” mode that uses the user’s own AI agent with strong scaffolding, rather than building an in-product AI or editor for non-designers
- Leave forms, CMS depth, e-commerce, and ongoing content editing to the exported site or to tools the designer already uses

This keeps the app simple, avoids the hosting burden, and still serves the adjacent group of freelancers and small studios.

## Summary

- Core: designer-led, reference-driven, AI-assisted first drafts for client marketing sites
- Stay incomplete on purpose: stop at a good packet for an agent or designer to finish
- Hosting / full client editing: out of scope for now; consider lightweight deploy helpers later if needed
- Messaging should stay focused on the specific pain of turning references into client-ready options quickly, not “anyone who makes websites”
