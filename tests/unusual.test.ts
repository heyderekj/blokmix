import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import '@/data/directions'
import { byUnusual, directionList, oddness } from '@/core/directions'
import { currentSlots, useStore } from '@/state/store'
import { skinList } from '@/core/skins'
import '@/data/skins'
import { runCommand } from '@/state/commands'

describe('how unusual', () => {
  it('reads each layout and theme off the least unusual direction that uses it', () => {
    const { layouts, themes } = oddness()
    const safe = directionList().find((d) => (d.odd ?? 0) === 0)!
    const anySafeLayout = Object.values(safe.layouts)[0]![0]
    expect(layouts.get(anySafeLayout)).toBe(0)
    expect(themes.get(safe.theme.split('/')[0])).toBe(0)
    expect([...layouts.values()].some((v) => v >= 1)).toBe(true)
  })

  it('keeps an experiment strange even when a safe direction uses it', () => {
    const experiments = skinList().filter((s) => s.odd === 2).map((s) => s.id)
    expect(experiments.sort()).toEqual(['bootleg', 'full-volume', 'light-show'])
    const safe = { ...directionList().find((d) => (d.odd ?? 0) === 0)!, id: 'test-safe', theme: 'bootleg', odd: 0 as const }
    const { themes } = oddness([...directionList(), safe])
    for (const id of experiments) expect(themes.get(id), id).toBe(2)
    expect(themes.get('studio')).toBe(0)
  })

  it('picks safe ones, any, or the unusual ones first, never nothing', () => {
    const odd = (x: string) => (x.startsWith('odd') ? 2 : 0)
    const options = ['a', 'b', 'odd1']
    expect(byUnusual(options, 0, odd)).toEqual(['a', 'b'])
    expect(byUnusual(options, 1, odd)).toEqual(options)
    expect(byUnusual(options, 2, odd)).toEqual(['odd1'])
    expect(byUnusual(['a'], 2, odd)).toEqual(['a'])
  })
})

describe('Mix at a setting', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('at Safe, lands every section on a layout conventional sites use', () => {
    const { layouts } = oddness()
    useStore.getState().setUi({ unusual: 0 })
    for (let i = 0; i < 5; i++) {
      useStore.getState().shuffle()
      for (const s of currentSlots(useStore.getState())) {
        const safeOnes = library.byType[s.type].filter((id) => (layouts.get(id) ?? 0) === 0)
        if (safeOnes.length > 1) expect(layouts.get(s.clipId) ?? 0, s.clipId).toBe(0)
      }
    }
  })

  it('Mix the rest at Safe takes parts from themes close to this one, and at Strange from far or odd ones', () => {
    runCommand('apply_skin', { skin: 'acoustic' }, 'agent')
    const near = runCommand('surprise_me', { seed: 3, unusual: 0 }, 'agent') as { words: string }
    runCommand('apply_skin', { skin: 'acoustic' }, 'agent')
    const far = runCommand('surprise_me', { seed: 3, unusual: 2 }, 'agent') as { words: string }
    expect(near.words).not.toBe(far.words)
  })

  it('Mix the rest at Safe never lands an experiment, and at Strange it can', () => {
    const experiments = skinList().filter((s) => s.odd === 2).map((s) => s.name)
    const words = (unusual: 0 | 2) =>
      Array.from({ length: 12 }, (_, seed) => {
        runCommand('apply_skin', { skin: 'acoustic' }, 'agent')
        return (runCommand('surprise_me', { seed, unusual }, 'agent') as { words: string }).words
      }).join(' | ')
    const safe = words(0)
    for (const name of experiments) expect(safe, name).not.toContain(name)
    expect(experiments.some((name) => words(2).includes(name))).toBe(true)
  })
})
