// One style guide for a whole site, from the tokens inferred per section (inferTokens, via captureClip) and a few
// page-wide facts (body colors, :root variables, loaded fonts, buttons, gaps). Pure: the library CLI gathers the
// inputs in a headless page.
//
// Sections vote by area, so a single dark band doesn't decide the page's ground; colors that depend on the ground
// (text, muted, surface, border) only take votes from sections on that ground; the primary comes from the page's
// buttons; space.base from the gaps the page repeats.

import type { FontSource, SectionType, Source, TokenKey, TokenSet } from '@/core/types'
import { BASE_TOKENS } from '@/core/tokens'
import { chroma, dist, lightness, over, parseColor, toHex, type Rgba } from './color'
import { firstFamily } from './tokens'

export interface SectionStyle {
  type: SectionType
  /** Page px² the section covers. */
  area: number
  tokens: Partial<TokenSet>
  fonts: FontSource[]
}

export interface SiteFacts {
  bodyBg: string
  bodyColor: string
  htmlBg?: string
  vars?: Record<string, string>
  fontFaces?: string[]
  typekit?: boolean
  buttons?: { bg: string; color: string; count: number }[]
  gaps?: number[]
  /** Paragraph font sizes (px) → characters set in them. */
  bodySizes?: Record<string, number>
}

