import { beforeEach, describe, expect, it } from 'vitest'
import { pairingOf, pairingPalettes, PAIRINGS, readability } from '@/core/colorPairs'
import { contrastFailures } from '@/core/skins'
import { resolveGuide } from '@/core/guide'
import { NAMED_COLORS } from '@/core/colorInput'
import { useStore } from '@/state/store'

beforeEach(() => useStore.getState().resetDemo())

describe('pairings', () => {
  it('every pairing of every named color reads, light and dark', () => {
    for (const { hex } of NAMED_COLORS)
      for (const mode of ['light', 'dark'] as const)
        for (const p of pairingPalettes(hex, mode)) expect(contrastFailures(p.palette as never), `${hex} ${mode} ${p.id}`).toEqual([])
  })
  it('knows a pairing by its variant', () => {
    for (const p of PAIRINGS) expect(pairingOf(p.variant).id).toBe(p.id)
    expect(pairingOf(undefined).id).toBe('triad')
  })
  it('says how words read on a color, best first', () => {
    const r = readability('#2747a8')
    expect(r[0].ink).toBe('light')
    expect(r[0].ratio).toBeGreaterThan(r[1].ratio)
    expect(readability('#ffeb3b')[0].ink).toBe('dark')
  })
  it('keeps the pairing with the brand color when the theme changes', () => {
    const st = useStore.getState()
    st.setBrandColor('#2747a8', { accentTurn: 180 })
    const before = resolveGuide(useStore.getState().guide).tokens['color.accent']
    expect(useStore.getState().guide.brand?.variant?.accentTurn).toBe(180)
    expect(useStore.getState().applySkin('studio')).toBe(true)
    expect(resolveGuide(useStore.getState().guide).tokens['color.accent']).toBe(before)
  })
})
