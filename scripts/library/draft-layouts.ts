// Turn the sections no layout covers into draft briefs, one folder each: .out/library/drafts/<slug>-<page>-<n>/.
//   npx vite-node scripts/library/draft-layouts.ts [slug…] [--out .out/library]
// Each folder holds the section's screenshot, the captured clip (structure to read, never copy to ship: its words,
// images and brand stay on the site) and brief.md: what the section is, what the nearest layouts miss, and the rules
// the new layout follows. An agent then authors samples/clips/<type>/layout-<variant>/ with "status": "draft" and
// "inspiredBy" in clip.json; review removes the status, and match.ts --rematch --save points the section at it.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { library } from '@/data/library'
import { signatureOf, MATCH_THRESHOLD, type Signature } from '@/core/match'
import type { BundleSection, SiteBundle } from './capture-site'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const root = join(process.cwd(), opt('--out') ?? '.out/library')
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
const slugs = (wanted.length ? wanted : readdirSync(root)).filter((s) => existsSync(join(root, s, 'site.json')))
const out = join(root, 'drafts')

/** The signature in words, the way a reviewer would describe the section. */
export function describe(s: Signature): string {
  const bits = [`${s.rhythm} rhythm`]
  if (s.items) bits.push(`${s.items} items${s.columns > 1 ? ` in ${s.columns} columns` : ''}${s.cards ? ' as cards' : ''}`)
  if (s.media) bits.push(`${s.media} picture${s.media > 1 ? 's' : ''}${s.mediaAt !== 'none' ? ` (${s.mediaAt})` : ''}${s.video ? ', video' : ''}`)
  if (s.headCenter) bits.push('centered head')
  for (const [on, what] of [[s.band, 'inset band'], [s.form, 'a form'], [s.details, 'accordion'], [s.radios, 'tabs or slides'], [s.scroller, 'scrolling row'], [s.nested, 'nested lists'], [s.overlap, 'overlapping copy and media']] as const)
    if (on) bits.push(what)
  if (s.buttons) bits.push(`${s.buttons} button${s.buttons > 1 ? 's' : ''}`)
  return bits.join(', ')
}

let count = 0
for (const slug of slugs) {
  const b = JSON.parse(readFileSync(join(root, slug, 'site.json'), 'utf8')) as SiteBundle
  for (const p of b.pages)
    for (const s of p.sections as BundleSection[]) {
      if (s.status !== 'needs-layout' || !s.clip) continue
      const page = p.path === '/' ? 'home' : p.path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-')
      const dir = join(out, `${slug}-${page}-${s.n}`)
      mkdirSync(join(dir, 'capture'), { recursive: true })
      if (s.screenshot && existsSync(join(root, slug, s.screenshot))) copyFileSync(join(root, slug, s.screenshot), join(dir, 'section.webp'))
      writeFileSync(join(dir, 'capture', 'clip.html'), s.clip.html)
      writeFileSync(join(dir, 'capture', 'clip.css'), s.clip.css)
      const sig = signatureOf(s.clip as Parameters<typeof signatureOf>[0])
      const near = s.matches
        .map((m) => `- \`${m.layoutId}\` (${library.clips[m.layoutId]?.title ?? 'gone'}): ${m.score.toFixed(2)}, misses ${m.misses.join(', ')}. Its shape: ${library.clips[m.layoutId] ? describe(signatureOf(library.clips[m.layoutId])) : '?'}`)
        .join('\n')
      writeFileSync(
        join(dir, 'brief.md'),
        `# Draft layout: ${b.name} ${p.path} #${s.n} (${s.type})

**Section:** ${describe(sig)}. Typed \`${s.type}\` (${Math.round(s.confidence * 100)}%: ${s.reason}). ${s.box.w}×${s.box.h}px at 1440.
**Screenshot:** \`section.webp\`. **Captured structure:** \`capture/clip.html\`, \`capture/clip.css\` (the site's own build, normalized onto
Blokmix's primitive names; read it for structure, never ship its words, images, icons or brand).

## Nearest layouts (threshold ${MATCH_THRESHOLD})

${near}

## What to make

A new built-in layout, \`samples/clips/${s.type}/layout-<variant>/\` (clip.html, clip.css, motion.css, clip.json), that a section shaped like
this one would match. Name the variant after the shape, not the site. If the type is wrong (the section is really another kind), say so
and author it under the right type.

- Follow every rule in CLAUDE.md (Clip authoring rules, Craft, Built-in layouts, Layout primitives): tokens only, primitives copied from
  \`samples/layout-primitives.css\`, \`.col-N\` spans rather than pixel tracks, fields from \`FIELD_SCHEMA.${s.type}\`, blocks and lists
  marked, CSS/SVG placeholder art, 1440 and 390.
- clip.json: \`"rhythm"\`, \`"style"\`, \`"density"\`, \`"status": "draft"\` and \`"inspiredBy": { "site": ${JSON.stringify(b.name)}, "url": ${JSON.stringify(new URL(p.path, b.url).href)} }\`.
- Gates: \`npx vite-node scripts/lint-clips.ts ${s.type}.layout-<variant>\` clean, and
  \`npx vite-node scripts/render-clips.ts ${s.type}.layout-<variant> --variants base,min,max,dark --widths 1440,390\` with no ⚠.
- Then \`npx vite-node scripts/library/match.ts --rematch --include-drafts\` should show this section matching it.
`,
      )
      count++
      console.log(`  ${slug} ${p.path} #${s.n} ${s.type}: ${describe(sig)} → ${dir}`)
    }
}
console.log(count ? `\n${count} draft brief${count > 1 ? 's' : ''} in ${out}` : 'Every section has a layout.')
