import { beforeEach, describe, expect, it } from 'vitest'
import { legacyDressPool } from '@/data/skins'
import { INDUSTRIES } from '@/core/brief'
import { areasOfCommand, emptyContract, STYLE_AREAS } from '@/core/contract'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { paletteFrom } from '@/core/palette'
import { guideFor } from '@/core/start'
import { applySkin, contrastFailures, dressOldGuide, skinById, skinList, skinTokens, surpriseMe, swapThemeParts, themeList } from '@/core/skins'
import { listParts } from '@/core/themeParts'
import { rankThemes, visualKey } from '@/core/themeRanking'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'
import { mixFile } from '@/lib/mixFile'
import { layeredShadow } from '@/core/treatments/effects'

const skin = (id: string) => skinById(id)!
const own = () => applySkin(emptyGuide(), skin('studio'))
describe('theme parts and resolved recommendations', () => {
  beforeEach(() => {
    useStore.setState({ guide: own(), contract: emptyContract() })
    useStore.temporal.getState().clear()
  })
  it('starts, previews and applies the same brand pairing and explicit mode', () => {
    const brand = '#216374',
      variant = { accentTurn: 180 }
    const initial = guideFor({ skin: 'flyer', brand, variant, mode: 'dark' })
    for (const r of rankThemes({ guide: initial, brief: { industry: 'food' } })) {
      const expected = guideFor({ skin: r.skin.id, brand, variant, mode: 'dark' })
      expect(r.guide).toEqual(expected)
      expect(r.guide.base).toMatchObject(paletteFrom(brand, 'dark', variant))
    }
    const next = surpriseMe(initial, { ...emptyContract(), areas: { color: 'surprise' } }, 1, [skin('vinyl')])!
    expect(next.guide.base['color.primary']).toBe(skin('vinyl').tokens['color.primary'])
  })
  it('retains a generated palette’s recipe and still supports literal custom colors', () => {
    const colors = paletteFrom('#ae3190', 'dark', { tint: 0.3 })
    runCommand('set_palette', { colors, brand: '#ae3190', variant: { tint: 0.3 }, mode: 'dark' })
    runCommand('apply_skin', { skin: 'homeroom' })
    expect(resolveGuide(useStore.getState().guide).tokens).toMatchObject(colors)
    runCommand('set_palette', { colors: { ...colors, 'color.accent': '#abcdef' } })
    expect(resolveGuide(JSON.parse(JSON.stringify(mixFile().data.guide))).tokens['color.accent']).toBe('#abcdef')
  })
  it('preserves unrelated candidate choices and replaces only the owned section fields', () => {
    const g = own()
    g.candidates.push({ id: 'clip-color', clipId: 'clip', group: 'color', promotedAt: 1, values: { 'color.primary': '#669900' } })
    g.choices['color.primary'] = { kind: 'candidate', candidateId: 'clip-color' }
    const next = swapThemeParts(g, { motion: 'still', type: 'liner-notes' })
    expect(next.choices['color.primary']).toEqual(g.choices['color.primary'])
    expect(next.effects).toEqual(g.effects)
    expect(next.sections?.hero?.backdrop).toEqual(g.sections?.hero?.backdrop)
    expect(next.base['motion.duration']).toBe('0ms')
    expect(next.base['font.display']).toBe(skin('liner-notes').tokens['font.display'])
    const edited = { ...next, choices: { ...next.choices, 'font.display': { kind: 'custom' as const, value: 'Example serif' } } }
    expect(listParts(edited, undefined, 'type')[0].current).toBeNull()
  })
  it('refuses the whole request when one area is kept, and undoes rapid applies separately', () => {
    const before = useStore.getState().guide
    useStore.setState({ contract: { ...emptyContract(), areas: { shape: 'keep' } } })
    expect(() => runCommand('set_theme_parts', { parts: { type: 'vinyl', shape: 'studio' } }, 'you')).toThrow(/Keep/)
    expect(useStore.getState().guide).toBe(before)
    runCommand('set_theme_part', { area: 'type', part: 'vinyl' }, 'you')
    const first = useStore.getState().guide
    runCommand('apply_skin', { skin: 'mastered', flavor: 'ledger' }, 'you')
    expect(JSON.parse(JSON.stringify(mixFile().data.guide)).skin).toMatchObject({ id: 'mastered', flavor: 'ledger' })
    useStore.temporal.getState().undo()
    expect(useStore.getState().guide).toEqual(first)
    useStore.temporal.getState().undo()
    expect(useStore.getState().guide).toEqual(before)
  })
  it('freezes legacy dressing before polishing the original definitions', () => {
    const original = legacyDressPool.find((s) => s.id === 'studio')!
    const dressed = dressOldGuide({ ...emptyGuide(), base: skinTokens(original) }, legacyDressPool)
    expect(dressed.sections).toEqual(original.sections)
    expect(dressed.textStyles?.h2).toBeUndefined()
    expect(skin('studio').textStyles?.h2).toBeDefined()
  })
  it('maps shared fields to the areas their commands really change', () => {
    expect(areasOfCommand('set_dial', { dial: 'weight' })).toEqual(['type', 'shape'])
    expect(areasOfCommand('set_section_motion', {})).toEqual(['motion'])
    expect(areasOfCommand('set_effect', { effect: 'shadow' })).toEqual(['shape'])
    expect(areasOfCommand('update_text_style', {})).toEqual(['type'])
    expect(layeredShadow({ angle: 180, layers: 1, elevation: 8, opacity: 20, softness: 10, tighten: 1, tint: 'text' })).toMatch(/^0px 8px /)
  })
  it('has three different outcomes per industry and collapses identical kept outcomes', () => {
    for (const industry of INDUSTRIES) {
      const picks = rankThemes({ brief: { industry } })
      expect(new Set(picks.map((r) => visualKey(r.guide))).size, industry).toBe(3)
      expect(rankThemes({ brief: { industry } }).map((r) => r.skin.id)).toEqual(picks.map((r) => r.skin.id))
    }
    const contract = { ...emptyContract(), areas: Object.fromEntries(STYLE_AREAS.map((a) => [a, 'keep'])) }
    expect(rankThemes({ guide: own(), contract })).toHaveLength(1)
  })
  it('renders each catalog variant with accessible tokens and distinct non-color styling', () => {
    for (const s of themeList()) {
      expect(contrastFailures(skinTokens(s))).toEqual([])
      expect(parseFloat(skinTokens(s)['motion.duration'])).toBeLessThanOrEqual(300)
      if (!s.baseId) continue
      const g = guideFor({ skin: s.id, brand: '#402f51', mode: 'dark' })
      expect(visualKey(g), s.id).not.toBe(visualKey(guideFor({ skin: s.baseId, brand: '#402f51', mode: 'dark' })))
    }
    expect(skinList()).toHaveLength(16)
  })
})
