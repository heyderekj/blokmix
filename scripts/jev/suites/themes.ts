import '@/data/skins'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { launchBrowser } from '../../../extension/scripts/fixtures'
import { rankThemes } from '@/core/themeRanking'
import { themeRequest, themeScores } from '@/core/jev/themes'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { resolveGuide } from '@/core/guide'
import { themeScene } from '@/core/themeScene'
import { SceneDrawing } from '@/ui/skins/SkinSpecimen'
import type { Brief, Industry } from '@/core/brief'
import type { FeelWord } from '@/core/feel'
import type { JevAsset } from '@/core/jev'
import type { Suite } from './index'

interface Case {
  text: string
  brief: Brief
  acceptable: string[]
}
function example(industry: Industry, text: string, feel: FeelWord[], acceptable: string[]): Case {
  return { text, brief: { industry, feel }, acceptable }
}
const briefs = [
  example('food', 'An inviting neighborhood bakery with warm colors and friendly lettering', ['warm'], ['lofi', 'mixtape', 'acoustic']),
  example(
    'food',
    'A stark, serious bakery journal. Restrained typography, like a printed magazine.',
    ['classic', 'serious'],
    ['liner-notes', 'vinyl', 'field-recording', 'gatefold'],
  ),
  example('fintech', 'A household budgeting app with clear type and orderly forms', ['serious', 'modern'], ['mastered', 'studio', 'afterhours']),
  example('fintech', 'A playful money app for children with soft rounded cards', ['playful'], ['homeroom', 'dreampop', 'mixtape']),
  example('architecture', 'A quiet portfolio of architecture and interiors', ['classic', 'calm'], ['gatefold', 'vinyl', 'field-recording']),
  example('architecture', 'An experimental architecture exhibition with loud poster headlines', ['bold'], ['flyer', 'press-kit', 'mixtape']),
  example('ai', 'A dark developer console for running language models', ['dark', 'modern'], ['deep-cut', 'afterhours']),
  example('health', 'A reassuring practice for family medicine', ['warm', 'calm'], ['acoustic', 'lofi', 'studio']),
  example('education', 'A bright and friendly school open day', ['playful'], ['homeroom', 'dreampop', 'mixtape']),
  example('travel', 'A field journal of walking trails and places to stay', ['warm', 'classic'], ['field-recording', 'liner-notes', 'lofi']),
  example('media', 'An independent culture magazine with bold headlines', ['classic', 'bold'], ['press-kit', 'liner-notes', 'vinyl']),
  example('ecommerce', 'A colorful pop-up shop for records and gifts', ['warm', 'playful'], ['mixtape', 'lofi', 'flyer']),
  example('nonprofit', 'A calm editorial annual report for a conservation charity', ['classic', 'calm'], ['field-recording', 'gatefold', 'liner-notes']),
  example('services', 'A welcoming independent therapy practice', ['calm', 'warm'], ['acoustic', 'lofi']),
  example('agency', 'An architecture photography studio with a quiet portfolio', ['calm', 'classic'], ['gatefold', 'vinyl', 'studio']),
  example('devtools', 'A dark API reference with crisp technical lettering', ['dark', 'modern'], ['deep-cut', 'afterhours']),
  example('events', 'A dark and dramatic music festival poster', ['bold', 'dark'], ['press-kit', 'vinyl', 'afterhours']),
  example('saas', 'A precise light software product page with strong hierarchy', ['modern', 'serious'], ['studio', 'mastered']),
]
const candidates = (c: Case) => rankThemes({ brief: c.brief, count: 10 })
const hit = (c: Case, ids: string[]) => ids.slice(0, 3).some((id) => c.acceptable.includes(id.split('/')[0]))
export function localThemeBenchmark() {
  const misses = briefs.filter(
    (c) =>
      !hit(
        c,
        candidates(c).map((r) => r.skin.id),
      ),
  )
  return { briefs: briefs.length, topThreeHits: briefs.length - misses.length, misses: misses.map((c) => c.text) }
}

interface WithPictures extends Case {
  ids: string[]
  pictures: JevAsset[]
}
export const themes: Suite<WithPictures> = {
  name: 'themes',
  async load() {
    const browser = await launchBrowser()
    if (!browser) throw new Error('Chrome is required for visual theme benchmarking')
    try {
      const page = await browser.newPage({ viewport: { width: 600, height: 300 } })
      const images = new Map<string, JevAsset>()
      const cases: WithPictures[] = []
      for (const c of briefs) {
        const ranked = candidates(c)
        for (const r of ranked) {
          if (images.has(r.skin.id)) continue
          const scene = themeScene(r.guide, 'Your site')
          const fonts = fontHrefs(fontsForTokens(resolveGuide(r.guide).tokens, []))
          const links = fonts.map((href) => renderToStaticMarkup(createElement('link', { href, rel: 'stylesheet' }))).join('')
          await page.setContent(links + '<style>body{margin:0}</style>' + renderToStaticMarkup(createElement(SceneDrawing, { scene })))
          await page.evaluate(async () => {
            await document.fonts.ready
          })
          const bytes = await page.screenshot({ type: 'jpeg', quality: 84 })
          images.set(r.skin.id, { type: 'image', format: 'jpg', data_base64: bytes.toString('base64') })
        }
        const ids = ranked.map((r) => r.skin.id)
        cases.push({ ...c, ids, pictures: ids.map((id) => images.get(id)!) })
      }
      return cases
    } finally {
      await browser.close()
    }
  },
  request: (c) => themeRequest(c.text, c.pictures),
  judge(c, res) {
    const scores = themeScores(res, c.ids.length)
    const order = scores
      ? c.ids
          .map((id, i) => ({ id, score: scores[i] }))
          .sort((a, b) => b.score - a.score)
          .map((r) => r.id)
      : []
    return [{ truth: 'fit', jev: hit(c, order) ? 'fit' : 'miss', baseline: hit(c, c.ids) ? 'fit' : 'miss', p: scores ? Math.max(...scores) / 4 : 0 }]
  },
}
