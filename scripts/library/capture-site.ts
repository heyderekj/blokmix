// The site-library engine: turn a live website into a bundle Blokmix can match against its built-in layouts.
//   npx vite-node scripts/library/capture-site.ts <url> [--out .out/library] [--pages /,/about] [--industry saas]
//   npx vite-node scripts/library/capture-site.ts --seed firstRun        (or --seed <industry id> from samples/library/seed.json)
// Per page: robots.txt check, load at 1440 and settle (lazy content, fonts, consent banner), split into sections,
// type each, screenshot (full page at 1440 and 390, a crop per section, a thumbnail), snapshot + captureClip each
// section (with the cross-origin stylesheets the extension would fetch), its structural signature and the closest
// built-in layouts. Then one style guide for the site (extension/src/capture/siteTokens.ts).
// Writes .out/library/<slug>/site.json (everything, for matching and drafting), upload.json (the shape
// POST /api/library/sites takes) and the WebP images both name.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import type { BlockInfo, FontSource, Rhythm, SectionType, Source } from '@/core/types'
import { indexBlocks } from '@/core/blocks'
import { parseHtml } from '@/core/html/parse'
import { matchLayouts, signatureOf, MATCH_THRESHOLD, type LayoutMatch, type Signature } from '@/core/match'
import { library } from '@/data/library'
import { captureClip, sourceIdFor } from '../../extension/src/capture'
import { lightness, parseColor } from '../../extension/src/capture/color'
import { siteTokens, type SectionStyle, type SiteFacts } from '../../extension/src/capture/siteTokens'
import { blockedSheetHrefs, snapshotSection } from '../../extension/src/snapshot'
import { dismissConsent, dismissPopups, findSections, guessSectionType, pageFacts, type FoundSection, type TypeGuess } from '../../extension/src/sections'
import { launchBrowser } from '../../extension/scripts/fixtures'
import { fetchRobots } from './robots'
import { uploadShape } from './upload-shape'

// ---- the bundle ----

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface BundleSection {
  n: number
  type: SectionType
  confidence: number
  reason: string
  review?: boolean
  box: Box
  screenshot: string
  /** Sits on a dark ground (from the captured clip's own background). */
  dark?: boolean
  clip?: { type: SectionType; rhythm: Rhythm; html: string; css: string; blocks: BlockInfo[] }
  signature?: Signature
  matches: LayoutMatch[]
  status: 'matched' | 'needs-layout'
  error?: string
}

export interface BundlePage {
  path: string
  title: string
  size: { w: number; h: number }
  screenshots: { full1440: string; full390?: string; thumb?: string }
  consent?: string
  sections: BundleSection[]
}

export interface SiteBundle {
  slug: string
  name: string
  url: string
  industry?: string
  capturedAt: string
  source: Source
  fonts: FontSource[]
  personality: string
  vars: Record<string, string>
  notes: string[]
  skipped: { path: string; why: string }[]
  pages: BundlePage[]
}

// ---- arguments ----

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const valued = new Set(['--out', '--pages', '--seed', '--industry'])
const positional = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]))
const WEBP_MAX = 16_000
const outRoot = join(process.cwd(), opt('--out') ?? '.out/library')
const pagesArg = (opt('--pages') ?? '/').split(',').map((p) => p.trim()).filter(Boolean)
const tall = args.includes('--tall')
// --debug also writes <page>-debug.webp: the page at quarter size with each section's box and type drawn on it.
const debug = args.includes('--debug')

const targets: { url: string; industry?: string }[] = positional.map((url) => ({ url, industry: opt('--industry') }))
const seed = opt('--seed')
if (seed) {
  const data = JSON.parse(readFileSync(join(process.cwd(), 'samples/library/seed.json'), 'utf8')) as {
    industries: { id: string; sites: { url: string }[] }[]
    firstRun?: string[]
  }
  const industryOf = (url: string) => data.industries.find((i) => i.sites.some((s) => s.url === url))?.id
  if (seed === 'firstRun') for (const url of data.firstRun ?? []) targets.push({ url, industry: industryOf(url) })
  else {
    const ind = data.industries.find((i) => i.id === seed)
    if (!ind) throw new Error(`No industry "${seed}" in seed.json (have: ${data.industries.map((i) => i.id).join(', ')}, firstRun)`)
    for (const s of ind.sites) targets.push({ url: s.url, industry: ind.id })
  }
}
if (!targets.length) throw new Error('Usage: capture-site.ts <url> [--pages /,/about] [--out .out/library] | --seed <industry|firstRun>')

