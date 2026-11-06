// What to make next, read off the site library by Jev.
//
//   npx vite-node scripts/library/gaps.ts [slug…|--all] [--min-sites 2] [--limit N]
//
// For every captured section in database/library/<slug>/ (its screenshot), one Jev request
// asks its type, its shape and ~30 yes/no questions about elements and visual treatments.
// Writes .out/library/gaps.md (layouts, elements and treatments to make, sections that may
// be the wrong type) and gaps.json (every answer). Needs TYPESAFE_API_KEY.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gapMarkdown, gapReport, gapRequest, placeWords, readSection, type SectionRead } from '../../resources/js/core/jev/gaps'
import { imageRef } from '../../resources/js/core/jev'
import type { SectionType } from '../../resources/js/core/types'
import { library } from '../../resources/js/data/library'
import { treatmentList } from '../../resources/js/core/treatments'
import { launchBrowser } from '../../extension/scripts/fixtures'
import { ask, dollars, jevKey, pool } from '../jev/client'
import { drawingPage, fileToJevJpeg } from '../jev/toJpeg'

const ROOT = 'database/library'
const OUT = '.out/library'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const minSites = Number(flag('--min-sites') ?? 2)
const limit = Number(flag('--limit') ?? Infinity)
const named = args.filter((a, i) => !a.startsWith('--') && !['--min-sites', '--limit'].includes(args[i - 1] ?? ''))
const slugs = named.length && !args.includes('--all') ? named : readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'upload.json')))

if (!jevKey()) {
  console.error('No TYPESAFE_API_KEY: put it in .env.local (or export it) and run again.')
  process.exit(1)
}

interface UploadSection { order: number; type: SectionType; layoutId?: string; status?: string; screenshot?: string }
interface Upload { slug: string; pages: { path: string; sections: UploadSection[] }[] }

const jobs: { site: string; page: string; s: UploadSection; file: string; place: string }[] = []
for (const slug of slugs) {
  const up = JSON.parse(readFileSync(join(ROOT, slug, 'upload.json'), 'utf8')) as Upload
  for (const page of up.pages)
    page.sections.forEach((s, k) => {
      if (s.screenshot && existsSync(join(ROOT, slug, s.screenshot))) jobs.push({ site: slug, page: page.path, s, file: join(ROOT, slug, s.screenshot), place: placeWords(k, page.sections.length) })
    })
}
const todo = jobs.slice(0, limit)
console.log(`Reading ${todo.length} sections from ${slugs.length} sites…`)

const browser = await launchBrowser()
if (!browser) {
  console.error('No Chrome to convert screenshots with (playwright-core needs Chrome or Chromium installed).')
  process.exit(1)
}
const page = await drawingPage(browser)

// Converting runs one at a time on the one page; asking runs a few at a time.
const converted: (Awaited<ReturnType<typeof fileToJevJpeg>>)[] = []
for (const j of todo) converted.push(await fileToJevJpeg(page, j.file))
await browser.close()

let tokens = 0
const times: number[] = []
const errors: string[] = []
const reads = await pool(todo, 6, async (j, i): Promise<SectionRead | null> => {
  const img = converted[i]
  if (!img) return null
  const ref = imageRef(`s${i}`)
  const { res, ms, error } = await ask(gapRequest(ref, img.asset, j.place))
  if (error) errors.push(`${j.site}/${j.s.screenshot}: ${error}`)
  times.push(ms)
  tokens += res?.usage.input_tokens ?? 0
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${todo.length}`)
  return readSection({ site: j.site, page: j.page, order: j.s.order, screenshot: j.s.screenshot!, storedType: j.s.type, layoutId: j.s.layoutId, status: j.s.status }, res)
})

const ok = reads.filter((r): r is SectionRead => !!r)
const have = {
  clips: new Set(Object.keys(library.clips)),
  treatments: new Set([
    ...treatmentList().map((t) => `${t.surface}:${t.id}`),
    'look:heading.scribble',
    'placeholder:shapes',
    ...treatmentList().filter((t) => t.surface === 'mock').map((t) => `mock:${t.id}`),
  ]),
}
const report = gapReport(ok, have)
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'gaps.json'), JSON.stringify({ report, reads: ok }, null, 2))
writeFileSync(join(OUT, 'gaps.md'), gapMarkdown(report, minSites))

const sorted = [...times].sort((a, b) => a - b)
const p = (q: number) => Math.round(sorted[Math.floor(q * (sorted.length - 1))] ?? 0)
const agree = ok.filter((r) => r.type.option === r.storedType).length
console.log(`\nRead ${ok.length}/${todo.length} sections · type agrees with the stored one on ${agree} (${Math.round((agree / Math.max(1, ok.length)) * 100)}%)`)
console.log(`Latency p50 ${p(0.5)} ms · p95 ${p(0.95)} ms · ${tokens.toLocaleString()} input tokens ≈ $${dollars(tokens).toFixed(4)}`)
if (errors.length) console.log(`${errors.length} failed, e.g. ${errors.slice(0, 3).join(' | ')}`)
console.log(`Wrote ${join(OUT, 'gaps.md')} and gaps.json`)
