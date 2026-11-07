import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { layoutOpen, pickable, starterOpen } from '@/core/library'
import { blockEditNeedsPlus, fillNeedsPlus } from '@/core/plan'
import { KINDS, SECTION_TYPES } from '@/core/types'
import { startCandidates } from '@/core/start'
import { allSlots } from '@/core/site'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { useBuySheet } from '@/state/plan'

// What Free leaves out and Plus opens (core/plan.ts, docs/pricing.md).
const free = () => (library.paid = false)
afterEach(() => {
  library.paid = undefined
  useBuySheet.setState({ open: false, what: null })
})

describe('Free’s layouts', () => {
  it('has at least three open layouts of every section type', () => {
    for (const t of SECTION_TYPES) {
      const open = library.layoutsByType[t].filter((id) => library.clips[id].tier === 'free' && !library.clips[id].status)
      expect(open.length, t).toBeGreaterThanOrEqual(3)
    }
  })

  it('offers only those on Free, and every layout with Plus', () => {
    const all = pickable(library, 'hero')
    free()
    const open = pickable(library, 'hero')
    expect(open.length).toBeLessThan(all.length)
    for (const id of open) expect(library.clips[id].origin !== 'layout' || library.clips[id].tier === 'free', id).toBe(true)
    // The Crate still shows the rest, locked.
    expect(pickable(library, 'hero', { locked: true })).toEqual(all)
  })

  it('starts Free mixes only from open layouts, with starters to spare', () => {
    free()
    for (const kind of KINDS)
      for (const seed of [0, 1]) {
        const starts = startCandidates({ kind, name: 'Fern & Co', seed }, library)
        expect(starts.length, `${kind} ${seed}`).toBeGreaterThan(0)
        for (const s of starts) for (const slot of allSlots(s.site)) expect(layoutOpen(library, slot.clipId), `${kind}: ${slot.clipId}`).toBe(true)
      }
    expect(library.starters.filter((s) => starterOpen(library, s)).length).toBeGreaterThanOrEqual(3)
  })
})

describe('what needs Plus', () => {
  it('names block looks and generative pictures, not uploads or simple placeholders', () => {
    expect(blockEditNeedsPlus({ variant: 'outline' })).toBe('A block look')
    expect(blockEditNeedsPlus({ media: { source: 'shader', shader: 'mesh-gradient' } })).toBe('A live shader')
    expect(blockEditNeedsPlus({ media: { source: 'placeholder', style: 'dither' } })).toBe('A generative picture')
    expect(blockEditNeedsPlus({ hidden: true })).toBeNull()
    expect(fillNeedsPlus({ source: 'placeholder', style: 'mesh' })).toBe(false)
    expect(fillNeedsPlus({ source: 'upload' })).toBe(false)
  })
})

describe('on the board', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('opens the buy sheet instead of placing a locked layout', () => {
    free()
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    const locked = pickable(library, 'hero', { locked: true }).find((id) => !layoutOpen(library, id))!
    useStore.getState().setClip(hero.id, locked)
    expect(currentSlots(useStore.getState()).find((s) => s.id === hero.id)!.clipId).toBe(hero.clipId)
    expect(useBuySheet.getState()).toMatchObject({ open: true, what: 'That layout' })
  })

  it('keeps the Feel dials, brand colors and fonts on Free, not the other knobs or effects', () => {
    free()
    const st = useStore.getState
    st().chooseToken('color.primary', { kind: 'custom', value: '#ff0066' })
    expect(st().guide.choices['color.primary']).toBeTruthy()
    st().chooseToken('radius.base', { kind: 'custom', value: '2px' })
    expect(st().guide.choices['radius.base']).toBeUndefined()
    runCommand('set_dial', { dial: 'roundness', value: 90 }, 'you')
    expect(st().guide.choices['radius.base']).toBeTruthy()
    st().setEffect('grain', { id: 'grain' })
    expect(st().guide.effects?.grain).toBeUndefined()
  })

  it('tells an agent what needs Plus, and changes nothing', () => {
    free()
    const before = useStore.getState().guide
    expect(() => runCommand('set_effect', { effect: 'grain' })).toThrow(/needs Plus/)
    expect(useStore.getState().guide).toBe(before)
    expect(useBuySheet.getState().open).toBe(false)
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    const locked = pickable(library, 'hero', { locked: true }).find((id) => !layoutOpen(library, id))!
    expect(() => runCommand('swap_section', { section: hero.id, clip_id: locked })).toThrow(/That layout needs Plus/)
  })

  it('opens everything with Plus', () => {
    const st = useStore.getState
    st().setEffect('grain', { id: 'grain' })
    expect(st().guide.effects?.grain).toBeTruthy()
  })
})