const browser = await launchBrowser()
if (!browser) throw new Error('No Chrome found for playwright-core')
let failures = 0
for (const t of targets) {
  try {
    await captureSite(browser, t.url, t.industry)
  } catch (err) {
    failures++
    console.error(`✗ ${t.url}: ${(err as Error).message}`)
  }
}
await browser.close()
process.exitCode = failures ? 1 : 0

// ---- one site ----

async function captureSite(browser: Browser, url: string, industry?: string) {
  const origin = new URL(url).origin
  const slug = sourceIdFor(url)
  const dir = join(outRoot, slug)
  mkdirSync(dir, { recursive: true })
  console.log(`\n${slug}  ${origin}`)
  const { robots, found } = await fetchRobots(origin)
  if (!found) console.log('  (no robots.txt)')
  const skipped: SiteBundle['skipped'] = []
  const pages: BundlePage[] = []
  const styles: SectionStyle[] = []
  let facts: SiteFacts | null = null
  let siteName = ''

  const ua = (await browser.newBrowserCDPSession().then((s) => s.send('Browser.getVersion')).catch(() => null))?.userAgent?.replace('HeadlessChrome', 'Chrome')
  for (const path of pagesArg) {
    if (!robots.allowed(path)) {
      console.log(`  skip ${path}: disallowed by robots.txt`)
      skipped.push({ path, why: 'robots.txt' })
      continue
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: tall ? 7000 : 900 }, userAgent: ua, locale: 'en-US' })
    try {
      const res = await capturePage(ctx, new URL(path, origin).href, path, dir, pages.length === 0 ? path : path, styles)
      pages.push(res.page)
      facts ??= res.facts
      siteName ||= res.siteName
    } catch (err) {
      console.log(`  ✗ ${path}: ${(err as Error).message}`)
      skipped.push({ path, why: (err as Error).message })
    } finally {
      await ctx.close()
    }
    // The phone pass, a fresh context so nothing from the desktop pass carries over.
    if (pages.at(-1)?.path === path) {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-US' })
      try {
        const p = await phone.newPage()
        await load(p, new URL(path, origin).href)
        const file = `${pageSlug(path)}-390.webp`
        await shoot(p, join(dir, file), { full: true })
        pages.at(-1)!.screenshots.full390 = file
      } catch (err) {
        console.log(`  (390 pass failed for ${path}: ${(err as Error).message})`)
      } finally {
        await phone.close()
      }
    }
  }
  if (!pages.length) throw new Error('no pages captured')

  const name = siteName || slug.charAt(0).toUpperCase() + slug.slice(1)
  const merged = siteTokens({ id: slug, name, url: origin + '/', sections: styles, facts: facts ?? { bodyBg: '', bodyColor: '' } })
  const bundle: SiteBundle = {
    slug,
    name,
    url: origin + '/',
    ...(industry ? { industry } : {}),
    capturedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    source: merged.source,
    fonts: merged.fonts,
    personality: merged.personality,
    vars: merged.vars,
    notes: merged.notes,
    skipped,
    pages,
  }
  writeFileSync(join(dir, 'site.json'), JSON.stringify(bundle, null, 2) + '\n')
  writeFileSync(join(dir, 'upload.json'), JSON.stringify(uploadShape(bundle), null, 2) + '\n')
  const all = pages.flatMap((p) => p.sections)
  const matched = all.filter((s) => s.status === 'matched').length
  console.log(`  ${all.length} sections, ${matched} matched (${Math.round((matched / Math.max(1, all.length)) * 100)}%) → ${join(dir, 'site.json')}`)
}

// ---- one page ----

