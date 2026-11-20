import { afterEach, describe, expect, it } from 'vitest'
import { applyRead, becauseLines, briefFrom, changedSection, dropAvoid, emptyStart, sectionsFrom, setBrief, setPicks, startView, type StartState } from '@/core/startFlow'
import { checkRead, keywordRead } from '@/core/reader'
import { fillStart, type Picks } from '@/core/jev/sentence'
import { rankThemes } from '@/core/themeRanking'
import { TYPE_LABEL } from '@/core/content'
import { hearStart } from '@/lib/startFromText'
import { fakeJev, realJev } from './helpers/fakeJev'

afterEach(() => realJev())

const pick = (id: string, words = id) => [{ id, words }]
const bakery: Picks = {
  business: pick('bakery', 'a bakery'),
  name: [{ words: 'Fern & Co' }],
  feel: pick('cozy'),
  goal: pick('order', 'order ahead'),
  show: pick('menu', 'our menu'),
}
const withPicks = (picks: Picks): StartState => setPicks(emptyStart(), picks)

describe('the start, on one screen', () => {
  it('reads the sentence as the brief, the kind and the page', () => {
    const v = startView(withPicks(bakery))
    expect(v.name).toBe('Fern & Co')
    expect(v.kind).toBe('local')
    expect(v.brief.mainAction).toBe('Order ahead')
    expect(v.brief.goals).toEqual(['orders'])
    expect(v.brief.feel).toEqual(['warm'])
    expect(v.sections).toContain('pricing')
    expect(v.brief.what).toBe(fillStart(bakery).text)
  })

  it('works out a page from nothing', () => {
    const v = startView(emptyStart())
    expect(v.kind).toBe('studio')
    expect(v.sections[0]).toBe('nav')
    expect(v.feel.length).toBeGreaterThan(0)
  })

  it('puts your chip changes over everything else', () => {
    let s = applyRead(withPicks({ business: [{ words: 'a bakery' }] }), keywordRead('a bakery that takes bookings'))
    expect(briefFrom(s).industry).toBe('food')
    s = setBrief(s, { industry: 'travel', who: 'Neighbours' })
    expect(briefFrom(s).industry).toBe('travel')
    expect(briefFrom(s).who).toBe('Neighbours')
    expect(sectionsFrom({ ...s, sections: ['nav', 'hero', 'footer'] })).toEqual(['nav', 'hero', 'footer'])
  })

  it('shapes the page by the goals when nothing was asked to show', () => {
    const s = setBrief(emptyStart(), { goals: ['tickets'] })
    expect(sectionsFrom(s)).toContain('team')
  })

  it('puts a map in Contact and a shop in Pricing; a schedule is only noted', () => {
    const f = fillStart({ business: pick('bakery', 'a bakery'), show: [...pick('map', 'a map'), ...pick('shop', 'a shop'), ...pick('schedule', 'the schedule')] })
    expect(f.sections).toEqual(expect.arrayContaining(['contact', 'pricing']))
    expect(f.wants).toEqual(['the schedule'])
  })
})

describe('reading your words', () => {
  const own = 'warm and handmade, a bit editorial, not corporate'

  it('reads feelings and what to steer away from, by keywords, in spans of your words', () => {
    const r = keywordRead(own)
    expect(r.feel.ids).toEqual(['warm', 'earthy', 'editorial'])
    expect(r.feel.avoid).toEqual(['trustworthy'])
    expect(r.feel.avoid_words).toEqual(['corporate'])
    expect(checkRead('start', r, own)).not.toBeNull()
  })

  it('reads a paragraph into every blank it can', () => {
    const text = 'A small sourdough bakery called Crumb & Co in Leeds. Cozy, not fancy. People should order ahead; show our menu and opening hours.'
    const r = keywordRead(text)
    expect(r.business.id).toBe('bakery')
    expect(r.name).toBe('Crumb & Co')
    expect(r.action.id).toBe('order')
    expect(r.show).toEqual(expect.arrayContaining(['menu', 'hours']))
    expect(r.feel.ids).toContain('cozy')
    expect(r.feel.avoid).toContain('elegant')
    expect(checkRead('start', r, text)).not.toBeNull()
    const s = applyRead(emptyStart(), r)
    expect(s.from).toEqual(expect.arrayContaining(['business', 'name', 'goal', 'show']))
    expect(startView(s).kind).toBe('local')
  })

  it('keeps your own words in their blank, counted as what they mean, and changes the look', () => {
    const before = startView(withPicks({ business: pick('bakery', 'a bakery') }))
    const s = applyRead(withPicks({ business: pick('bakery', 'a bakery'), feel: [{ words: own }] }), keywordRead(own), undefined, { blank: 'feel', words: own })
    expect(s.picks.feel).toEqual([{ words: own, id: 'warm' }])
    expect(s.from).toContain('feel')
    const v = startView(s)
    expect(v.brief.feel).toEqual(['warm', 'classic'])
    expect(v.brief.avoid).toEqual(['serious'])
    expect(v.brief.feelWords).toEqual([own])
    expect(rankThemes({ brief: v.brief })[0].skin.id).not.toBe(rankThemes({ brief: before.brief })[0].skin.id)
    expect(dropAvoid(s, 'corporate').avoid).toEqual([])
  })

  it('never overwrites a blank you set, or one you changed while it was reading', () => {
    const asked = { business: [{ words: 'something' }] }
    let s = withPicks({ ...asked, name: [{ words: 'Mine' }] })
    const r = keywordRead('a café called Elsewhere')
    expect(applyRead(s, r).picks.name).toEqual([{ words: 'Mine' }])
    // The business changed after the read was asked for: it stays as you left it.
    s = { ...s, picks: { ...s.picks, business: pick('florist', 'a florist') }, mine: ['name'] }
    expect(applyRead(s, r, asked).picks.business).toEqual(pick('florist', 'a florist'))
    expect(applyRead(s, null)).toBe(s)
  })

  it('steers the theme away from what you said not to be', () => {
    const top = rankThemes({ brief: { feel: ['calm'] } })[0]
    const away = rankThemes({ brief: { feel: ['calm'], avoid: top.skin.feel.filter((f) => f !== 'calm') as never } })[0]
    if (top.skin.feel.some((f) => f !== 'calm')) expect(away.skin.id).not.toBe(top.skin.id)
  })
})

