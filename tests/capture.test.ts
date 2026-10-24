import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import type { Source } from '@/core/types'
import { FIELD_SCHEMA } from '@/core/content'
import { buildLibrary, rawClipsFromFiles } from '@/core/library'
import { parseHtml } from '@/core/html/parse'
import { captureClip, sourceIdFor, type CaptureResult } from '../extension/src/capture'
import { ColorMapper, parseColor, type Palette } from '../extension/src/capture/color'
import { nameIcon, iconNameFor } from '../extension/src/capture/icons'
import { ratioOf, typographic } from '../extension/src/capture/structure'
import { FIXTURE_PAGES, launchBrowser } from '../extension/scripts/fixtures'
import { snapshotFixture } from '../extension/scripts/fixtures'

describe('capture: pure helpers', () => {
  const hex = (h: string) => parseColor(h)!
  const palette: Palette = {
    bg: hex('#ffffff'),
    surface: hex('#f4f4f5'),
    text: hex('#18181b'),
    muted: hex('#71717a'),
    border: hex('#e4e4e7'),
    primary: hex('#5b4bff'),
    'on-primary': hex('#ffffff'),
    accent: hex('#f59e0b'),
  }

  it('writes colors as tokens, mixes and alphas', () => {
    const m = new ColorMapper(palette)
    expect(m.map('rgba(91, 75, 255, 1)')).toBe('var(--mx-color-primary)')
    expect(m.map('rgba(91, 75, 255, 0.12)')).toBe('color-mix(in oklab, var(--mx-color-primary) 12%, transparent)')
    expect(m.map('rgba(0, 0, 0, 0)')).toBe('transparent')
    expect(m.map('rgba(24, 24, 27, 1)')).toBe('var(--mx-color-text)')
    expect(m.map('rgba(150, 140, 255, 1)')).toMatch(/^color-mix\(in oklab, var\(--mx-color-[\w-]+\) \d+%, var\(--mx-color-[\w-]+\)\)$/)
    expect(m.mapIn('linear-gradient(rgba(255, 255, 255, 1), rgba(91, 75, 255, 1))')).toBe('linear-gradient(var(--mx-color-bg), var(--mx-color-primary))')
  })

  it('names sources from hostnames without hyphens', () => {
    expect(sourceIdFor('https://www.acme.example/pricing')).toBe('acme')
    expect(sourceIdFor('https://app.linear.app/')).toBe('linear')
    expect(sourceIdFor('https://shop.acme-tools.co.uk/')).toBe('acmetools')
    expect(sourceIdFor('https://layout.dev/')).toBe('layoutsite')
  })

  it('names icons by drawing and by hints', () => {
    const svg = parseHtml('<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>')[0]
    expect(svg.t === 'el' && nameIcon(svg, [])?.name).toBe('arrow-right')
    const blank = parseHtml('<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>')[0]
    expect(blank.t === 'el' && nameIcon(blank, ['icon icon-magnifying-glass'])?.name).toBe('search')
    expect(iconNameFor('lucide-x')).toBe('x')
    expect(iconNameFor('heroicon-outline-envelope')).toBe('mail')
  })

  it('tidies ratios and quotes', () => {
    expect(ratioOf(1600, 900)).toBe('16/9')
    expect(ratioOf(400, 400)).toBe('1/1')
    expect(typographic(`"It's fine," she said`)).toBe('“It’s fine,” she said')
  })
})

// ---------- fixtures, captured in a real browser ----------

const browser = await launchBrowser()
const results = new Map<string, CaptureResult>()