async function capturePage(ctx: BrowserContext, href: string, path: string, dir: string, _label: string, styles: SectionStyle[]) {
  const page = await ctx.newPage()
  const consent = await load(page, href)
  const ps = pageSlug(path)
  const home = path === '/' || path === ''

  const facts = (await page.evaluate(`(${pageFacts.toString()})()`)) as SiteFacts & { fontLinks: string[] }
  const found = (await page.evaluate(`(${findSections.toString()})()`)) as FoundSection[]
  const firstContent = found.findIndex((f) => !f.fixed && !(f.n === 0 && f.box.h < 200))
  const guesses = (await page.evaluate(
    ([src, n, first, isHome]) => {
      const fn = (0, eval)(`(${src})`) as typeof guessSectionType
      const out: TypeGuess[] = []
      for (let i = 0; i < n; i++) {
        const el = document.querySelector(`[data-mx-lib="${i}"]`)
        out.push(el ? fn(el, { index: i, count: n, home: isHome, firstContent: first }) : { type: 'content', confidence: 0, reason: 'lost' })
      }
      return out
    },
    [guessSectionType.toString(), found.length, Math.max(0, firstContent), home] as const,
  )) as TypeGuess[]
  const info = await page.evaluate(() => ({
    title: document.title,
    siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '',
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }))

  // Screenshots before anything scrolls again.
  const full1440 = `${ps}-1440.webp`
  await shoot(page, join(dir, full1440), { full: true })
  const thumb = home || !existsSync(join(dir, 'thumb.webp')) ? 'thumb.webp' : undefined
  if (thumb) await shoot(page, join(dir, thumb), { clip: { x: 0, y: 0, w: 1440, h: 900 }, scale: 1 / 3 })
  for (const f of found) {
    const b = clampBox(f.box, info.h)
    if (b.h > 0) await shoot(page, join(dir, `${ps}-s${f.n}.webp`), { clip: b }).catch(() => {})
  }

  if (debug) {
    await page.evaluate(
      ([boxes, types]) => {
        const layer = document.createElement('div')
        layer.id = '__mx_debug'
        layer.style.cssText = 'position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2147483647'
        boxes.forEach((b, i) => {
          const d = document.createElement('div')
          d.style.cssText = `position:absolute;left:${b.x + 4}px;top:${b.y + 4}px;width:${b.w - 8}px;height:${b.h - 8}px;outline:6px solid hsl(${(i * 67) % 360} 90% 50%);font:700 48px/1 system-ui;color:#fff;`
          const l = document.createElement('span')
          l.textContent = `${i} ${types[i]}`
          l.style.cssText = `background:hsl(${(i * 67) % 360} 90% 40%);padding:6px 12px`
          d.appendChild(l)
          layer.appendChild(d)
        })
        document.body.appendChild(layer)
      },
      [found.map((f) => f.box), guesses.map((g) => g.type)] as const,
    )
    const h = Math.min(info.h, WEBP_MAX)
    await shoot(page, join(dir, `${ps}-debug.webp`), { clip: { x: 0, y: 0, w: 1440, h }, scale: 0.25 })
    await page.evaluate(() => document.getElementById('__mx_debug')?.remove())
  }

  // Stylesheets the page can't read from script, fetched the way the extension's background does.
  const blocked = (await page.evaluate(`(${blockedSheetHrefs.toString()})(document)`)) as string[]
  const sheetTexts: string[] = []
  for (const h of blocked.slice(0, 30)) {
    const r = await ctx.request.get(h, { timeout: 15_000 }).catch(() => null)
    if (r?.ok()) sheetTexts.push(await r.text())
  }
  await page.evaluate((texts) => ((window as unknown as { __mxSheets: string[] }).__mxSheets = texts), sheetTexts)

  const nav = found.find((f) => f.fixed)
  const sections: BundleSection[] = []
  for (const f of found) {
    const g = guesses[f.n]
    const s: BundleSection = {
      n: f.n,
      type: g.type,
      confidence: Math.round(g.confidence * 100) / 100,
      reason: g.reason,
      ...(g.confidence < 0.5 ? { review: true } : {}),
      box: f.box,
      screenshot: `${ps}-s${f.n}.webp`,
      matches: [],
      status: 'needs-layout',
    }
    try {
      await page.evaluate(
        ([n, hideNav, sel]) => {
          // Frameworks that re-render on scroll can swap the node out; find it again by its path.
          let el = document.querySelector(`[data-mx-lib="${n}"]`)
          if (!el) {
            el = document.querySelector(sel)
            el?.setAttribute('data-mx-lib', String(n))
          }
          el?.scrollIntoView({ block: 'start' })
          // A fixed nav drawn over this section isn't part of it.
          const navEl = hideNav === null ? null : (document.querySelector(`[data-mx-lib="${hideNav}"]`) as HTMLElement | null)
          if (navEl) navEl.style.visibility = Number(n) === hideNav ? '' : 'hidden'
        },
        [f.n, nav ? nav.n : null, f.selector] as const,
      )
      await page.waitForTimeout(450)
      const snap = await page.evaluate(
        ([src, n]) => {
          const fn = (0, eval)(`(${src})`) as typeof snapshotSection
          const el = document.querySelector(`[data-mx-lib="${n}"]`)
          if (!el) throw new Error('section left the page')
          return fn(el, { sheetTexts: (window as unknown as { __mxSheets: string[] }).__mxSheets })
        },
        [snapshotSection.toString(), f.n] as const,
      )
      const res = captureClip(snap, { type: g.type, sourceId: sourceIdFor(href) })
      const blocks = indexBlocks(parseHtml(res.html), g.type)
      const clip = { type: g.type, rhythm: res.meta.rhythm, html: res.html, css: res.css, blocks }
      const signature = signatureOf(clip)
      const matches = matchLayouts(signature, library, { limit: 3 })
      s.clip = clip
      s.signature = signature
      s.matches = matches
      s.status = matches[0] && matches[0].score >= MATCH_THRESHOLD ? 'matched' : 'needs-layout'
      const bg = parseColor(res.source.tokens['color.bg'])
      if (bg && lightness(bg) < 0.5) s.dark = true
      styles.push({ type: g.type, area: f.box.w * f.box.h, tokens: res.source.tokens, fonts: res.source.fonts })
    } catch (err) {
      s.error = (err as Error).message.split('\n')[0].slice(0, 300)
    }
    sections.push(s)
    const m = s.matches[0]
    console.log(
      `  ${ps} #${String(f.n).padStart(2)} ${s.type.padEnd(12)} ${s.confidence.toFixed(2)}${s.review ? '?' : ' '} y=${String(f.box.y).padStart(5)} h=${String(f.box.h).padStart(5)}  ${
        s.error ? `✗ ${s.error}` : m ? `${s.status === 'matched' ? '✓' : '·'} ${m.layoutId} ${m.score.toFixed(2)}${m.misses.length ? ` (${m.misses.join(', ')})` : ''}` : '· no layouts of this type'
      }`,
    )
  }
  await page.close()
  return {
    page: {
      path,
      title: info.title,
      size: { w: info.w, h: info.h },
      screenshots: { full1440, ...(thumb ? { thumb } : {}) },
      ...(consent ? { consent } : {}),
      sections,
    } satisfies BundlePage,
    facts,
    siteName: info.siteName,
  }
}

