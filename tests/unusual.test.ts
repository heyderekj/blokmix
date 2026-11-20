import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import '@/data/directions'
import { byUnusual, directionList, oddness } from '@/core/directions'
import { currentSlots, useStore } from '@/state/store'
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
})
