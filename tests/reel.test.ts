import { describe, expect, it } from 'vitest'
import { REEL, reelPlan, reelTiles, reelTiming } from '@/core/reel'

const ids = ['a', 'b', 'c', 'd', 'e', 'f']

describe('reelPlan', () => {
  it('starts where it is and ends on the target', () => {
    for (const from of ids)
      for (const to of ids) {
        if (from === to) continue
        for (let seed = 0; seed < 8; seed++) {
          const plan = reelPlan(ids, from, to, { seed })
          expect(plan[0]).toBe(from)
          expect(plan.at(-1)).toBe(to)
        }
      }
  })

  it('never repeats a layout', () => {
    for (let seed = 0; seed < 12; seed++) {
      const plan = reelPlan(ids, 'b', 'e', { seed })
      expect(new Set(plan).size).toBe(plan.length)
    }
    expect(reelPlan(['a', 'b'], 'a', 'b', { pass: 2 })).toEqual(['a', 'b'])
  })

  it('passes through only ready layouts, at most two', () => {
    const ready = (id: string) => id === 'c' || id === 'f'
    for (let seed = 0; seed < 6; seed++) {
      const plan = reelPlan(ids, 'a', 'd', { ready, seed, pass: 2 })
      expect(plan.slice(1, -1).every(ready)).toBe(true)
      expect(plan.length).toBeLessThanOrEqual(4)
    }
    expect(reelPlan(ids, 'a', 'd', { ready: () => false })).toEqual(['a', 'd'])
    expect(reelPlan(ids, 'a', 'd', { pass: 9 }).length).toBe(4)
    expect(reelPlan(ids, 'a', 'd', { pass: 1 }).length).toBe(3)
    expect(reelPlan(ids, 'a', 'd', { pass: 0 })).toEqual(['a', 'd'])
  })

  it('rolls forward through the cycle', () => {
    expect(reelPlan(ids, 'e', 'b', { seed: 0 })).toEqual(['e', 'f', 'a', 'b'])
  })

  it('stays put when there is nowhere to go', () => {
    expect(reelPlan(ids, 'c', 'c')).toEqual(['c'])
  })
})

describe('reelTiming', () => {
  it('staggers rows and caps the wait', () => {
    expect(reelTiming(0).delay).toBe(0)
    expect(reelTiming(1).delay).toBe(REEL.stagger)
    expect(reelTiming(40).delay).toBe(REEL.maxDelay)
    expect(reelTiming(-3).delay).toBe(0)
  })

  it('eases the height once, within the spin', () => {
    for (const o of [{}, { quick: true }, { reduced: true }]) {
      const t = reelTiming(2, o)
      expect(t.heightDelay + t.heightDuration).toBe(t.duration)
      expect(t.duration + REEL.maxDelay).toBeLessThanOrEqual(REEL.duration + REEL.maxDelay)
    }
    expect(reelTiming(0, { quick: true }).duration).toBeLessThan(reelTiming(0).duration)
    expect(reelTiming(0, { reduced: true }).settle).toBe(0)
  })

  it('wakes fewer tiles when many rows show', () => {
    expect(reelTiles(4)).toBe(4)
    expect(reelTiles(6)).toBe(2)
  })
})
