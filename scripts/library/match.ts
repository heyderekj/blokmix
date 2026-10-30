// Read the site-library bundles (.out/library/<slug>/site.json) and report how well Blokmix's layouts cover them.
//   npx vite-node scripts/library/match.ts [slug…] [--out .out/library] [--rematch [--save] [--include-drafts]] [--compare]
// Prints the match rate per site and per type, the most common misses, the needs-layout sections and the sections
// whose type is a guess. --rematch scores the stored signatures against the current library (layouts added since
// the capture count), re-reading each signature off its captured clip. --compare renders each matched section's layout under the site's tokens next to the section's
// screenshot: .out/library/<slug>/compare/<page>-<n>.png.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { DEFAULT_CONTENT } from '@/core/content'
import { composeSite } from '@/core/compose'
import { resolveGuide } from '@/core/guide'
import { siteFromSlots } from '@/core/site'
import { referenceHtml } from '@/core/export/reference-html'
import { matchLayouts, signatureOf, MATCH_THRESHOLD, type Signature } from '@/core/match'
import { library } from '@/data/library'
import { launchBrowser } from '../../extension/scripts/fixtures'
import type { BundleSection, SiteBundle } from './capture-site'
import { uploadShape } from './upload-shape'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const root = join(process.cwd(), opt('--out') ?? '.out/library')
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
const slugs = (wanted.length ? wanted : existsSync(root) ? readdirSync(root) : []).filter((s) => existsSync(join(root, s, 'site.json')))
if (!slugs.length) throw new Error(`No bundles in ${root} (run scripts/library/capture-site.ts first)`)

const bundles = slugs.map((s) => JSON.parse(readFileSync(join(root, s, 'site.json'), 'utf8')) as SiteBundle)
if (args.includes('--rematch'))
  for (const b of bundles)
    for (const p of b.pages)
      for (const s of p.sections) {
        // Re-read the signature off the captured clip, so checks added to the matcher since the capture count too.
        if (s.clip) s.signature = signatureOf(s.clip as Parameters<typeof signatureOf>[0])
        if (!s.signature) continue
        s.matches = matchLayouts(s.signature, library, { limit: 3, includeDrafts: args.includes('--include-drafts') })
        s.status = s.matches[0] && s.matches[0].score >= MATCH_THRESHOLD ? 'matched' : 'needs-layout'
      }

const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`.padStart(4)
const rows = bundles.flatMap((b) => b.pages.flatMap((p) => p.sections.map((s) => ({ b, p, s }))))

console.log(`Threshold ${MATCH_THRESHOLD}\n\nPer site`)
for (const b of bundles) {
  const all = b.pages.flatMap((p) => p.sections)
  const ok = all.filter((s) => s.status === 'matched').length
  const errs = all.filter((s) => s.error).length
  console.log(`  ${b.slug.padEnd(14)} ${pct(ok, all.length)}  ${ok}/${all.length} matched${errs ? `, ${errs} failed to capture` : ''}  (${b.pages.length} page${b.pages.length > 1 ? 's' : ''})`)
}
const total = rows.filter((r) => r.s.status === 'matched').length
console.log(`  ${'all'.padEnd(14)} ${pct(total, rows.length)}  ${total}/${rows.length}`)

console.log('\nPer type')
const types = [...new Set(rows.map((r) => r.s.type))].sort()
for (const t of types) {
  const of = rows.filter((r) => r.s.type === t)
  const ok = of.filter((r) => r.s.status === 'matched').length
  const avg = of.reduce((n, r) => n + (r.s.matches[0]?.score ?? 0), 0) / of.length
  console.log(`  ${t.padEnd(14)} ${pct(ok, of.length)}  ${ok}/${of.length}  avg best ${avg.toFixed(2)}`)
}

console.log('\nMost common misses (best match of each section)')
const misses = new Map<string, number>()
for (const r of rows) for (const m of r.s.matches[0]?.misses ?? []) misses.set(m, (misses.get(m) ?? 0) + 1)
for (const [m, n] of [...misses].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(3)}  ${m}`)

