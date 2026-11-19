# Blokmix — Simple Vision

A niche, useful, and simple tool for starting a website from real sections instead of a blank prompt or AI defaults.

## Core idea

Skip the blank page. Blokmix gives you layouts, skins, palettes and looks that already work, and you mix them into
something that's yours: pick the layouts, put a skin and your colors on them, tune by feel, swap in your words. Clip
what you like from other sites and it joins the mix as more of the same: a layout, words, a look, or a whole skin.
Then hand the mix to your AI to build. No forced journey, no full site builder, no production hosting.

It's less "remix the web" than "take what works, make it yours". The fun is in trying things, so trying a layout never
costs you your words or your style.

## What comes back only adds options

Whatever comes into a mix after you start, from the extension, a site in the library, or your agent's build, lands as
more to choose from, marked with where it came from ("From stripe.com", "From Claude"). It never changes a pick you
made, it can be dismissed, and taking it is one undo step. The choices grow; the screen doesn't get busier. See
`roadmap.md` (Capture what you like, Bring it back).

It stays incomplete on purpose. The value is a grounded starting point and clear notes you can hand to whatever AI tool or stack you already use.

## Who it is for

People who are not designers (founders, marketers, developers who do not design) and who want to explore better design than the current wave of AI-slop defaults. They need a place to start from real sections that already work, then tune them under a coherent style.

Secondary: designers who want a fast surface for trying layouts and looks, but the primary promise is the non-designer starting point.

## The loop

1. **Start** — Pick a kind of site and let the guided start offer three, start from a starter mix or a site in the
   library, or clip sections you like. Built-in layouts begin as wireframes: grey and plain, for deciding the layout
   first. A section's arrows step through the layouts and this mix's own clips, always in your words and style. No
   required sequence.
2. **Style** — A style guide (from the clips, from an existing site/brand, or dialed) transforms the sections into live previews. Simple dials for tuning by feel (spacing, type, color, radius, light/dark).
3. **Mark & hand off** — Notes and marks live on the sections ("keep this layout", "try tighter"). Export a packet (styled components + notes + tokens) for your agent, or publish the mix.

Optional: publish the current mix to a noindex/nofollow page on blok.page so you can share the styled sections and style guide without it becoming a public site.

## What it is not

- Not a full website builder or host (not Squarespace, not Relume Publish).
- Not a forced multi-step process.
- Not a team inbox or project board (that is Koati).
- Not the place the final site lives.
- No AI that writes for you: Jev (TypeSafe) only places, picks and checks your own words, sections and pictures, and the reader (Claude, Anthropic) only reads what you wrote into Blokmix's own picks, every word it hands back copied from yours; your agent builds from the notes and export.

## Domains

- **blokmix.com** — marketing site and the app.
- **blok.page** — published, noindex snapshots of a mix + style guide (lightweight shareable view only).

## Guided start

New site is two screens. First, say what it is: a sentence with blanks ("I'm making a site for [a bakery] called [Fern &
Co]…"), with the real page beside it from the first blank, changing as you fill it in and saying why. Every blank takes
your own words, and a paragraph pasted into any of them fills in everything it can; under the sentence, a row for each
thing it understood (the kind of site, what it should do, the main button, the sections, the pages, who it's for, the
feel), each changeable where it sits. Your words are read, never written: the reader and Jev only pick from Blokmix's own
lists, and with suggestions off keywords do the same. Then pick a version: four whole pages, each a different layout and
look, each with a line on what it is and how its first screen holds up. Mix shows a new row; keep the layout or the look
you like and the rest changes; say more like this or not this. Open one and it's your site, that page alone; what you
passed on is remembered, so later rows lean your way. A starter, a saved style guide, a blank page or a site file are one
quiet line under the sentence, not a first screen.

What you said the site is for (the brief) stays with the mix: it steers what's suggested later and goes to your agent
as "What this site is for".

The measuring borrows from Shu Ding's "The Calculus of Interfaces" (a page is a function of a few inputs, so you can
ask what fills the first screen and what moves it). We don't compile pages into math; we render the real sections
in hidden frames at several widths and read what we see.

## Pricing direction

See `pricing.md`: free to make, $30 a site when you ship it. Everything on the board is free, as many mixes as you
like; a mix is paid for once, when you export it or hand it to an agent. No subscription (only ever for hosting on your own domain, if we build it). Editors and viewers free. No seat math.

## Relationship to the rest of the suite

Blokmix can exist as a small, separate product because the job is different from Koati (personal exploration and handoff vs. team intake and deciding what to work on). The generation/style engine can be shared later if useful. Primary focus for revenue remains Koati; Blokmix stays ruthlessly small.

## Notes from conversation

- Clipping real sections is the fun part ("everything is a remix").
- Style guide is the active transformer; Dialkit-style dials make exploration fast.
- Marks become notes the agent keeps.
- Flexible entry (clips or wireframes) avoids Relume-style forced flows.
- Friend feedback (software dev who is not strong at websites): useful handoff to existing AI tools/stacks, stands apart from Figma-like apps, do not become Squarespace.
- Published pages are snapshots for sharing, not production sites.

Last updated: 2026-11-06
