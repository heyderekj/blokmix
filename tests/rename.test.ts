import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, carryOver, renamedState } from '@/state/store'

/** A Storage stand-in. */
function memory(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('Mixtape is now Blokmix', () => {
  it('reads work saved under the old name, and drops the old copy once saved anew', () => {
    const ls = memory({ 'mixtape:v1': '{"state":{"tapeName":"Launch"}}' })
    const s = carryOver(ls)
    expect(STORAGE_KEY).toBe('blokmix:v1')
    expect(s.getItem(STORAGE_KEY)).toBe('{"state":{"tapeName":"Launch"}}')
    s.setItem(STORAGE_KEY, '{"state":{"mixName":"Launch"}}')
    expect(ls.m.has('mixtape:v1')).toBe(false)
    expect(s.getItem(STORAGE_KEY)).toBe('{"state":{"mixName":"Launch"}}')
  })

  it('calls a saved tape’s name the mix’s name, and keeps the older section rename', () => {
    const p = renamedState({ tapeName: 'Launch page', slots: [{ type: 'proof', clipId: 'proof.puffin-cards' }] })
    expect(p.mixName).toBe('Launch page')
    expect(p).not.toHaveProperty('tapeName')
    expect(JSON.stringify(p.slots)).toContain('testimonials.puffin-cards')
  })
})
