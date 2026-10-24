// Render a saved mix (and each of its versions) as full-page screenshots, the way the
// reference build draws it, to review variations side by side.
//   npx vite-node scripts/render-mix.ts <mix id> [--clips .out/inspo/clips/samples] [--width 1440]
// Reads the mix from the local database (php artisan tinker), writes .out/renders/<mix>/*.png.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { GuideState, MixSnapshot, ProjectContent, Site, Source } from '../resources/js/core/types'
import { allSlots, mapSlots } from '../resources/js/core/site'
import { extendLibrary, rawClipsFromFiles } from '../resources/js/core/library'
import { composeSite } from '../resources/js/core/compose'
import { resolveGuide } from '../resources/js/core/guide'
import { referenceHtml } from '../resources/js/core/export/reference-html'
import { library } from '../resources/js/data/library'
import { siteState } from '../resources/js/state/store'
import { launchBrowser } from '../extension/scripts/fixtures'

const args = process.argv.slice(2)
const mixId = args.find((a) => !a.startsWith('--'))
if (!mixId) throw new Error('Usage: render-mix.ts <mix id>')
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const clipsDir = opt('--clips', '.out/inspo/clips/samples')
const width = Number(opt('--width', '1440'))
const out = join('.out/renders', mixId)
mkdirSync(out, { recursive: true })

// Captured clips (not in samples/) join the library, as an account's clips do in the app.
const files: Record<string, string> = {}
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else files['samples/' + p.slice(clipsDir.length + 1)] = readFileSync(p, 'utf8')
  }
}
try {
  walk(clipsDir)
} catch {
  /* no captures */
}
const sources = Object.entries(files)
  .filter(([p]) => p.startsWith('samples/sources/'))
  .map(([, t]) => JSON.parse(t) as Source)
extendLibrary(library, sources, rawClipsFromFiles(files))

const json = execFileSync('php', ['artisan', 'tinker', `--execute=echo json_encode(App\\Models\\Mix::with('versions')->find('${mixId.replace(/[^\w]/g, '')}')->toBoard());`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const mix = JSON.parse(json.slice(json.indexOf('{'))) as { name: string; data: { site: Site; guide: GuideState; content: ProjectContent }; versions: Record<string, { letter: string; title: string; snapshot: MixSnapshot }> }
const live = siteState({ ...mix.data }) as unknown as { site: Site; guide: GuideState; content: ProjectContent }

const shots: { name: string; site: Site; guide: GuideState; content: ProjectContent }[] = [{ name: 'working', ...live }]
for (const v of Object.values(mix.versions)) {
  const s = siteState({ ...v.snapshot }) as unknown as MixSnapshot
  shots.push({ name: `${v.letter}-${v.title.replace(/[^\w]+/g, '-').slice(0, 40)}`, site: s.site, guide: s.guide, content: s.content })
}

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome found')
for (const s of shots) {
  const site = mapSlots(s.site, (slot) => (library.clips[slot.clipId] ? slot : null))
  const missing = allSlots(s.site).filter((slot) => !library.clips[slot.clipId]).map((slot) => slot.clipId)
  const page = composeSite({ site, guide: resolveGuide(s.guide), content: s.content, library, title: mix.name, page: s.guide })
  for (const p of site.pages) {
    const html = referenceHtml(page, { pageId: p.id })
    const tab = await browser.newPage({ viewport: { width, height: 900 } })
    await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => {})
    await tab.waitForTimeout(800)
    const file = join(out, `${s.name}${site.pages.length > 1 ? `.${p.path.replace(/\W+/g, '') || 'home'}` : ''}.png`)
    await tab.screenshot({ path: file, fullPage: true })
    await tab.close()
    console.log(`${file}${missing.length ? `  (missing clips: ${missing.join(', ')})` : ''}`)
  }
}
await browser.close()
