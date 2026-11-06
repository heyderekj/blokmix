// Section types from screenshots: the site library's stored types (the capture's guess,
// corrected in /library/admin) are the truth. One shuffled Choice per section.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { choice, imageRef, merged, shuffled, at, type JevAsset } from '../../../resources/js/core/jev'
import { SECTION_CRITERIA } from '../../../resources/js/core/jev/vocab'
import { placeWords } from '../../../resources/js/core/jev/gaps'
import type { SectionType } from '../../../resources/js/core/types'
import { launchBrowser } from '../../../extension/scripts/fixtures'
import { drawingPage, fileToJevJpeg } from '../toJpeg'
import type { Suite } from './index'

interface Case { site: string; screenshot: string; type: SectionType; asset: JevAsset; place: string }

const ROOT = 'database/library'

export const types: Suite<Case> = {
  name: 'types',
  async load() {
    const browser = await launchBrowser()
    if (!browser) throw new Error('No Chrome for converting screenshots')
    const page = await drawingPage(browser)
    const cases: Case[] = []
    for (const slug of readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'upload.json')))) {
      const up = JSON.parse(readFileSync(join(ROOT, slug, 'upload.json'), 'utf8')) as { pages: { sections: { type: SectionType; screenshot?: string }[] }[] }
      for (const p of up.pages)
        for (const [k, s] of p.sections.entries()) {
          if (!s.screenshot) continue
          const img = await fileToJevJpeg(page, join(ROOT, slug, s.screenshot))
          if (img) cases.push({ site: slug, screenshot: s.screenshot, type: s.type, asset: img.asset, place: placeWords(k, p.sections.length) })
        }
    }
    await browser.close()
    return cases
  },
  request(c) {
    const ref = imageRef('s')
    return { state: { section: ref, place: c.place }, assets: { [ref]: c.asset }, questions: shuffled('type', choice(`What kind of website section is ${at('section')}? ${at('place')} says where it sits on its page.`, SECTION_CRITERIA)) }
  },
  judge(c, res) {
    const m = merged(res, 'type')
    return [{ truth: c.type, jev: m?.choice ?? '', p: m?.probabilities[m.choice] ?? 0, agree: m?.agree }]
  },
}