const describe = (s: BundleSection) => (s.signature ? describeSig(s.signature) : s.error ? `capture failed: ${s.error}` : 'no signature')
console.log('\nNeeds a layout')
for (const { b, p, s } of rows.filter((r) => r.s.status === 'needs-layout')) {
  const m = s.matches[0]
  console.log(`  ${b.slug} ${p.path} #${s.n} ${s.type}: ${describe(s)}${m ? `  (closest ${m.layoutId} ${m.score.toFixed(2)}: ${m.misses.join(', ')})` : ''}`)
}
const review = rows.filter((r) => r.s.review)
if (review.length) {
  console.log('\nType is a guess (review)')
  for (const { b, p, s } of review) console.log(`  ${b.slug} ${p.path} #${s.n} ${s.type} ${s.confidence.toFixed(2)} (${s.reason}): ${describe(s)}`)
}

function describeSig(g: Signature): string {
  const bits = [g.rhythm]
  if (g.items) bits.push(`${g.items} item${g.items > 1 ? 's' : ''}${g.columns > 1 ? ` in ${g.columns} columns` : ''}${g.cards ? ' as cards' : ''}`)
  if (g.media) bits.push(`${g.media} picture${g.media > 1 ? 's' : ''}${g.mediaAt !== 'none' ? ` (${g.mediaAt})` : ''}`)
  if (g.video) bits.push('video')
  if (g.headCenter) bits.push('centered head')
  if (g.band && g.rhythm !== 'band') bits.push('band')
  if (g.form) bits.push('form')
  if (g.details) bits.push('accordion')
  if (g.radios) bits.push('tabs/slides')
  if (g.scroller) bits.push('scrolling row')
  if (g.nested) bits.push('nested lists')
  if (g.buttons) bits.push(`${g.buttons} button${g.buttons > 1 ? 's' : ''}`)
  return bits.join(', ')
}

if (args.includes('--compare')) {
  const browser = await launchBrowser()
  if (!browser) throw new Error('No Chrome found for playwright-core')
  for (const b of bundles) {
    const dir = join(root, b.slug, 'compare')
    mkdirSync(dir, { recursive: true })
    const guide = resolveGuide({ base: b.source.tokens, candidates: [], choices: {} })
    for (const p of b.pages) {
      const ps = p.path.replace(/^\/+|\/+$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'home'
      for (const s of p.sections) {
        const m = s.matches[0]
        if (s.status !== 'matched' || !m || !library.clips[m.layoutId]) continue
        const clip = library.clips[m.layoutId]
        const slot: Slot = { id: 'r', type: clip.type, clipId: clip.id, locked: false, keep: { ...DEFAULT_KEEP, content: true } }
        const page = composeSite({ site: siteFromSlots([slot]), guide, content: DEFAULT_CONTENT, library, title: clip.id })
        const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } })
        const html = referenceHtml(page, { vh: '9px' })
        await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => tab.setContent(html))
        await tab.waitForTimeout(1200)
        const rendered = (await tab.screenshot({ fullPage: true, type: 'jpeg', quality: 80 })).toString('base64')
        const shot = readFileSync(join(root, b.slug, s.screenshot)).toString('base64')
        const label = (t: string) => `<div style="font:600 22px/1.3 system-ui;padding:12px 16px;background:#111;color:#fff">${t}</div>`
        await tab.setViewportSize({ width: 2900, height: 900 })
        await tab.setContent(
          `<body style="margin:0;background:#888;display:flex;gap:20px;align-items:flex-start">` +
            `<div style="width:1440px">${label(`${b.slug} ${p.path} #${s.n} ${s.type}`)}<img style="display:block;width:1440px" src="data:image/webp;base64,${shot}"></div>` +
            `<div style="width:1440px">${label(`${m.layoutId} · ${m.score.toFixed(2)}${m.misses.length ? ` · ${m.misses.join(', ')}` : ''}`)}<img style="display:block;width:1440px" src="data:image/jpeg;base64,${rendered}"></div></body>`,
          { waitUntil: 'load' },
        )
        const file = join(dir, `${ps}-${s.n}.png`)
        await tab.screenshot({ path: file, fullPage: true })
        await tab.close()
        console.log(file)
      }
    }
  }
  await browser.close()
}

// Keep the rematched statuses when asked to save them (site.json, and upload.json for the server).
if (args.includes('--rematch') && args.includes('--save'))
  for (const b of bundles) {
    writeFileSync(join(root, b.slug, 'site.json'), JSON.stringify(b, null, 2) + '\n')
    writeFileSync(join(root, b.slug, 'upload.json'), JSON.stringify(uploadShape(b), null, 2) + '\n')
  }