describe.skipIf(!browser)('capture: saved fixtures', () => {
  beforeAll(async () => {
    for (const fx of FIXTURE_PAGES) {
      const snaps = await snapshotFixture(browser!, fx)
      for (const s of fx.sections) results.set(`${s.type}.${fx.host.split('.')[0]}`, captureClip(snaps.get(s.selector)!, { type: s.type }))
    }
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
  })

  const all = FIXTURE_PAGES.flatMap((fx) => fx.sections.map((s) => `${s.type}.${fx.host.split('.')[0]}`))
  const get = (id: string) => results.get(id)!
  const fields = (r: CaptureResult) => [...r.html.matchAll(/data-mx-field="([^"]+)"/g)].map((m) => m[1])

  it.each(all)('%s lints clean', (id) => {
    const r = get(id)
    expect(r.issues.filter((i) => i.level === 'error').map((i) => i.message)).toEqual([])
    expect(r.issues.filter((i) => i.level === 'warn').map((i) => i.message)).toEqual([])
  })

  it.each(all)('%s uses only schema fields, once each', (id) => {
    const r = get(id)
    const fs = fields(r)
    expect(fs.length).toBeGreaterThan(0)
    for (const f of fs) expect(FIELD_SCHEMA[r.type]).toContain(f)
    expect(new Set(fs).size).toBe(fs.length)
  })

  it.each(all)('%s loads into the library like a hand-written clip', (id) => {
    const r = get(id)
    const sources = readdirSync('samples/sources').map((f) => JSON.parse(readFileSync(`samples/sources/${f}`, 'utf8')) as Source)
    const lib = buildLibrary([...sources, r.source], rawClipsFromFiles(r.files))
    const clipId = `${r.type}.${r.folder}`
    expect(lib.clips[clipId]?.origin).toBe('clip')
    expect(lib.byType[r.type]).toContain(clipId)
    expect(lib.warnings.filter((w) => w.clipId === clipId)).toEqual([])
    expect(Object.keys(lib.clips[clipId].fields).length).toBeGreaterThan(0)
  })

  it('infers the site’s tokens', () => {
    const t = get('features.lumen').meta.tokens
    expect(t['color.primary']).toBe('#5b4bff')
    expect(t['color.bg']).toBe('#ffffff')
    expect(t['radius.base']).toBe('12px')
    expect(t['font.display']).toMatch(/^'Inter'/)
    expect(t['icon.set']).toBe('lucide:regular')
    const dark = get('testimonials.orbit').meta.tokens
    expect(dark['color.bg']).toBe('#0b0d12')
    const serif = get('content.folio')
    expect(serif.meta.tokens['font.display']).toMatch(/^'Fraunces'/)
    expect(serif.source.fonts.map((f) => f.family)).toContain('Fraunces')
  })

  it('marks nav brand, links and call to action', () => {
    const r = get('nav.lumen')
    expect(fields(r)).toEqual(['brand', 'link1', 'link2', 'link3', 'link4', 'cta'])
    expect(r.html).toContain('data-mx-list="links"')
    expect(r.html).toMatch(/data-mx-block="button"[^>]*data-mx-field="cta"/)
  })

  it('names hero copy and moves its animation into motion.css', () => {
    const r = get('hero.lumen')
    expect(fields(r)).toEqual(['eyebrow', 'headline', 'subhead', 'ctaPrimary', 'ctaSecondary', 'note'])
    expect(r.html).toContain('data-mx-block="image"')
    expect(r.motionCss).toContain(`@keyframes ${r.rootClass}-rise`)
    expect(r.css).not.toContain('animation')
  })

  it('turns repeating cards into a numbered list with named icons', () => {
    const r = get('features.lumen')
    expect(r.html).toContain('data-mx-list="features"')
    expect((r.html.match(/data-mx-label="Feature"/g) ?? []).length).toBe(6)
    expect(fields(r)).toContain('f6Body')
    expect(r.html).toContain('data-mx-icon="search"')
    expect(r.css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/)
  })

  it('nests plan features inside plans', () => {
    const f = fields(get('pricing.lumen'))
    expect(f).toEqual(expect.arrayContaining(['heading', 't1Name', 't1Price', 't1Cta', 't1F1', 't2F4', 't3Price', 'footnote']))
  })

  it('reads questions, quotes, stats and logos', () => {
    expect(fields(get('faq.lumen'))).toEqual(['heading', 'faq1Q', 'faq1A', 'faq2Q', 'faq2A', 'faq3Q', 'faq3A'])
    expect(fields(get('testimonials.orbit'))).toEqual(expect.arrayContaining(['heading', 'q1Quote', 'q1Name', 'q1Role', 'q3Role']))
    expect(fields(get('stats.orbit'))).toEqual(['stat1Value', 'stat1Label', 'stat2Value', 'stat2Label', 'stat3Value', 'stat3Label', 'stat4Value', 'stat4Label'])
    const logos = get('logos.orbit')
    expect(fields(logos)).toEqual(['eyebrow', 'logo1', 'logo2', 'logo3', 'logo4', 'logo5'])
    // The marquee's hidden second half follows the first.
    expect(logos.html).toContain('data-mx-mirror="logo1"')
    expect(logos.motionCss).toContain('infinite')
  })

  it('reads footer columns, content, team, blog and contact', () => {
    expect(fields(get('footer.lumen'))).toEqual(expect.arrayContaining(['brand', 'tagline', 'col1Title', 'col1L1', 'col3L3', 'legal']))
    expect(fields(get('content.folio'))).toEqual(expect.arrayContaining(['eyebrow', 'heading', 'lead', 'body1', 'body2', 'quote', 'caption']))
    expect(fields(get('team.folio'))).toEqual(expect.arrayContaining(['heading', 'm1Name', 'm1Role', 'm4Role']))
    expect(fields(get('blog.folio'))).toEqual(expect.arrayContaining(['heading', 'p1Title', 'p1Excerpt', 'p1Meta', 'cta']))
    expect(fields(get('contact.folio'))).toEqual(expect.arrayContaining(['heading', 'intro', 'email', 'phone', 'address', 'nameLabel', 'emailLabel', 'messageLabel', 'submit', 'note']))
    expect(fields(get('cta.orbit'))).toEqual(['heading', 'body', 'ctaPrimary', 'ctaSecondary', 'note'])
  })

  it('writes CSS only in tokens, with a 390px layout', () => {
    for (const r of results.values()) {
      expect(r.css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\d+vh\b/)
      expect(r.css).toContain(`.${r.rootClass} {`)
    }
    expect(get('features.lumen').css).toContain('@media (max-width: 760px)')
  })
})
