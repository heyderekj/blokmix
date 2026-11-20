import { describe, expect, it } from 'vitest'
import { applySkin, lookDistance, skinList, skinTokens, WIREFRAME, type Skin } from '@/core/skins'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { findLibraryFont } from '@/core/fonts'
import { primaryFamily } from '@/core/tokens'
import '@/data/skins'

// The bar in docs/theme-standards.md, as numbers: finished themes are each their own, not palette swaps of a neighbour.
const themes = skinList().filter((s) => s.id !== WIREFRAME)
const pairs = themes.flatMap((a, i) => themes.slice(i + 1).map((b) => [a, b] as const))
/** The values a theme lands on a site with (a shadow effect writes the card shadow). */
const landed = (s: Skin) => resolveGuide(applySkin(emptyGuide(), s)).tokens
const NEUTRALS = ['color.bg', 'color.surface', 'color.text', 'color.muted', 'color.border'] as const
const neutrals = (s: Skin) => NEUTRALS.map((k) => landed(s)[k]).join(' ')
const headings = (s: Skin) => JSON.stringify((['h1', 'h2', 'h3', 'h4'] as const).map((k) => s.textStyles?.[k] ?? null))
const most = (values: string[]) => Math.max(...values.map((v) => values.filter((x) => x === v).length))

/** How far apart any two themes must be (`lookDistance`: tone, main color, fonts, corners, weight, lines). */
const MIN_DISTANCE = 20

describe('finished themes are each their own', () => {
  it('no two share neutrals, a card shadow or a label style', () => {
    for (const [a, b] of pairs) {
      const pair = `${a.id} / ${b.id}`
      expect(neutrals(a), `${pair} neutrals`).not.toBe(neutrals(b))
      const shadows = [landed(a)['shadow.card'], landed(b)['shadow.card']]
      if (shadows[0] !== 'none') expect(shadows[0], `${pair} card shadow`).not.toBe(shadows[1])
      expect(JSON.stringify(a.textStyles?.label), `${pair} label`).not.toBe(JSON.stringify(b.textStyles?.label))
    }
  })

  it(`every pair is at least ${MIN_DISTANCE} apart`, () => {
    for (const [a, b] of pairs) expect(lookDistance(skinTokens(a), skinTokens(b)), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(MIN_DISTANCE)
  })

  it('no type ratio, easing or set of heading styles is on more than half of them', () => {
    const half = themes.length / 2
    expect(most(themes.map((s) => skinTokens(s)['type.ratio'])), 'type ratio').toBeLessThanOrEqual(half)
    expect(most(themes.map((s) => skinTokens(s)['motion.ease'])), 'easing').toBeLessThanOrEqual(half)
    expect(most(themes.map(headings)), 'heading styles').toBeLessThanOrEqual(half)
    for (const s of themes) expect(parseFloat(skinTokens(s)['type.ratio']), s.id).toBeLessThanOrEqual(1.333)
  })

  it('each sets its own headings, lead, small and caption styles, in weights its fonts load', () => {
    for (const s of themes) {
      for (const k of ['h1', 'h2', 'h3', 'h4', 'bodyLarge', 'small', 'caption'] as const) expect(Object.keys(s.textStyles?.[k] ?? {}).length, `${s.id} ${k}`).toBeGreaterThan(0)
      for (const [name, def] of Object.entries(s.textStyles ?? {})) {
        if (typeof def.weight !== 'number') continue
        const role = def.font ?? (/^h\d$/.test(name) ? 'display' : 'body')
        const font = findLibraryFont(primaryFamily(skinTokens(s)[`font.${role}`]))
        if (font) expect(font.weights, `${s.id} ${name}: ${font.family} ${def.weight}`).toContain(def.weight)
      }
    }
  })

  it('each has its own picture style and icon set, and a main button with a quieter one', () => {
    expect(new Set(themes.map((s) => s.picture?.style)).size, 'picture styles').toBe(themes.length)
    expect(new Set(themes.map((s) => skinTokens(s)['icon.set'])).size, 'icon sets').toBe(themes.length)
    for (const s of themes) {
      expect(s.components?.button?.variant, `${s.id} main button`).toBeTruthy()
      expect(s.components?.button?.secondary?.variant, `${s.id} quieter button`).not.toBe(s.components?.button?.variant)
    }
  })

  it('entrances differ by section type, on ease-out curves', () => {
    for (const s of themes) {
      const enters = new Set(Object.values(s.sections ?? {}).flatMap((d) => (d.motion?.mode === 'preset' ? [`${d.motion.enter}${d.motion.stagger ? '+' : ''}`] : [])))
      expect(enters.size, `${s.id} entrances`).toBeGreaterThanOrEqual(3)
      // Ease-out starts fast and lands soft: the first control point rises at once, the second ends flat at 1.
      const [x1, y1, , y2] = (skinTokens(s)['motion.ease'].match(/[\d.]+/g) ?? []).map(Number)
      expect(y1 > x1 && y2 === 1, `${s.id} ${skinTokens(s)['motion.ease']}`).toBe(true)
    }
    expect(new Set(themes.map((s) => skinTokens(s)['motion.ease'])).size).toBeGreaterThanOrEqual(2)
  })
})
