// Infer a source's tokens from a captured section: its palette (by role, not
// just by frequency), fonts, type scale, corners, line weight, shadow and motion.

import type { FontSource, TokenSet } from '@/core/types'
import { BASE_TOKENS } from '@/core/tokens'
import { findLibraryFont, fontSource, fontStack } from '@/core/fonts'
import { chroma, dist, mix, over, parseColor, toHex, type Palette, type Rgba } from './color'
import { allEls, clean, isEl, px, type WEl } from './tree'
import { behind, fontSize, fontWeight, HEADING_TAGS, isButtonish, isSolid, ownBg, setContextBg, textColor } from './roles'
import type { Snapshot } from './types'

export interface Families {
  display: string
  body: string
  mono: string
}

export interface Inferred {
  tokens: TokenSet
  palette: Palette
  fonts: FontSource[]
  families: Families
  notes: string[]
}

const SYSTEM = /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|helvetica neue|arial|sans-serif|serif|monospace|ui-monospace|ui-sans-serif|ui-serif|georgia|times|times new roman|menlo|monaco|consolas|courier|courier new|sf pro.*|sf mono|cursive|fantasy)$/i

export const firstFamily = (stack: string | undefined) => (stack ?? '').split(',')[0].trim().replace(/^['"]|['"]$/g, '')

class Tally {
  private m = new Map<string, { c: Rgba; w: number }>()
  add(c: Rgba | null, w = 1) {
    if (!c || w <= 0) return
    const k = toHex(c)
    const e = this.m.get(k) ?? { c, w: 0 }
    e.w += w
    this.m.set(k, e)
  }
  sorted(filter: (c: Rgba) => boolean = () => true) {
    return [...this.m.values()].filter((e) => filter(e.c)).sort((a, b) => b.w - a.w)
  }
  top(filter?: (c: Rgba) => boolean) {
    return this.sorted(filter)[0]?.c ?? null
  }
}

function mode<T>(xs: T[]): T | undefined {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

const RATIOS = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618]

export function inferTokens(root: WEl, snap: Snapshot): Inferred {
  const notes: string[] = []
  const all = allEls(root)
  const ctxBg = parseColor(snap.context.bg) ?? { r: 255, g: 255, b: 255, a: 1 }
  setContextBg(ctxBg.a < 1 ? over(ctxBg, { r: 255, g: 255, b: 255, a: 1 }) : ctxBg)
  const rootBg = ownBg(root)
  const bg = rootBg ?? behind(root)
  const text = textColor(root)

  // Text colours by how much text wears them; fills by area; borders by length.
  const texts = new Tally()
  const fills = new Tally()
  const borders = new Tally()
  const buttons = new Tally()
  const onButtons = new Tally()
  const chromatic = new Tally()
  const ownText = (e: WEl) => e.kids.filter((k) => !isEl(k)).map((k) => (k as { v: string }).v).join('').trim().length
  for (const e of all) {
    const n = ownText(e) || (e.text?.length ?? 0)
    if (n) texts.add(textColor(e), n)
    const f = ownBg(e)
    if (f && e !== root) {
      if (isButtonish(e) && isSolid(e)) {
        buttons.add(f, 1)
        onButtons.add(textColor(e), 1)
      } else fills.add(f, e.rect[2] * e.rect[3])
      chromatic.add(f, Math.sqrt(e.rect[2] * e.rect[3]))
    }
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const w = px(e.s[`border-${side}-width`])
      const c = parseColor(e.s[`border-${side}-color`])
      if (w > 0 && e.s[`border-${side}-style`] !== 'none' && c && c.a > 0.05) borders.add(over(c, ownBg(e) ?? behind(e)), side === 'top' || side === 'bottom' ? e.rect[2] : e.rect[3])
    }
    for (const m of (e.s['background-image'] ?? '').matchAll(/rgba\([^)]*\)/g)) chromatic.add(parseColor(m[0]), 40)
    if (n) chromatic.add(textColor(e), n)
    if (e.svg) for (const m of e.svg.matchAll(/(?:fill|stroke)="(rgba\([^)]*\))"/g)) chromatic.add(over(parseColor(m[1])!, behind(e)), 20)
  }

  const far = (c: Rgba, from: Rgba[], d = 0.06) => from.every((f) => dist(c, f) > d)
  const primary = buttons.top() ?? chromatic.top((c) => chroma(c) > 0.06 && far(c, [bg, text], 0.1)) ?? text
  const onPrimaryRaw = buttons.top() ? onButtons.top() : null
  const onPrimary = onPrimaryRaw ?? (dist(primary, bg) > dist(primary, text) ? bg : text)
  const muted = texts.top((c) => far(c, [text], 0.05) && far(c, [bg, primary], 0.1) && chroma(c) < 0.08) ?? mix(text, bg, 0.6)
  const surface = fills.top((c) => far(c, [bg], 0.012) && far(c, [primary, text], 0.08)) ?? mix(text, bg, 0.04)
  const border = borders.top((c) => far(c, [bg], 0.01)) ?? mix(text, bg, 0.12)
  const accent = chromatic.top((c) => chroma(c) > 0.05 && far(c, [primary, bg, text], 0.12)) ?? primary
  const palette: Palette = { bg, surface, text, muted, border, primary, 'on-primary': onPrimary, accent }

  // ---- type ----
  const leaves = all.filter((e) => e.text !== undefined || ownText(e) > 0)
  const len = (e: WEl) => (e.text ?? '').length || ownText(e)
  const headings = leaves.filter((e) => HEADING_TAGS.has(e.tag) || fontSize(e) >= 28).sort((a, b) => fontSize(b) - fontSize(a))
  const lead = headings[0]
  const bodyLeaves = leaves.filter((e) => !HEADING_TAGS.has(e.tag) && !isButtonish(e) && fontSize(e) >= 12 && fontSize(e) <= 22)
  const sizeTally = new Map<number, number>()
  for (const e of bodyLeaves) sizeTally.set(Math.round(fontSize(e)), (sizeTally.get(Math.round(fontSize(e))) ?? 0) + len(e))
  const base = [...sizeTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Math.round(px(root.s['font-size']) || 16)
  const sizes = [...new Set(leaves.map((e) => Math.round(fontSize(e))))].filter((s) => s > base * 1.05)
  let ratio = 1.25
  let bestErr = Infinity
  for (const r of RATIOS) {
    let err = 0
    for (const s of sizes) {
      const step = Math.log(s / base) / Math.log(r)
      err += step > 7.5 ? 1 : Math.abs(step - Math.round(step))
    }
    if (err < bestErr - 1e-6 || (Math.abs(err - bestErr) < 1e-6 && r === 1.25)) {
      bestErr = err
      ratio = r
    }
  }

  const family = (e: WEl | undefined) => firstFamily(e?.s['font-family'])
  // The body face is the one most of the reading text is set in (by characters, not elements).
  const famChars = new Map<string, number>()
  for (const e of bodyLeaves) if (family(e)) famChars.set(family(e), (famChars.get(family(e)) ?? 0) + len(e))
  const bodyFam = [...famChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? family(root)
  const displayFam = family(lead) || bodyFam
  const monoFam =
    mode(leaves.map(family).filter((f) => /mono|code|courier|consolas|menlo/i.test(f))) ??
    (leaves.some((e) => /monospace/.test(e.s['font-family'] ?? '')) ? firstFamily(leaves.find((e) => /monospace/.test(e.s['font-family'] ?? ''))!.s['font-family']) : '')
  const stackOf = (fam: string, role: 'display' | 'body' | 'mono', fallback: string): string => {
    if (!fam) return fallback
    if (findLibraryFont(fam)) return fontStack(fam, role)
    const page = leaves.map((e) => e.s['font-family'] ?? '').find((s) => firstFamily(s) === fam)
    return (page || `'${fam}', ${role === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`).replace(/"/g, "'")
  }

  const fonts: FontSource[] = []
  const linked = parseFontLinks(snap.fontLinks)
  for (const fam of [displayFam, bodyFam, monoFam]) {
    if (!fam || SYSTEM.test(fam) || fonts.some((f) => f.family === fam)) continue
    const fromPage = linked.find((f) => f.family.toLowerCase() === fam.toLowerCase())
    const lib = findLibraryFont(fam)
    if (fromPage) fonts.push(fromPage)
    else if (lib) fonts.push(fontSource(lib))
    else {
      fonts.push({ family: fam, css2: `${fam.replace(/ /g, '+')}:wght@400;500;600;700` })
      notes.push(`“${fam}” isn’t in the font library or a Google Fonts link on the page; its loader is a guess (Google Fonts), so check it loads or swap it for a library font`)
    }
  }

  // ---- shape, space, motion ----
  const corners: number[] = []
  let pills = 0
  const strokes: number[] = []
  const shadows: string[] = []
  const durations: number[] = []
  const eases: string[] = []
  for (const e of all) {
    const r = px(e.s['border-top-left-radius'])
    const h = e.rect[3]
    if (r > 0) {
      if (r >= 999 || (h > 0 && r >= h / 2 - 1)) pills++
      else if (!/%/.test(e.s['border-top-left-radius'] ?? '')) corners.push(Math.round(r))
    }
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const w = px(e.s[`border-${side}-width`])
      if (w > 0 && w <= 4 && e.s[`border-${side}-style`] !== 'none') strokes.push(w)
    }
    const sh = e.s['box-shadow']
    if (sh && sh !== 'none' && !/inset/.test(sh)) shadows.push(sh)
    for (const [d, f] of [
      ['transition-duration', 'transition-timing-function'],
      ['animation-duration', 'animation-timing-function'],
    ]) {
      const ds = (e.s[d] ?? '').split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000))
      const fs = (e.s[f] ?? '').split(/,(?![^(]*\))/).map((x) => x.trim())
      ds.forEach((ms, i) => {
        if (ms >= 80 && ms <= 2000) {
          durations.push(Math.round(ms))
          if (fs[i] ?? fs[0]) eases.push(fs[i] ?? fs[0])
        }
      })
    }
  }
  const radius = mode(corners) ?? (pills ? 8 : 0)
  const stroke = mode(strokes) ?? 1
  const padY = (px(root.s['padding-top']) + px(root.s['padding-bottom'])) / 2
  const ease = mode(eases.filter((x) => x !== 'ease' && x !== 'linear')) ?? BASE_TOKENS['motion.ease']

  const hex = (c: Rgba) => toHex(c)
  const tokens: TokenSet = {
    'color.bg': hex(bg),
    'color.surface': hex(surface),
    'color.text': hex(text),
    'color.muted': hex(muted),
    'color.border': hex(border),
    'color.primary': hex(primary),
    'color.onPrimary': hex(onPrimary),
    'color.accent': hex(accent),
    'font.display': stackOf(displayFam, 'display', BASE_TOKENS['font.display']),
    'font.body': stackOf(bodyFam, 'body', BASE_TOKENS['font.body']),
    'font.mono': stackOf(monoFam, 'mono', BASE_TOKENS['font.mono']),
    'type.base': `${base}px`,
    'type.ratio': String(ratio),
    'type.displayWeight': String(lead ? fontWeight(lead) : 700),
    'radius.base': `${radius}px`,
    'stroke.width': `${stroke}px`,
    'icon.set': '',
    'shadow.card': mode(shadows) ?? BASE_TOKENS['shadow.card'],
    'space.base': '4px',
    'space.section': padY >= 40 ? `${Math.round(padY / 4) * 4}px` : BASE_TOKENS['space.section'],
    'motion.duration': `${mode(durations) ?? 240}ms`,
    'motion.ease': ease.replace(/\s+/g, ' '),
  }
  if (!lead && leaves.length > 3) notes.push('No heading found, so the display font and weight follow the body text')
  return { tokens, palette, fonts, families: { display: displayFam, body: bodyFam, mono: monoFam }, notes }
}

