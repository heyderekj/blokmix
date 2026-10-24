// Screenshot library clips the way the reference build draws them, under any source's tokens,
// to check layouts at desktop and phone widths without the app.
//   npx vite-node scripts/render-clips.ts hero.layout-split features   (clip ids, or a type for all its layouts)
//   … --sources layout,nightowl --widths 1440,390 --copy yours
// Writes .out/renders/clips/<clip>@<source>-<width>.png and prints the paths.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_KEEP, SECTION_TYPES, type SectionType, type Slot } from '../resources/js/core/types'
import { DEFAULT_CONTENT } from '../resources/js/core/content'
import { composeSite } from '../resources/js/core/compose'
import { resolveGuide } from '../resources/js/core/guide'
import { siteFromSlots } from '../resources/js/core/site'
import { referenceHtml } from '../resources/js/core/export/reference-html'
import { library } from '../resources/js/data/library'
import { launchBrowser } from '../extension/scripts/fixtures'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const flagged = new Set(['--sources', '--widths', '--copy'].flatMap((f) => [f, opt(f, '')]))
const wanted = args.filter((a) => !flagged.has(a))
const sources = opt('--sources', 'layout').split(',')
const widths = opt('--widths', '1440,390').split(',').map(Number)
const yourCopy = opt('--copy', 'clip') === 'yours'

const ids = wanted.flatMap((w) => (SECTION_TYPES.includes(w as SectionType) ? library.layoutsByType[w as SectionType] : [w]))
for (const id of ids) if (!library.clips[id]) throw new Error(`No clip "${id}"`)
if (!ids.length) throw new Error('Usage: render-clips.ts <clip id | type>… [--sources layout,nightowl] [--widths 1440,390]')

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome or Chromium found for playwright-core')
const out = join(process.cwd(), '.out', 'renders', 'clips')
mkdirSync(out, { recursive: true })

for (const sourceId of sources) {
  const source = library.sources[sourceId]
  if (!source) throw new Error(`No source "${sourceId}"`)
  const guide = resolveGuide({ base: source.tokens, candidates: [], choices: {} })
  for (const id of ids) {
    const clip = library.clips[id]
    const slot: Slot = { id: 'r', type: clip.type, clipId: id, locked: false, keep: { ...DEFAULT_KEEP, content: !yourCopy } }
    const page = composeSite({ site: siteFromSlots([slot]), guide, content: DEFAULT_CONTENT, library, title: id })
    const html = referenceHtml(page, { vh: '9px' })
    for (const width of widths) {
      const tab = await browser.newPage({ viewport: { width, height: 900 } })
      await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => tab.setContent(html))
      // Let entrance motion finish so the shot shows the at-rest state.
      await tab.waitForTimeout(1600)
      const file = join(out, `${id}@${sourceId}-${width}.png`)
      await tab.screenshot({ path: file, fullPage: true })
      const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      console.log(`${file}${overflow > 0 ? `  ⚠ ${overflow}px horizontal overflow` : ''}`)
      await tab.close()
    }
  }
}
await browser.close()
