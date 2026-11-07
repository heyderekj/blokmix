// Screenshot one whole page under every theme, to judge the themes side by side.
//   npx vite-node scripts/render-skins.ts [--skins studio,vinyl] [--starter product-calm] [--widths 1440,390]
// The page is a starter's first page (product-calm by default: nav, hero, logos, features, testimonials, pricing, faq,
// cta, footer), in the layouts' own sample words. Writes .out/renders/skins/<skin>-<width>.png and prints the paths.

import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_KEEP, type Slot } from '../resources/js/core/types'
import { DEFAULT_CONTENT } from '../resources/js/core/content'
import { composeSite } from '../resources/js/core/compose'
import { emptyGuide, resolveGuide } from '../resources/js/core/guide'
import { applySkin, skinById, skinList } from '../resources/js/core/skins'
import { siteFromSlots } from '../resources/js/core/site'
import { referenceHtml } from '../resources/js/core/export/reference-html'
import { library } from '../resources/js/data/library'
import { launchBrowser } from '../extension/scripts/fixtures'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const widths = opt('--widths', '1440,390').split(',').map(Number)
const starterId = opt('--starter', 'product-calm')
const wanted = opt('--skins', '')

const starterFile = readdirSync('samples/starters').find((f) => f === `${starterId}.json`)
if (!starterFile) throw new Error(`No starter "${starterId}" in samples/starters/`)
const starter = JSON.parse(readFileSync(join('samples/starters', starterFile), 'utf8')) as { pages: { sections: string[] }[] }
const clipIds = starter.pages[0].sections
for (const id of clipIds) if (!library.clips[id]) throw new Error(`No clip "${id}"`)

const skins = wanted ? wanted.split(',').map((id) => skinById(id) ?? (() => { throw new Error(`No skin "${id}"`) })()) : skinList()

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome or Chromium found for playwright-core')
const out = join(process.cwd(), '.out', 'renders', 'skins')
mkdirSync(out, { recursive: true })

for (const skin of skins) {
  const state = applySkin(emptyGuide(), skin)
  const guide = resolveGuide(state)
  const slots: Slot[] = clipIds.map((clipId, i) => ({ id: `s${i}`, type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP } }))
  const page = composeSite({ site: siteFromSlots(slots), guide, content: DEFAULT_CONTENT, library, title: skin.name, page: state })
  const html = referenceHtml(page, { vh: '9px' })
  for (const width of widths) {
    const tab = await browser.newPage({ viewport: { width, height: 900 } })
    await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => tab.setContent(html))
    // The at-rest state: let entrances finish, and drop scroll-driven ones (a still has no scroll).
    await tab.addStyleTag({ content: '*, *::before, *::after { animation-timeline: auto !important; animation-range: normal !important; }' })
    await tab.waitForTimeout(1600)
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const file = join(out, `${skin.id}-${width}.png`)
    await tab.screenshot({ path: file, fullPage: true })
    console.log(`${file}${overflow > 0 ? `  ⚠ ${overflow}px horizontal overflow` : ''}`)
    await tab.close()
  }
}
await browser.close()