describe('why the page changed', () => {
  it('says what was added and why, from fixed lines', () => {
    const prev = startView(withPicks({ business: pick('bakery', 'a bakery') }))
    const next = startView(withPicks({ business: pick('bakery', 'a bakery'), show: [...pick('menu', 'our menu'), ...pick('schedule', 'the schedule')] }))
    const lines = becauseLines(prev, next, { show: [...pick('menu', 'our menu'), ...pick('schedule', 'the schedule')] })
    expect(lines[0]).toBe(`Added ${TYPE_LABEL.pricing}: you asked for our menu.`)
    expect(lines.join(' ')).toContain('No schedule section yet. Noted.')
    expect(changedSection(prev, next)).toBe('pricing')
    expect(becauseLines(null, next, {})).toEqual([])
  })

  it('names a new look with how it should feel', () => {
    const v = startView(withPicks(bakery))
    expect(becauseLines(v, v, bakery, { prev: 'Paper', next: 'Bakehouse' })).toEqual(['Bakehouse feels warm.'])
  })
})

describe('what a description tells Jev', () => {
  it('reads the format, industry and goals along with the kind', async () => {
    const fake = fakeJev((name) => {
      if (name.startsWith('kind')) return { option: 'local', p: 0.85 }
      if (name.startsWith('format')) return { option: 'business', p: 0.8 }
      if (name.startsWith('industry')) return { option: 'food', p: 0.75 }
      if (name === 'goal_orders') return 0.9
      if (name === 'goal_visit') return 0.7
      if (name.startsWith('goal_')) return 0.1
      return undefined
    })
    const h = await hearStart('A bakery on Elm Street that takes pre-orders')
    expect(h!.format).toBe('business')
    expect(h!.industry).toBe('food')
    expect(h!.goals).toEqual(['orders', 'visit'])
    expect(Object.keys(fake.requests[0].questions).length).toBeLessThanOrEqual(200)
  })
})

describe('a paragraph written into a blank', () => {
  const para = "We're Fern, a small neighborhood bakery in Portland. Sourdough and coffee, made by hand every morning. It should feel warm and handmade, not corporate."
  const read = () => ({ ...keywordRead(para), name: "We're Fern", business: { id: 'bakery' as const, words: 'a small neighborhood bakery in Portland' } })

  it('gives way to what was read from it, marked as read', () => {
    const s = applyRead(withPicks({ business: [{ words: para }] }), read(), undefined, { blank: 'business', words: para, paragraph: true })
    expect(s.picks.business).toEqual([{ id: 'bakery', words: 'a small neighborhood bakery in Portland' }])
    expect(s.from).toContain('business')
    expect(s.mine).not.toContain('business')
    expect(s.picks.name).toEqual([{ words: 'Fern' }])
  })

  it('stays as your words when the read heard nothing for that blank', () => {
    const r = { ...read(), business: { id: null, words: null } }
    const s = applyRead(withPicks({ business: [{ words: para }] }), r, undefined, { blank: 'business', words: para, paragraph: true })
    expect(s.picks.business).toEqual([{ words: para }])
    expect(s.mine).toContain('business')
    expect(s.from).not.toContain('business')
  })
})