export interface SiteTokens {
  source: Source
  fonts: FontSource[]
  personality: string
  /** Brand-looking :root variables that were read (name → value), for reference. */
  vars: Record<string, string>
  notes: string[]
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

class Votes<T> {
  private m = new Map<string, { v: T; w: number }>()
  constructor(private key: (v: T) => string = String) {}
  add(v: T | null | undefined, w: number) {
    if (v === null || v === undefined || v === '' || !(w > 0)) return
    const k = this.key(v)
    const e = this.m.get(k) ?? { v, w: 0 }
    e.w += w
    this.m.set(k, e)
  }
  top(filter: (v: T) => boolean = () => true): T | undefined {
    return [...this.m.values()].filter((e) => filter(e.v)).sort((a, b) => b.w - a.w)[0]?.v
  }
  get size() {
    return this.m.size
  }
}

/** Colors within a hair of each other count as one. */
class ColorVotes {
  private list: { c: Rgba; w: number }[] = []
  add(c: Rgba | null | undefined, w: number) {
    if (!c || !(w > 0)) return
    const near = this.list.find((e) => dist(e.c, c) < 0.02)
    if (near) near.w += w
    else this.list.push({ c, w })
  }
  top(filter: (c: Rgba) => boolean = () => true): Rgba | undefined {
    return this.list.filter((e) => filter(e.c)).sort((a, b) => b.w - a.w)[0]?.c
  }
}

const solid = (v: string | undefined): Rgba | null => {
  const c = parseColor(v)
  if (!c || c.a < 0.05) return null
  return c.a < 1 ? over(c, WHITE) : c
}
const isDark = (c: Rgba) => lightness(c) < 0.5

/** The space unit most of the page's gaps are steps of (Blokmix's scale: 1,2,3,4,6,8,12,16,24,32 × unit). */
export function spaceUnit(gaps: number[]): number {
  if (gaps.length < 6) return 4
  const STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
  const fits = (u: number) => gaps.filter((g) => STEPS.some((s) => Math.abs(g - s * u) <= 1)).length / gaps.length
  for (const u of [8, 6, 5]) if (fits(u) >= 0.8 && fits(u) >= fits(4) - 0.05) return u
  return 4
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** The size most paragraph text is set in, when the page has enough of it (product mock-ups shouldn't decide). */
function readingSize(sizes: Record<string, number> | undefined): string | undefined {
  const top = Object.entries(sizes ?? {})
    .map(([k, n]) => [Number(k), n] as const)
    .filter(([k]) => k >= 12 && k <= 24)
    .sort((a, b) => b[1] - a[1])[0]
  return top && top[1] >= 200 ? `${top[0]}px` : undefined
}

const BRAND_VAR = /(^|-)(brand|primary|accent|main|highlight)(-|$)/i

export function siteTokens(input: { id: string; name: string; url: string; sections: SectionStyle[]; facts: SiteFacts }): SiteTokens {
  const { sections, facts } = input
  const notes: string[] = []
  // Nav and footer count for less: they're chrome, and often a different band.
  const weight = (s: SectionStyle) => s.area * (s.type === 'nav' || s.type === 'footer' ? 0.35 : s.type === 'hero' ? 1.3 : 1)
  const total = sections.reduce((n, s) => n + weight(s), 0) || 1

  // ---- ground ----
  const grounds = new ColorVotes()
  for (const s of sections) grounds.add(solid(s.tokens['color.bg']), weight(s))
  const bodyBg = solid(facts.bodyBg) ?? solid(facts.htmlBg)
  // The body's own color is what's between and behind sections: worth a quarter of the page.
  grounds.add(bodyBg, total * 0.25)
  const bg = grounds.top() ?? bodyBg ?? WHITE
  const onGround = sections.filter((s) => {
    const c = solid(s.tokens['color.bg'])
    return c ? dist(c, bg) < 0.03 : false
  })
  const voters = onGround.length ? onGround : sections
  if (!onGround.length) notes.push('No section sits on the page’s ground color, so ground-dependent colors are voted by every section')

  const colorVote = (key: TokenKey, filter?: (c: Rgba) => boolean) => {
    const v = new ColorVotes()
    for (const s of voters) v.add(solid(s.tokens[key]), weight(s))
    return v.top(filter)
  }
  const bodyColor = solid(facts.bodyColor)
  let text = colorVote('color.text', (c) => dist(c, bg) > 0.3)
  if (!text) text = bodyColor && dist(bodyColor, bg) > 0.3 ? bodyColor : isDark(bg) ? WHITE : { r: 17, g: 17, b: 17, a: 1 }

  // ---- primary, from the page's solid buttons (not the ones the color of the ground) ----
  const btnVotes = new ColorVotes()
  const onBtn = new Map<string, Rgba>()
  for (const b of facts.buttons ?? []) {
    const fill = solid(b.bg)
    if (!fill || dist(fill, bg) < 0.04) continue
    btnVotes.add(fill, b.count)
    const ink = solid(b.color)
    if (ink && !onBtn.has(toHex(fill))) onBtn.set(toHex(fill), ink)
  }
  // A chromatic button beats a neutral one when it's nearly as common: brands rarely make their main action gray.
  // Soft buttons (a fill barely off the ground) are secondary; the main action stands out from the ground.
  const strong = (c: Rgba) => dist(c, bg) >= 0.12
  const neutralTop = btnVotes.top(strong)
  const chromaTop = btnVotes.top((c) => strong(c) && chroma(c) > 0.06)
  let primary = chromaTop ?? neutralTop
  let onPrimary: Rgba | undefined = primary ? onBtn.get(toHex(primary)) : undefined
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(facts.vars ?? {})) if (BRAND_VAR.test(k.replace(/^--/, '')) && solid(v)) vars[k] = v
  if (!primary && btnVotes.top()) {
    primary = text
    onPrimary = bg
    notes.push('The page’s buttons are all soft fills, so the primary is the text color')
  }
  if (!primary) {
    const fromVar = Object.values(vars).map(solid).find((c) => c && dist(c, bg) > 0.1 && chroma(c) > 0.04)
    primary = fromVar ?? colorVote('color.primary') ?? text
    if (fromVar) notes.push('No solid buttons on the page; the primary color comes from its :root brand variable')
  }
  if (!onPrimary) onPrimary = dist(primary, bg) > dist(primary, text) ? bg : text

  const muted = colorVote('color.muted', (c) => dist(c, text) > 0.05 && dist(c, bg) > 0.1) ?? text
  const surface = colorVote('color.surface', (c) => dist(c, bg) > 0.012 && dist(c, text) > 0.08) ?? bg
  const border = colorVote('color.border', (c) => dist(c, bg) > 0.01) ?? surface
  const accentVotes = new ColorVotes()
  for (const s of sections) accentVotes.add(solid(s.tokens['color.accent']), weight(s))
  const accent = accentVotes.top((c) => chroma(c) > 0.05 && dist(c, primary!) > 0.1 && dist(c, bg) > 0.1) ?? primary

  // ---- everything else: area-weighted votes ----
  const vote = (key: TokenKey, from = sections, w = weight) => {
    const v = new Votes<string>()
    for (const s of from) v.add(s.tokens[key], w(s))
    return v.top()
  }
  const content = sections.filter((s) => s.type !== 'nav' && s.type !== 'footer')
  const displayWeight = (s: SectionStyle) => weight(s) * (s.type === 'hero' || s.type === 'header' ? 3 : 1)
  const display = vote('font.display', content.length ? content : sections, displayWeight) ?? BASE_TOKENS['font.display']
  const bodyFont = vote('font.body', content.length ? content : sections) ?? BASE_TOKENS['font.body']
  const mono = vote('font.mono') ?? BASE_TOKENS['font.mono']
  const sectionPads = content.map((s) => parseFloat(s.tokens['space.section'] ?? '')).filter((n) => n >= 40)
  const pad = median(sectionPads)
  const unit = spaceUnit(facts.gaps ?? [])

  const hex = (c: Rgba) => toHex(c)
  const tokens: TokenSet = {
    ...BASE_TOKENS,
    'color.bg': hex(bg),
    'color.surface': hex(surface),
    'color.text': hex(text),
    'color.muted': hex(muted),
    'color.border': hex(border),
    'color.primary': hex(primary),
    'color.onPrimary': hex(onPrimary),
    'color.accent': hex(accent),
    'font.display': display,
    'font.body': bodyFont,
    'font.mono': mono,
    'type.base': readingSize(facts.bodySizes) ?? vote('type.base', content.length ? content : sections) ?? BASE_TOKENS['type.base'],
    'type.ratio': vote('type.ratio', content.length ? content : sections) ?? BASE_TOKENS['type.ratio'],
    'type.displayWeight': vote('type.displayWeight', content.length ? content : sections, displayWeight) ?? BASE_TOKENS['type.displayWeight'],
    'radius.base': vote('radius.base') ?? BASE_TOKENS['radius.base'],
    'stroke.width': vote('stroke.width') ?? BASE_TOKENS['stroke.width'],
    'icon.set': vote('icon.set') ?? '',
    'shadow.card': vote('shadow.card') ?? BASE_TOKENS['shadow.card'],
    'space.base': `${unit}px`,
    'space.section': pad ? `${Math.round(pad / 4) * 4}px` : BASE_TOKENS['space.section'],
    'motion.duration': vote('motion.duration') ?? BASE_TOKENS['motion.duration'],
    'motion.ease': vote('motion.ease') ?? BASE_TOKENS['motion.ease'],
  }

  // ---- fonts: what the sections found for the families used, then the page's own @font-face families ----
  const fonts: FontSource[] = []
  const used = [display, bodyFont, mono].map(firstFamily).filter(Boolean)
  for (const fam of used) {
    if (fonts.some((f) => f.family.toLowerCase() === fam.toLowerCase())) continue
    const found = sections.flatMap((s) => s.fonts).find((f) => f.family.toLowerCase() === fam.toLowerCase())
    if (found) fonts.push(found)
  }
  const faces = (facts.fontFaces ?? []).filter((f) => !/icon|awesome|material|symbols|swiper|slick/i.test(f))
  const missing = used.filter((f) => !faces.some((x) => x.toLowerCase() === f.toLowerCase()) && !/^(system-ui|-apple-system|sans-serif|serif|monospace|ui-)/i.test(f))
  if (missing.length && faces.length) notes.push(`Not among the page’s loaded font faces: ${missing.join(', ')}`)
  if (facts.typekit) notes.push('The page loads fonts from Adobe Fonts (Typekit); swap them for library fonts to export')

  const personality = describeSite(tokens, sections)
  const source: Source = { id: input.id, kind: 'site', name: input.name, url: input.url, personality, tokens, fonts }
  return { source, fonts, personality, vars, notes }
}

const HUES: [number, string][] = [
  [20, 'red'],
  [50, 'orange'],
  [70, 'amber'],
  [110, 'yellow'],
  [160, 'green'],
  [200, 'teal'],
  [250, 'blue'],
  [290, 'indigo'],
  [330, 'violet'],
  [360, 'pink'],
]

function hueName(c: Rgba): string {
  if (chroma(c) < 0.04) return lightness(c) > 0.85 ? 'white' : lightness(c) < 0.25 ? 'black' : 'gray'
  const { r, g, b } = c
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  let h = 0
  if (max !== min) {
    const d = max - min
    h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
    h = (h * 60 + 360) % 360
  }
  return HUES.find(([lim]) => h < lim)?.[1] ?? 'red'
}

/** A short description of the site's look (no site words). */
export function describeSite(t: TokenSet, sections: SectionStyle[] = []): string {
  const bg = parseColor(t['color.bg']) ?? WHITE
  const primary = parseColor(t['color.primary']) ?? bg
  const r = parseFloat(t['radius.base']) || 0
  const corners = r === 0 ? 'square corners' : r <= 4 ? 'tight corners' : r >= 14 ? 'soft, round corners' : `${r}px corners`
  const display = firstFamily(t['font.display'])
  const body = firstFamily(t['font.body'])
  const type = display.toLowerCase() === body.toLowerCase() ? `${display} throughout` : `${display} headings over ${body}`
  const bands = sections.filter((s) => {
    const c = parseColor(s.tokens['color.bg'])
    return c && dist(c, bg) > 0.15
  }).length
  const rhythm = bands >= 2 ? ', with contrasting bands' : ''
  return `${isDark(bg) ? 'Dark' : 'Light'} ground, ${type}, ${corners}, a ${hueName(primary)} primary${rhythm}.`
}
