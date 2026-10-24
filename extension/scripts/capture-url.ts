// Capture sections of a live site the way the extension does, from the command line.
//   npx vite-node extension/scripts/capture-url.ts --list <url>
//     screenshots each top-level section to .out/inspo/<host>/ and prints selectors to pick from
//   npx vite-node extension/scripts/capture-url.ts <url> "<selector>=<type>[:<variant>]" […]
//     captures those sections into .out/inspo/clips/ (repo layout) plus one .zip each for the Crate

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import type { Page } from 'playwright-core'
import type { SectionType } from '@/core/types'
import { SECTION_TYPES } from '@/core/types'
import { captureClip } from '../src/capture'
import { previewDoc } from '../src/capture/preview'
import { snapshotSection } from '../src/snapshot'
import { launchBrowser } from './fixtures'

const args = process.argv.slice(2)
const list = args.includes('--list')
const [url, ...picks] = args.filter((a) => !a.startsWith('--'))
if (!url) throw new Error('Usage: capture-url.ts [--list] <url> ["<selector>=<type>" …]')
const host = new URL(url).host.replace(/^www\./, '')
const out = join(process.cwd(), '.out/inspo')

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome found')
// Some sites scroll inside their own container; --tall gives them a window as tall as the page instead.
const tall = args.includes('--tall')
const page = await browser.newPage({ viewport: { width: 1440, height: tall ? 7000 : 900 } })
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 60_000 }))
await settle(page)

if (list) {
  const dir = join(out, host)
  mkdirSync(dir, { recursive: true })
  const found = await page.evaluate(() => {
    // Top-level blocks: the children of <main> (or <body>) that look like sections, plus header/footer.
    const root = document.querySelector('main') ?? document.body
    const pick = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.height >= 80 && r.width >= 600
    }
    let blocks = [...root.children].filter(pick)
    // Wrappers: look inside anything much taller than a section, until the pieces are section-sized.
    for (let round = 0; round < 8; round++) {
      const next = blocks.flatMap((b) => {
        const kids = [...b.children].filter(pick)
        return b.getBoundingClientRect().height > 1500 && kids.length ? kids : [b]
      })
      if (next.length === blocks.length && next.every((b, i) => b === blocks[i])) break
      blocks = next
    }
    const extra = [...document.querySelectorAll('body header, body nav, body footer')].filter((e) => pick(e) && !blocks.some((b) => b.contains(e) || e.contains(b)))
    const all = [...extra.filter((e) => e.tagName !== 'FOOTER'), ...blocks, ...extra.filter((e) => e.tagName === 'FOOTER')]
    const path = (el: Element): string => {
      if (el.id) return `#${CSS.escape(el.id)}`
      const parent = el.parentElement
      if (!parent || el === document.body) return 'body'
      const i = [...parent.children].indexOf(el) + 1
      return `${path(parent)} > ${el.tagName.toLowerCase()}:nth-child(${i})`
    }
    return all.map((el, n) => {
      el.setAttribute('data-inspo', String(n))
      const r = el.getBoundingClientRect()
      return { n, selector: path(el), tag: el.tagName.toLowerCase(), h: Math.round(r.height), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) }
    })
  })
  for (const f of found) {
    await page
      .locator(`[data-inspo="${f.n}"]`)
      .screenshot({ path: join(dir, `${String(f.n).padStart(2, '0')}.png`), animations: 'disabled', timeout: 15_000 })
      .catch(() => {})
    console.log(`${String(f.n).padStart(2, '0')}  ${f.tag.padEnd(7)} ${String(f.h).padStart(5)}px  ${f.selector}\n      ${f.text}`)
  }
  await page.screenshot({ path: join(dir, 'full.png'), fullPage: true }).catch(() => {})
  console.log(`\nScreenshots in ${dir}`)
} else {
  let errors = 0
  for (const p of picks) {
    const i = p.lastIndexOf('=')
    const selector = p.slice(0, i)
    // "<selector>=<type>" or "<selector>=<type>:<variant>" (the folder's second half, when a site has two of a kind).
    const [type, variant] = p.slice(i + 1).split(':') as [SectionType, string | undefined]
    if (!SECTION_TYPES.includes(type)) throw new Error(`Unknown type "${type}"`)
    // In view first, so scroll reveals run, as they have when someone picks a section on the page.
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), selector)
    await page.waitForTimeout(1500)
    const snap = await page.evaluate(
      ([src, sel]) => {
        const fn = (0, eval)(`(${src})`) as typeof snapshotSection
        const el = document.querySelector(sel)
        if (!el) throw new Error(`No element for ${sel}`)
        return fn(el, {})
      },
      [snapshotSection.toString(), selector] as const,
    )
    const res = captureClip(snap, { type, variant })
    // The raw snapshot, so the pure half can be re-run offline (extension/scripts/recapture.ts).
    mkdirSync(join(out, 'snaps'), { recursive: true })
    writeFileSync(join(out, 'snaps', `${res.type}.${res.folder}.json`), JSON.stringify({ type, variant, snap }))
    // The original section and the clip as a frame draws it, side by side, to see what capture lost.
    const cmp = join(out, 'compare')
    mkdirSync(cmp, { recursive: true })
    const name = `${res.type}.${res.folder}`
    await page.locator(selector).first().screenshot({ path: join(cmp, `${name}.a.png`), animations: 'disabled', timeout: 15_000 }).catch(() => {})
    const view = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await view.setContent(previewDoc(res, { motion: false }), { waitUntil: 'networkidle' }).catch(() => {})
    await view.waitForTimeout(600)
    await view.screenshot({ path: join(cmp, `${name}.b.png`), fullPage: true })
    await view.close()
    const zip: Record<string, Uint8Array> = {}
    for (const [path, text] of Object.entries(res.files)) {
      const full = join(out, 'clips', path)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, text)
      zip[path] = strToU8(text)
    }
    mkdirSync(join(out, 'zips'), { recursive: true })
    writeFileSync(join(out, 'zips', `${res.type}.${res.folder}.zip`), zipSync(zip))
    const errs = res.issues.filter((x) => x.level === 'error')
    errors += errs.length
    console.log(`\n${res.type}.${res.folder}  ${errs.length ? `✗ ${errs.length} error(s)` : '✓ lint clean'}`)
    for (const x of res.issues) console.log(`  ${x.level === 'error' ? 'ERROR' : 'warn '} [rule ${x.rule ?? '?'}] ${x.message}`)
    for (const n of res.notes.slice(0, 6)) console.log(`  · ${n}`)
  }
  process.exitCode = errors ? 1 : 0
}
await browser.close()

/** Scroll through the page so lazy sections render and entrance animations run, then come back up. */
async function settle(p: Page) {
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.8
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 250))
    }
    window.scrollTo(0, 0)
  })
  await p.waitForTimeout(1200)
}
