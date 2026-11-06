import { afterEach, describe, expect, it } from 'vitest'
import { answer, briefFrom, emptyAnswers, feelFrom, folded, kindFrom, nextQuestion, reopen, sectionsFrom, skipToPages, type HeardBrief } from '@/core/startFlow'
import { recipeFor, RECIPES } from '@/core/start'
import { guessHeard, hearStart } from '@/lib/startFromText'
import { fakeJev, realJev } from './helpers/fakeJev'

afterEach(() => realJev())

const heardBakery: HeardBrief = {
  mode: 'describe',
  jev: true,
  format: 'business',
  formats: ['business'],
  industry: 'food',
  industries: ['food'],
  goals: ['orders'],
  kind: 'local',
  sections: RECIPES.local.home,
  want: {},
  looks: [],
}

describe('the guided start’s questions', () => {
  it('asks one at a time, in order', () => {
    let a = emptyAnswers()
    expect(nextQuestion(a, null)).toBe('name')
    a = answer(a, 'name', { name: 'Mill' })
    expect(nextQuestion(a, null)).toBe('what')
    a = answer(a, 'what', { text: 'something' })
    expect(nextQuestion(a, null)).toBe('confirm')
    for (const q of ['confirm', 'goals', 'action', 'sections', 'look'] as const) a = answer(a, q)
    expect(nextQuestion(a, null)).toBe('drafts')
  })

  it('folds what the first sentence already settled, and asks it again when you open it', () => {
    let a = answer(answer(emptyAnswers(), 'name', { name: 'Mill' }), 'what', { text: 'A bakery that takes pre-orders' })
    expect(folded(a, heardBakery).confirm).toBe('A small business site · Food and drink')
    expect(nextQuestion(a, heardBakery)).toBe('goals')
    a = reopen(a, 'confirm')
    expect(nextQuestion(a, heardBakery)).toBe('confirm')
  })

  it('reads the brief from what was heard, yours on top', () => {
    const a = { ...answer(emptyAnswers(), 'what', { text: 'A bakery that takes pre-orders' }), brief: { industry: 'travel' as const } }
    const b = briefFrom(a, heardBakery)
    expect(b.format).toBe('business')
    expect(b.industry).toBe('travel')
    expect(b.goals).toEqual(['orders'])
    expect(b.what).toBe('A bakery that takes pre-orders')
    expect(kindFrom(a, heardBakery)).toBe('local')
  })

  it('shapes the sections by the format and the goals', () => {
    expect(recipeFor({ format: 'portfolio' }, 'personal')[2]).toBe('gallery')
    expect(recipeFor({ goals: ['bookings'] }, 'product')).toContain('contact')
    const a = { ...emptyAnswers(), brief: { goals: ['tickets' as const] } }
    expect(sectionsFrom(a, null)).toContain('team')
    expect(sectionsFrom({ ...a, sections: ['nav', 'hero', 'footer'] }, null)).toEqual(['nav', 'hero', 'footer'])
  })

  it('starts the feel from the industry', () => {
    expect(feelFrom(emptyAnswers(), heardBakery)).toEqual(['warm', 'playful'])
    expect(feelFrom({ ...emptyAnswers(), feel: ['dark'] }, heardBakery)).toEqual(['dark'])
  })

  it('skips to the pages with every suggestion taken', () => {
    const a = skipToPages(answer(emptyAnswers(), 'what', { text: 'A bakery that takes pre-orders' }), heardBakery)
    expect(nextQuestion(a, heardBakery)).toBe('drafts')
    expect(a.name).toBe('Your site')
    expect(a.brief.mainAction).toBe('Order ahead')
  })

  it('asks the same questions with suggestions off, ranked by keywords', () => {
    const h = guessHeard('A yoga studio taking bookings for classes')
    expect(h.jev).toBe(false)
    expect(h.industry).toBe('health')
    expect(h.goals).toContain('bookings')
  })
})

describe('what the first sentence tells', () => {
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
