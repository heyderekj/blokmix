import { beforeEach, describe, expect, it } from 'vitest'
import { splitSay } from '@/core/jev/sayParts'
import { doSayParts, hearParts } from '@/state/jevSay'
import { currentSlots, useStore } from '@/state/store'

const known = new Set(['make the hero darker', 'move testimonials to the top', 'roomier', 'add a faq', 'make it black and white'])
const reads = (p: string) => known.has(p.toLowerCase())

describe('splitting a request into edits', () => {
  it('cuts at and, then, commas and semicolons, in the order said', () => {
    expect(splitSay('make the hero darker and move testimonials to the top', reads)).toEqual(['make the hero darker', 'move testimonials to the top'])
    expect(splitSay('Roomier, then add a FAQ; make the hero darker', reads)).toEqual(['Roomier', 'add a FAQ', 'make the hero darker'])
  })

  it('keeps a join inside a part that only reads whole', () => {
    expect(splitSay('make it black and white and roomier', reads)).toEqual(['make it black and white', 'roomier'])
  })

  it('is one request when there is nothing to cut, or a part wouldn’t read', () => {
    expect(splitSay('roomier', reads)).toBeNull()
    expect(splitSay('roomier and make everyone happy', reads)).toBeNull()
  })
})

describe('doing them', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('reads each part on this page and runs them in order', async () => {
    const parts = hearParts('make the hero dark and move testimonials to the top')
    expect(parts?.map((p) => p.action.words)).toEqual(['Hero → dark band', 'Move Testimonials to the top'])
    await new Promise((r) => setTimeout(r, 450))
    await doSayParts(parts!)
    const slots = currentSlots(useStore.getState())
    expect(slots.find((s) => s.type === 'hero')?.surface).toBe('inverse')
    expect(slots.filter((s) => s.type !== 'nav')[0].type).toBe('testimonials')
  })

  it('reads a later part against the page the earlier one left', async () => {
    const parts = hearParts('add a faq and move pricing to the top')
    expect(parts).not.toBeNull()
    await doSayParts(parts!)
    const types = currentSlots(useStore.getState()).map((s) => s.type)
    expect(types).toContain('faq')
    expect(types.filter((t) => t !== 'nav')[0]).toBe('pricing')
  })

  it('undoes as one step', async () => {
    await new Promise((r) => setTimeout(r, 450))
    await doSayParts(hearParts('make the hero dark and move testimonials to the top')!)
    useStore.temporal.getState().undo()
    const slots = currentSlots(useStore.getState())
    expect(slots.find((s) => s.type === 'hero')?.surface).not.toBe('inverse')
    expect(slots.filter((s) => s.type !== 'nav')[0].type).toBe('hero')
  })

  it('leaves a single request to the usual path', () => {
    expect(hearParts('make the hero dark')).toBeNull()
  })
})
