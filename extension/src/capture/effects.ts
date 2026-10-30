// The effects a captured section uses, as Blokmix treatment values (core/treatments):
// its shadow, gradient, grain, glass and glow, with colors named by palette role,
// so a mix (or the site library) can take them as a look kit.

import type { TokenKey, TokenSet } from '@/core/types'
import { COLOR_ROLES, cleanTreatment, type ColorRole, type EffectsState, type TreatmentValue } from '@/core/treatments'
import { COLOR_RE, chroma, dist, parseColor, type Rgba } from './color'
import { allEls, px, type WEl } from './tree'

/** The palette role nearest a color (its alpha aside). */
function nearestRole(c: Rgba, tokens: TokenSet): ColorRole {
  let best: ColorRole = 'text'
  let d = Infinity
  for (const r of COLOR_ROLES) {
    const t = parseColor(tokens[`color.${r}` as TokenKey])
    if (!t) continue
    const x = dist({ ...c, a: 1 }, t)
    if (x < d) {
      d = x
      best = r
    }
  }
  return best
}

interface ShadowLayer {
  c: Rgba
  x: number
  y: number
  blur: number
  spread: number
}

/** "rgba(0, 0, 0, 0.1) 0px 4px 12px 0px, …" (computed styles put the color first). */
export function parseShadow(v: string): ShadowLayer[] {
  if (!v || v === 'none') return []
  return v.split(/,(?![^(]*\))/).flatMap((part) => {
    if (/inset/.test(part)) return []
    const color = part.match(COLOR_RE)?.[0]
    const c = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 0.2 }
    const n = part.replace(COLOR_RE, '').trim().split(/\s+/).map(px)
    if (n.length < 2) return []
    return [{ c, x: n[0], y: n[1], blur: n[2] ?? 0, spread: n[3] ?? 0 }]
  })
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const area = (e: WEl) => Math.max(0, e.rect[2]) * Math.max(0, e.rect[3])

/** Effects from the section's computed styles; only what it clearly uses. */
export function detectEffects(root: WEl, tokens: TokenSet): EffectsState {
  const all = allEls(root)
  const out: EffectsState = {}
  const keep = (id: keyof EffectsState, v: TreatmentValue) => {
    const clean = cleanTreatment('effect', v)
    if (clean) out[id] = clean
  }

  // Shadow: the most used drop shadow; glow: a colored one with no offset.
  const shadows = new Map<string, { layers: ShadowLayer[]; n: number }>()
  for (const e of all) {
    const v = e.s['box-shadow']
    const layers = v ? parseShadow(v) : []
    if (!layers.length) continue
    const key = v!
    shadows.set(key, { layers, n: (shadows.get(key)?.n ?? 0) + 1 })
  }
  const ranked = [...shadows.values()].sort((a, b) => b.n - a.n)
  const drop = ranked.find((s) => s.layers.some((l) => Math.abs(l.y) + Math.abs(l.x) > 0))
  if (drop) {
    const deepest = drop.layers.reduce((a, b) => (Math.abs(b.y) > Math.abs(a.y) ? b : a))
    const off = Math.hypot(deepest.x, deepest.y)
    keep('shadow', {
      id: 'shadow',
      params: {
        elevation: Math.round(clamp(off, 1, 48)),
        softness: Math.round(clamp((deepest.blur / Math.max(1, off) - 1) * 50, 0, 100)),
        layers: clamp(drop.layers.length, 1, 6),
        opacity: Math.round(clamp(drop.layers.reduce((s, l) => s + l.c.a, 0) * 100, 0, 60)),
        tighten: Math.round(clamp((-deepest.spread / Math.max(1, off)) * 100, 0, 60)),
        angle: (Math.round(((Math.atan2(-deepest.y, -deepest.x) * 180) / Math.PI + 90 + 360) / 5) * 5) % 360,
        tint: chroma(deepest.c) > 0.05 ? nearestRole(deepest.c, tokens) : 'text',
      },
    })
  }
  const glow = ranked.flatMap((s) => s.layers).find((l) => l.x === 0 && l.y === 0 && l.blur >= 8 && chroma(l.c) > 0.06)
  if (glow) keep('glow', { id: 'glow', params: { color: nearestRole(glow.c, tokens), size: Math.round(clamp(glow.blur, 0, 80)), strength: Math.round(clamp(glow.c.a * 100, 10, 100)) } })

  // Gradient: the biggest gradient background, its colors named by role.
  const graded = all.filter((e) => /gradient\(/.test(e.s['background-image'] ?? '') && !/url\(/.test(e.s['background-image'] ?? '')).sort((a, b) => area(b) - area(a))[0]
  if (graded) {
    const bg = graded.s['background-image']!
    const first = bg.split(/,(?![^(]*\))/)[0] ?? bg
    const colors = (bg.match(COLOR_RE) ?? []).map(parseColor).filter((c): c is Rgba => !!c && c.a > 0.05)
    const stops = colors.map((c) => nearestRole(c, tokens)).filter((r, i, a) => i === 0 || a[i - 1] !== r)
    if (stops.length >= 2) {
      const angle = /(-?[\d.]+)deg/.exec(first)?.[1]
      keep('gradient', {
        id: 'gradient',
        params: {
          shape: /^radial/.test(bg.trim()) ? 'radial' : /^conic/.test(bg.trim()) ? 'conic' : 'linear',
          stops: stops.slice(0, 5),
          ...(angle ? { angle: Math.round((((+angle % 360) + 360) % 360) / 5) * 5 } : {}),
        },
      })
    }
  }

  // Glass: a backdrop blur over a see-through fill.
  const glass = all.find((e) => /blur\(/.test(e.s['backdrop-filter'] ?? ''))
  if (glass) {
    const f = glass.s['backdrop-filter']!
    const fill = parseColor(glass.s['background-color'])
    keep('glass', {
      id: 'glass',
      params: {
        blur: Math.round(clamp(px(/blur\(([^)]+)\)/.exec(f)?.[1]), 0, 40)),
        ...(/saturate\(([\d.]+)/.test(f) ? { saturate: Math.round(clamp(parseFloat(/saturate\(([\d.]+)/.exec(f)![1]) * 100, 100, 220) / 5) * 5 } : {}),
        ...(fill ? { fill: Math.round(clamp(fill.a * 100, 0, 95)), tint: nearestRole(fill, tokens) } : {}),
      },
    })
  }

  // Grain: an SVG noise texture laid over color.
  if (all.some((e) => /feTurbulence|noise|grain/i.test(e.s['background-image'] ?? ''))) keep('grain', { id: 'grain', params: { amount: 18 } })

  return out
}
