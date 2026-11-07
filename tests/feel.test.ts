import { describe, expect, it } from 'vitest'
import '@/data/skins'
import { FEEL_WORDS, NUDGES, nudgesFor, nudgeTokens, themesFor } from '@/core/feel'
import { skinList, skinTokens } from '@/core/skins'
import { readDials, toneOfGuide } from '@/core/dials'
import { areasOfCommand, emptyContract } from '@/core/contract'
import { resolveGuide } from '@/core/guide'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

describe('feel words', () => {
  it('every theme but the sketch has some, and every word brings up a theme', () => {
    for (const s of skinList()) if (s.id !== 'wireframe') expect(s.feel.length, s.id).toBeGreaterThan(0)
    for (const w of FEEL_WORDS) expect(themesFor([w], skinList())[0].feel, w).toContain(w)
  })

  it('ranks by how many words a theme answers to, and never offers Wireframe', () => {
    const [first] = themesFor(['warm', 'classic'], skinList())
    expect(first.feel).toEqual(expect.arrayContaining(['warm', 'classic']))
    expect(themesFor([], skinList(), { count: 20 }).map((s) => s.id)).not.toContain('wireframe')
  })

  it('“something different” matches none of the words', () => {
    const different = themesFor(['dark', 'modern'], skinList(), { different: true })
    expect(different.length).toBeGreaterThan(0)
    for (const s of different) expect(s.feel.some((w) => w === 'dark' || w === 'modern'), s.id).toBe(false)
  })
})

describe('nudges', () => {
  const calm = skinTokens(skinList().find((s) => s.id === 'studio')!)

  it('move the dials a step the right way', () => {
    const t = { ...calm, ...nudgeTokens(calm, 'rounder') }
    expect(readDials(t).roundness).toBeGreaterThan(readDials(calm).roundness)
    const b = { ...calm, ...nudgeTokens(calm, 'bolder') }
    expect(readDials(b).type).toBeGreaterThan(readDials(calm).type)
    expect(readDials(b).weight).toBeGreaterThan(readDials(calm).weight)
  })

  it('stop at the end, and Darker turns a light page dark', () => {
    const square = { ...calm, 'radius.base': '0px' }
    expect(nudgeTokens(square, 'sharper')).toBeNull()
    expect(toneOfGuide({ ...calm, ...nudgeTokens(calm, 'darker') })).toBe('dark')
    expect(nudgeTokens(calm, 'lighter')).toBeNull()
    expect(nudgesFor(calm)).not.toContain('lighter')
  })

  it('every nudge names the areas it writes, so a kept area refuses it', () => {
    for (const n of NUDGES) expect(areasOfCommand('nudge_look', { nudge: n }).length, n).toBeGreaterThan(0)
  })
})

describe('the commands', () => {
  it('suggest themes and nudge as one undo step, minding the contract', () => {
    const fit = runCommand('suggest_themes', { words: ['dark'] }) as { themes: { feel: string[] }[] }
    expect(fit.themes[0].feel).toContain('dark')
    runCommand('apply_skin', { skin: 'studio' })
    const before = useStore.temporal.getState().pastStates.length
    const r0 = readDials(resolveGuide(useStore.getState().guide).tokens).roundness
    runCommand('nudge_look', { nudge: 'rounder' })
    expect(readDials(resolveGuide(useStore.getState().guide).tokens).roundness).toBeGreaterThan(r0)
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1)
    runCommand('set_contract', { areas: { shape: 'keep' } })
    expect(() => runCommand('nudge_look', { nudge: 'sharper' })).toThrow(/Keep for Shape/)
    useStore.getState().setContract(emptyContract())
  })
})
