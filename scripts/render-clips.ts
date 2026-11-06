// Screenshot library clips the way the reference build draws them, under any source's tokens,
// to check layouts at desktop and phone widths without the app.
//   npx vite-node scripts/render-clips.ts hero.layout-split features   (clip ids, or a type for all its layouts)
//   … --sources layout --widths 1440,390 --copy yours --variants base,min,max,dark --skins calm,bold (or all)
//   … --click "li:nth-child(2) label"   clicks the first match before the shot (a second tab, a yearly price),
//   written as <clip>@<source>-<width>-clicked.png
// Variants stress a source's tokens with the Feel dials (core/dials.ts): min = every dial at 0 (tight, small,
// square, light), max = every dial at 100, dark = Light/Dark flipped; each dial alone is <dial>0 / <dial>100.
// Writes .out/renders/clips/<clip>@<source>-<width>.png and prints the paths.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_KEEP, SECTION_TYPES, type SectionType, type Slot } from '../resources/js/core/types'
import { DEFAULT_CONTENT } from '../resources/js/core/content'
import { composeSite } from '../resources/js/core/compose'
import { emptyGuide, resolveGuide } from '../resources/js/core/guide'
import { applySkin, skinById, skinList } from '../resources/js/core/skins'
import { siteFromSlots } from '../resources/js/core/site'
import { referenceHtml } from '../resources/js/core/export/reference-html'
import { library } from '../resources/js/data/library'
import { DIAL_NAMES, DIALS, setTone, type DialName } from '../resources/js/core/dials'
import type { GuideState, TokenSet } from '../resources/js/core/types'
import { launchBrowser } from '../extension/scripts/fixtures'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const flagged = new Set(['--sources', '--widths', '--copy', '--variants', '--skins', '--click'].flatMap((f) => [f, opt(f, '')]))
const wanted = args.filter((a) => !flagged.has(a))
const sources = opt('--sources', 'layout').split(',')
const widths = opt('--widths', '1440,390').split(',').map(Number)
const yourCopy = opt('--copy', 'clip') === 'yours'
const variants = opt('--variants', 'base').split(',')
const skinIds = opt('--skins', '')
const click = opt('--click', '')

function variantTokens(t: TokenSet, v: string): TokenSet {
  const all = (n: number) => Object.assign({}, ...DIAL_NAMES.map((d) => DIALS[d].write(n)))
  if (v === 'base') return t
  if (v === 'min') return { ...t, ...all(0) }
  if (v === 'max') return { ...t, ...all(100) }
  if (v === 'dark' || v === 'light') return { ...t, ...setTone(t, v) }
  const m = v.match(/^([a-z]+)(\d+)$/)
  if (m && DIAL_NAMES.includes(m[1] as DialName)) return { ...t, ...DIALS[m[1] as DialName].write(Number(m[2])) }
  throw new Error(`Unknown variant "${v}"`)
}

const ids = wanted.flatMap((w) => (SECTION_TYPES.includes(w as SectionType) ? library.layoutsByType[w as SectionType] : [w]))
for (const id of ids) if (!library.clips[id]) throw new Error(`No clip "${id}"`)
if (!ids.length) throw new Error('Usage: render-clips.ts <clip id | type>… [--sources layout] [--widths 1440,390]')

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome or Chromium found for playwright-core')
const out = join(process.cwd(), '.out', 'renders', 'clips')
mkdirSync(out, { recursive: true })

// Under a skin the whole style guide applies (block looks, section defaults, pictures); otherwise a source's tokens.
const runs: { tag: string; state: GuideState }[] = skinIds
  ? (skinIds === 'all' ? skinList().map((x) => x.id) : skinIds.split(',')).map((sid) => {
      const skin = skinById(sid)
      if (!skin) throw new Error(`No skin "${sid}"`)
      return { tag: `skin-${sid}`, state: applySkin(emptyGuide(), skin) }
    })
  : sources.flatMap((sourceId) => {
      const source = library.sources[sourceId]
      if (!source) throw new Error(`No source "${sourceId}"`)
      return variants.map((variant) => ({ tag: variant === 'base' ? sourceId : `${sourceId}~${variant}`, state: { base: variantTokens(source.tokens, variant), candidates: [], choices: {} } }))
    })

for (const { tag, state } of runs) {
  const guide = resolveGuide(state)
  for (const id of ids) {
    const clip = library.clips[id]
    const slot: Slot = { id: 'r', type: clip.type, clipId: id, locked: false, keep: { ...DEFAULT_KEEP, content: !yourCopy } }
    const page = composeSite({ site: siteFromSlots([slot]), guide, content: DEFAULT_CONTENT, library, title: id, page: state })
    const html = referenceHtml(page, { vh: '9px' })
    for (const width of widths) {
      const tab = await browser.newPage({ viewport: { width, height: 900 } })
      await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => tab.setContent(html))
      // Let entrance motion finish so the shot shows the at-rest state.
      await tab.waitForTimeout(1600)
      let missed = false
      if (click) {
        const target = tab.locator(click).first()
        missed = !(await target.count())
        if (!missed) {
          await target.click({ timeout: 3000 })
          // Let the click's transition settle.
          await tab.waitForTimeout(400)
        }
      }
      const file = join(out, `${id}@${tag}-${width}${click ? '-clicked' : ''}.png`)
      await tab.screenshot({ path: file, fullPage: true })
      // Page overflow, and elements poking past the section's content box even when something clips them
      // (intentional scrollers, like a scroll-snap row, and absolutely placed art are left out).
      const { page: overflow, spill, cut } = await tab.evaluate(() => {
        const root = document.querySelector('body > section, body > header, body > footer, body > nav, body section, body header, body footer, body nav') as HTMLElement
        const box = root.getBoundingClientRect()
        const pad = parseFloat(getComputedStyle(root).paddingLeft)
        const scrolls = (el: Element | null): boolean => {
          for (; el && el !== root; el = el.parentElement) {
            const s = getComputedStyle(el)
            if (/auto|scroll/.test(s.overflowX) || s.position === 'absolute' || s.position === 'fixed') return true
          }
          return false
        }
        const spill: string[] = []
        for (const el of root.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (!r.width || scrolls(el)) continue
          if (r.right > box.right - pad + 1 || r.left < box.left + pad - 1) spill.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(r.left)}–${Math.round(r.right)})`)
        }
        // Text cut off by its own box (a clipped label, a heading too big for its pill).
        const cut: string[] = []
        for (const el of root.querySelectorAll<HTMLElement>('[data-mx-field]')) {
          const s = getComputedStyle(el)
          if ((s.overflow !== 'visible' || s.textOverflow === 'ellipsis') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
            cut.push(el.dataset.mxField!)
        }
        return { page: document.documentElement.scrollWidth - window.innerWidth, spill: [...new Set(spill)].slice(0, 4), cut: cut.slice(0, 4) }
      })
      const notes = [
        missed ? `nothing matches --click ${click}` : '',
        overflow > 0 ? `${overflow}px horizontal overflow` : '',
        spill.length ? `past the gutter: ${spill.join(', ')}` : '',
        cut.length ? `text cut off: ${cut.join(', ')}` : '',
      ].filter(Boolean)
      console.log(`${file}${notes.length ? `  ⚠ ${notes.join('; ')}` : ''}`)
      await tab.close()
    }
  }
}
await browser.close()
