// Re-run the pure half of capture on snapshots saved by capture-url.ts, offline, and
// redraw the side-by-side comparisons: the loop for improving capture fidelity.
//   npx vite-node extension/scripts/recapture.ts [name filter…]
// Reads .out/inspo/snaps/*.json, writes .out/inspo/clips/, compare/<name>.b.png and <name>.pair.jpg.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SectionType } from '@/core/types'
import { captureClip } from '../src/capture'
import { previewDoc } from '../src/capture/preview'
import type { Snapshot } from '../src/capture/types'
import { launchBrowser } from './fixtures'

const out = join(process.cwd(), '.out/inspo')
const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const names = readdirSync(join(out, 'snaps'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((n) => !filters.length || filters.some((f) => n.includes(f)))

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome found')
const cmp = join(out, 'compare')
mkdirSync(cmp, { recursive: true })
for (const name of names) {
  const { type, variant, snap } = JSON.parse(readFileSync(join(out, 'snaps', `${name}.json`), 'utf8')) as { type: SectionType; variant?: string; snap: Snapshot }
  const res = captureClip(snap, { type, variant })
  for (const [path, text] of Object.entries(res.files)) {
    const full = join(out, 'clips', path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  const view = await browser.newPage({ viewport: { width: snap.viewport.width, height: 900 } })
  await view.setContent(previewDoc(res, { motion: false }), { waitUntil: 'networkidle' }).catch(() => {})
  await view.waitForTimeout(500)
  await view.screenshot({ path: join(cmp, `${name}.b.png`), fullPage: true })
  await view.close()
  const a = join(cmp, `${name}.a.png`)
  if (existsSync(a)) execFileSync('magick', ['(', a, '-resize', '720x', ')', '(', join(cmp, `${name}.b.png`), '-resize', '720x', ')', '-background', '#ccc', '-splice', '8x0', '-gravity', 'north', '+append', '-crop', '1448x1800+0+0', '+repage', join(cmp, `${name}.pair.jpg`)])
  const errs = res.issues.filter((x) => x.level === 'error')
  console.log(`${name}  ${errs.length ? `✗ ${errs.map((e) => e.message).join('; ')}` : '✓'}`)
}
await browser.close()