// ---- loading and settling ----

/** Load, dismiss a consent banner, scroll through for lazy content, wait for the network and fonts, come back up. */
async function load(page: Page, href: string): Promise<string | null> {
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(800)
  const consentSrc = `(${dismissConsent.toString()})()`
  let consent = (await page.evaluate(consentSrc).catch(() => null)) as string | null
  if (consent) {
    // Some banners reload the page once a choice is made: let that land before reading anything.
    await page.waitForTimeout(1500)
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  }
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8
    for (let y = 0; y < document.documentElement.scrollHeight && y < 40_000; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 220))
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((r) => setTimeout(r, 400))
  })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {})
  consent ??= (await page.evaluate(consentSrc).catch(() => null)) as string | null
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1200)
  // Pop-ups (a newsletter modal, a bar along the bottom): Escape, click their close controls, hide what's left.
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)
  const popups = (await page.evaluate(`(${dismissPopups.toString()})(false)`).catch(() => [])) as string[]
  if (popups.length) await page.waitForTimeout(700)
  popups.push(...((await page.evaluate(`(${dismissPopups.toString()})(true)`).catch(() => [])) as string[]))
  if (popups.length) await page.evaluate(() => window.scrollTo(0, 0))
  if (consent) console.log(`  consent: clicked “${consent}”`)
  if (popups.length) console.log(`  pop-ups: ${popups.join('; ')}`)
  return consent
}

// ---- screenshots (CDP, so WebP and a scaled thumbnail) ----



async function shoot(page: Page, file: string, o: { full?: boolean; clip?: Box; scale?: number }) {
  const cdp = await page.context().newCDPSession(page)
  try {
    let clip = o.clip
    if (o.full) {
      const { w, h } = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }))
      clip = { x: 0, y: 0, w, h: Math.min(h, WEBP_MAX) }
    }
    if (!clip) throw new Error('nothing to shoot')
    const h = Math.min(clip.h, WEBP_MAX)
    const { data } = (await cdp.send('Page.captureScreenshot', {
      format: 'webp',
      quality: 78,
      captureBeyondViewport: true,
      clip: { x: clip.x, y: clip.y, width: clip.w, height: h, scale: o.scale ?? 1 },
    })) as { data: string }
    writeFileSync(file, Buffer.from(data, 'base64'))
  } finally {
    await cdp.detach().catch(() => {})
  }
}

function clampBox(b: Box, pageH: number): Box {
  const x = Math.max(0, b.x)
  const y = Math.max(0, b.y)
  return { x, y, w: Math.min(b.w, 1440 - x), h: Math.max(0, Math.min(b.h, pageH - y)) }
}

function pageSlug(path: string): string {
  const s = path.replace(/^\/+|\/+$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return s || 'home'
}
