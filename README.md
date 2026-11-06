# Blokmix

Start a website from layouts, skins and palettes that already work, mix them into something that's yours, and hand a packet to your agent to build in Astro or Next.js.

This is the clickable prototype: the core loop runs end to end on 18 sample clips from four fictional sites. The capture extension, backend and MCP server come later (see the plan below).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## The loop

1. **Try layouts.** Each section of the working mix steps through the built-in layouts of its type and this mix's own clips (← →, or ‹ › in the bar below the section), always in your words and your style. Space shuffles unlocked sections; L locks one.
2. **Keep.** Per section: layout, own style, source copy, motion (1–4).
3. **Resolve.** Promote a clip's design (P, or "Use design") and settle contradictions per group in the Style guide. Flip **Original / Your style** (U) to see the difference.
4. **Save version.** Enter (or ⌘S) snapshots the mix as a lettered version (A, B…). Work from any version to branch (B.1, B.2).
5. **Export.** Send a version to the agent with Build, or open Export: `blokmix.json`, `BLOKMIX.md` build notes, tokens (CSS + W3C DTCG), and runnable `astro/` and `next/` projects.

Sticky notes (S) dropped on a section or a version become instructions in the packet. Version frames carry review statuses (in progress → ready for review → changes requested / approved).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Core tests: guide resolution, clip lint, every clip through both exporters |
| `npm run typecheck` / `npm run build` | Types / production build |
| `npm run export:demo` | Writes the seeded demo packet to `.out/packet` (then `npm i && npm run build` inside `astro/` or `next/`) |

## Layout

`resources/js` mirrors the Laravel React starter kit (`pages/`, `components`-style folders, `@/` alias), so the app can move into Laravel + Inertia on Laravel Cloud without restructuring. `resources/js/core` is framework-free so the capture extension and MCP server can reuse it. Clip authoring rules live in `CLAUDE.md`.

## Next phases

1. Laravel + Inertia on Laravel Cloud: projects, clip storage, auth, share links
2. Chrome MV3 "Clip section" extension that emits this clip format
3. MCP server (`laravel/mcp`): `get_packet`, `list_versions`, `set_status`, `submit_version`, `add_note`; agent presence driven by real calls
4. ReviseMy reviews from version frames (statuses + marks as stickies) and "Open in Koati"
5. Bookmark-app and gallery imports
