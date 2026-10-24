// Capture every fixture section and write the clips to .out/captures/ (or into
// the repo's samples/ with --samples), printing lint issues and capture notes.
//   npx vite-node extension/scripts/capture-fixtures.ts [--samples] [filter]

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { captureClip } from '../src/capture'
import { previewDoc } from '../src/capture/preview'
import { FIXTURE_PAGES, launchBrowser, snapshotFixture } from './fixtures'

const args = process.argv.slice(2)
const toSamples = args.includes('--samples')
const shots = args.includes('--shots') ? join(process.cwd(), '.out/captures/shots') : undefined
if (shots) mkdirSync(shots, { recursive: true })
const filter = args.find((a) => !a.startsWith('--'))
const outDir = toSamples ? process.cwd() : join(process.cwd(), '.out/captures')

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome found: install Google Chrome or run `npx playwright-core install chromium`')
let errors = 0
const written = new Set<string>()
for (const fx of FIXTURE_PAGES) {
  if (filter && !fx.file.includes(filter)) continue
  const snaps = await snapshotFixture(browser, fx, undefined, shots)
  for (const s of fx.sections) {
    const res = captureClip(snaps.get(s.selector)!, { type: s.type })
    for (const [path, text] of Object.entries(res.files)) {
      const full = join(outDir, path)
      // A site's first capture sets its source; later ones keep their own tokens in clip.json.
      if (path.startsWith('samples/sources/') && (written.has(path) || (toSamples && existsSync(full)))) continue
      written.add(path)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, text)
    }
    if (!toSamples) writeFileSync(join(outDir, `${res.type}.${res.folder}.snapshot.json`), JSON.stringify(snaps.get(s.selector), null, 1))
    if (shots) {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        await page.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.fulfill({ status: 404, body: '' })))
        await page.setContent(previewDoc(res, { motion: false, fonts: false }))
        await page.locator('body > *').first().screenshot({ path: join(shots, `${res.type}.${res.sourceId}.clip-${width}.png`) })
        await page.close()
      }
    }
    const errs = res.issues.filter((i) => i.level === 'error')
    errors += errs.length
    console.log(`\n${res.type}.${res.folder}  ${errs.length ? `✗ ${errs.length} error(s)` : '✓ lint clean'}`)
    for (const i of res.issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} [rule ${i.rule ?? '?'}] ${i.message}`)
    for (const n of res.notes) console.log(`  · ${n}`)
  }
}
await browser.close()
console.log(`\nWrote to ${outDir}`)
process.exit(errors ? 1 : 0)
