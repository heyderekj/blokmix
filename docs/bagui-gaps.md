# BagUI against our layouts

BagUI (github.com/anelkabag/bag-ui, MIT, shadcn/Tailwind/Framer Motion) is a registry of 49 blocks. We checked
whether any of its website sections has a shape our built-in layouts don't cover. Its code isn't usable as clips
(hard-coded colors, motion in JavaScript, copy in JS arrays), so the only question was shape.

Checked 13 November 2026. Paused before the side-by-side review, so the gaps below are candidates, not confirmed.

## What was checked

The 16 free website blocks only. The 31 "pro" blocks are paid on bagui.pro even though their source is public, so we
leave them alone. The 10 dashboards, logins, sidebar and chat app aren't website sections.

bagui.pro's robots.txt disallows `/fullscreen/`, where its previews live, so nothing was captured from the site.
Each block was built locally from the MIT source, captured with the site library engine and matched against
our layouts under the type BagUI files it under. The capture's own type guess was wrong for 5 of 16 (footers read as
logos or cta, a feature grid as pricing, a CTA as content).

## Covered (12 of 16)

| BagUI block | Closest layout | Score |
|---|---|---|
| testimonial-1 | `testimonials.layout-wall` | 1.00 |
| feature-1 | `features.layout-staggered` | 0.99 |
| feature-3 | `features.layout-checklist` | 0.97 |
| pricing-1 | `pricing.layout-packages` | 0.96 |
| faq1 | `faq.layout-sidebar` | 0.92 |
| cta-2 | `cta.layout-centered` | 0.92 |
| contact-2 | `contact.layout-split` | 0.91 |
| pricing-3 | `pricing.layout-rows` | 0.90 |
| hero4 (hero) | `hero.layout-collage` | 0.85 |
| cta-1 | `cta.layout-media` | 0.82 |
| footer2 | `footer.layout-columns` | 0.82 |
| feature-2 | `features.layout-grid` | 0.81 |
| footer1 | `footer.layout-inverse` | 0.79 |

Scores are `core/match.ts` similarity; `MATCH_THRESHOLD` is 0.78. footer1 and feature-2 sit close to it.

## Below the threshold

**Candidate gaps**

- **Booking card (contact-1, best 0.66 `contact.layout-map`).** One card split in two: a dark panel with the
  meeting's details (title, length, where, when, time zone, each with an icon) and a button, beside a form with
  name, email, a message with a character count, a yes/no radio question, terms, and two actions. It's
  closer to the last step of a booking flow than a contact form. It would serve the brief's "take bookings" goal.
  Compare it against `contact.layout-sidebar` and `contact.layout-split` before drafting.
- **CTA panel over columns with a newsletter (footer-3, best 0.61).** A rounded soft panel with a centered headline
  and one button, then logo, blurb and social icons, two link columns, a "Company" column holding a blurb and an
  inline email signup, and the legal row in its own soft strip. We have `footer.layout-cta` and
  `footer.layout-newsletter` separately. This may only be the two combined, which a variant could cover.

**Matcher misses, not gaps**

- **navbar2 (0.51)** is a floating pill (`nav.layout-pill`) with dropdown chevrons, a language picker, Sign in and a
  main button.
- **hero4's nav (0.60)** is a simple bar (`nav.layout-simple`) with a logo mark, a theme toggle, Sign in and Sign up.

Both lose points on "picture placement" and "pictures": the logo mark and the icons count as pictures. Nav
signatures may be weighting icons and logo marks too heavily. Worth a look in `core/match.ts`, separate from any
layout work.

## Picking it back up

The captures and the build harness are in `.out/bagui/`, which is gitignored and on this machine only:

- `src/`: the downloaded block source.
- `harness/`: stubs for motion, next/image, next/link, react-icons and gsap, which render each block at rest;
  `build.mjs`, `serve-capture.mjs` and `rematch.ts`.
- `library/0/site.json`: the captures and screenshots.
- `rematch.json`: the scores by true type.

To rebuild and rematch from the repo root:

```bash
node .out/bagui/harness/build.mjs && node .out/bagui/harness/serve-capture.mjs && npx vite-node .out/bagui/harness/rematch.ts
```

Next steps:

1. Put contact-1 and footer-3 beside the renders of their nearest layouts:
   `npx vite-node scripts/render-clips.ts contact.layout-sidebar contact.layout-split footer.layout-cta footer.layout-newsletter --sources layout --widths 1440`.
2. Draft anything still missing with `scripts/library/draft-layouts.ts`, credited with `inspiredBy`.
3. Add it to `docs/layout-coverage.md`.
