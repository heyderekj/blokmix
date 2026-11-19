// Screenshot every direction as a whole page, to judge them side by side.
//   npx vite-node scripts/render-directions.ts [--only corner-bakery,ledger] [--kind local] [--widths 1440,390]
// Each direction dresses the kind's usual Home (local by default, or the direction's own first kind) in its look and
// its own layouts, with the kind's sample words. Writes .out/renders/directions/<id>-<width>.png and prints the paths.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { composeSite } from '../resources/js/core/compose'
import { directionStart } from '../resources/js/core/directions'
import { resolveGuide } from '../resources/js/core/guide'
import { referenceHtml } from '../resources/js/core/export/reference-html'
import type { Kind } from '../resources/js/core/types'
import { library } from '../resources/js/data/library'
import { directions } from '../resources/js/data/directions'
import { launchBrowser } from '../extension/scripts/fixtures'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const widths = opt('--widths', '1440,390').split(',').map(Number)
const only = opt('--only', '')
const kind = opt('--kind', '') as Kind | ''
const pool = only ? only.split(',').map((id) => directions.find((d) => d.id === id) ?? (() => { throw new Error(`No direction "${id}"`) })()) : directions

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome or Chromium found for playwright-core')
const out = join(process.cwd(), '.out', 'renders', 'directions')
mkdirSync(out, { recursive: true })

for (const d of pool) {
  const start = directionStart(d, { kind: kind || d.kinds?.[0] || 'local', name: d.name }, library)
  const page = composeSite({ site: start.site, guide: resolveGuide(start.guide), content: start.content, library, title: d.name, page: start.guide })
  const html = referenceHtml(page, { vh: '9px' })
  for (const width of widths) {
    const tab = await browser.newPage({ viewport: { width, height: 900 } })
    await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => tab.setContent(html))
    await tab.addStyleTag({ content: '*, *::before, *::after { animation-timeline: auto !important; animation-range: normal !important; }' })
    await tab.waitForTimeout(1600)
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const file = join(out, `${d.id}-${width}.png`)
    await tab.screenshot({ path: file, fullPage: true })
    console.log(`${file}${overflow > 0 ? `  ⚠ ${overflow}px horizontal overflow` : ''}`)
    await tab.close()
  }
}
await browser.close()