/** Fonts the page loads from Google Fonts or Fontshare, as Blokmix font sources. */
export function parseFontLinks(links: string[]): FontSource[] {
  const out: FontSource[] = []
  for (const href of links) {
    let url: URL
    try {
      url = new URL(href)
    } catch {
      continue
    }
    if (url.hostname === 'fonts.googleapis.com') {
      for (const fam of url.searchParams.getAll('family')) {
        const name = fam.split(':')[0].replace(/\+/g, ' ')
        // css2 keeps `+` for spaces in the family name.
        out.push({ family: name, css2: fam.replace(/ /g, '+') })
      }
    } else if (/fontshare\.com$/.test(url.hostname)) {
      for (const f of url.searchParams.getAll('f[]')) {
        const [slug] = f.split('@')
        const lib = findLibraryFont(slug.replace(/-/g, ' '))
        out.push({ family: lib?.family ?? slug.replace(/(^|-)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()), css2: '', provider: 'fontshare', fontshare: f })
      }
    }
  }
  return out
}

/** Short, human description of a captured look for the source's `personality`. */
export function describeLook(t: TokenSet, host: string): string {
  const bg = parseColor(t['color.bg'])
  const dark = bg ? (bg.r * 299 + bg.g * 587 + bg.b * 114) / 1000 < 128 : false
  const r = px(t['radius.base'])
  const corners = r === 0 ? 'square corners' : r <= 4 ? 'tight corners' : r >= 14 ? 'soft, round corners' : `${r}px corners`
  const fam = firstFamily(t['font.display'])
  return clean(`Captured from ${host}: ${dark ? 'dark' : 'light'} ground, ${fam} display type, ${corners}, ${t['stroke.width']} lines.`)
}

