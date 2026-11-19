import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeRead, needOf, readBrief, readPicks } from '@/core/reader'
import type { Picks } from '@/core/jev/sentence'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { emptyNeed, fakeReader, realReader, startRead } from './helpers/fakeReader'

const TEXT = 'Fern & Co is a sourdough bakery on Elm Street. Warm and handmade, a bit editorial, not corporate. No bookings, walk-ins only. Show our menu and opening hours, but no reviews. We also need an about page that tells how we started.'

const READ = startRead({
  business: { id: 'bakery', words: 'a sourdough bakery on Elm Street' },
  kind: 'local',
  format: 'business',
  industry: 'food',
  name: 'Fern & Co',
  feel: { ids: ['warm', 'editorial'], words: ['Warm and handmade, a bit editorial'], avoid: [], avoid_words: ['corporate'] },
  goals: ['visit'],
  action: { id: 'visit', words: null },
  show: ['menu', 'hours'],
  hide: ['reviews'],
  pages: [{ template: 'about', purpose: 'tells how we started' }],
})

describe('mergeRead', () => {
  it('fills the start’s blanks from a read, your words kept beside the option they mean', () => {
    const picks = readPicks(READ)
    expect(picks.business).toEqual([{ id: 'bakery', words: 'a sourdough bakery on Elm Street' }])
    expect(picks.name).toEqual([{ words: 'Fern & Co' }])
    expect(picks.feel).toEqual([{ id: 'warm', words: 'Warm and handmade, a bit editorial' }])
    expect(picks.goal).toEqual([{ id: 'visit', words: 'find us' }])
    expect(picks.show?.map((p) => p.id)).toEqual(['menu', 'hours'])
  })

  it('wins over keywords and Jev, but never over what you picked yourself', () => {
    const before: Picks = { business: [{ id: 'cafe', words: 'a café' }], feel: [{ id: 'bold', words: 'bold' }], name: [{ words: 'Fern' }] }
    const m = mergeRead(before, READ, ['feel'])
    expect(m.picks.business?.[0].id).toBe('bakery')
    expect(m.picks.name?.[0].words).toBe('Fern & Co')
    expect(m.picks.feel?.[0].id).toBe('bold')
    expect(m.from).toEqual(['business', 'name', 'goal', 'show'])
  })

  it('keeps what was there where the read said nothing, and a null read changes nothing', () => {
    const before: Picks = { business: [{ id: 'cafe', words: 'a café' }], name: [{ words: 'Bean' }] }
    const m = mergeRead(before, startRead({ feel: { ids: ['calm'] } }))
    expect(m.picks.business?.[0].id).toBe('cafe')
    expect(m.picks.name?.[0].words).toBe('Bean')
    expect(m.picks.feel?.[0].id).toBe('calm')
    const none = mergeRead(before, null)
    expect(none.picks).toEqual(before)
    expect(none.from).toEqual([])
  })

  it('reads negation: what to avoid stays out of the feel, and what to leave out leaves the page', () => {
    const m = mergeRead({}, READ)
    expect(m.brief.feel).toEqual(['warm', 'classic'])
    expect(m.avoidWords).toEqual(['corporate'])
    expect(m.kind).toBe('local')
    expect(m.sections).not.toContain('testimonials')
    expect(m.sections).toContain('pricing')
    expect(m.sections).toContain('contact')
    expect(m.brief.goals).toEqual(['visit'])
  })

  it('keeps a section you asked for even when another thing that would make it was left out', () => {
    const m = mergeRead({}, startRead({ business: { id: 'design-studio' }, show: ['work'], hide: ['photos'] }))
    expect(m.sections).toContain('gallery')
  })

  it('brings the extra pages, the tone and the words it couldn’t place', () => {
    const m = mergeRead({}, startRead({ ...READ, tone: 'dark', unsure: ['walk-ins only'], pages: [...READ.pages, { template: 'about', purpose: null }, { template: 'blank', purpose: 'a page for the wholesale menu' }] }))
    expect(m.pages).toEqual([
      { template: 'about', purpose: 'tells how we started' },
      { template: 'blank', purpose: 'a page for the wholesale menu' },
    ])
    expect(m.tone).toBe('dark')
    expect(m.unsure).toEqual(['walk-ins only'])
  })

  it('takes the main button’s words as typed only when you wrote them', () => {
    expect(readBrief(startRead({ action: { id: 'book-table' } }))).toMatchObject({ mainAction: 'Book a table', mainActionTyped: false })
    expect(readBrief(startRead({ action: { words: 'Grab a loaf' } }))).toMatchObject({ mainAction: 'Grab a loaf', mainActionTyped: true })
  })

  it('reads a kind from the format when the business is your own words', () => {
    const m = mergeRead({}, startRead({ business: { words: 'a pottery studio' }, format: 'portfolio', industry: 'agency' }))
    expect(m.picks.business).toEqual([{ words: 'a pottery studio' }])
    expect(m.kind).toBe('studio')
    expect(m.sections).toBeNull()
  })
})

describe('needOf', () => {
  it('turns a need into a page or sections, or nothing when it can’t tell', () => {
    expect(needOf({ ...emptyNeed(), what: 'page', sections: ['gallery', 'gallery'], purpose: 'our weddings' })).toEqual({ what: 'page', template: 'blank', sections: ['gallery'], purpose: 'our weddings' })
    expect(needOf({ ...emptyNeed(), what: 'section' })).toBeNull()
    expect(needOf(emptyNeed())).toBeNull()
  })
})

describe('read_start', () => {
  beforeEach(() => useStore.getState().resetDemo())
  afterEach(() => {
    realReader()
    useStore.getState().setUi({ jev: true })
  })

  it('reads without changing the board', async () => {
    const fake = fakeReader(() => READ)
    const before = JSON.stringify(useStore.getState().site)
    const out = (await runCommand('read_start', { text: TEXT })) as { read: { name: string }; start: { kind: string; pages: unknown[] } }
    expect(out.read.name).toBe('Fern & Co')
    expect(out.start.kind).toBe('local')
    expect(out.start.pages).toHaveLength(1)
    expect(fake.requests[0]).toEqual({ task: 'start', text: TEXT })
    expect(JSON.stringify(useStore.getState().site)).toBe(before)
  })

  it('says why when suggestions are off, there’s no key, or the read wasn’t your words', async () => {
    fakeReader(() => READ)
    useStore.getState().setUi({ jev: false })
    await expect(runCommand('read_start', { text: TEXT })).rejects.toThrow(/Suggestions are off/)
    useStore.getState().setUi({ jev: true })

    fakeReader(() => READ, { off: true })
    await expect(runCommand('read_start', { text: TEXT })).rejects.toThrow(/isn’t available here/)

    fakeReader(() => startRead({ name: 'Fern & Co Artisan Bakery' }))
    await expect(runCommand('read_start', { text: TEXT })).rejects.toThrow(/No answer/)
  })
})
