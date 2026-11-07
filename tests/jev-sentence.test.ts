import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KINDS, SECTION_TYPES } from '@/core/types'
import { skinById } from '@/core/skins'
import { COMMANDS } from '@/core/commands/schema'
import {
  BUSINESSES,
  FEELS,
  GOALS,
  SHOWS,
  VERBS,
  PAGE_HOWS,
  SECTION_HOWS,
  BUSINESS_GROUPS,
  FEEL_GROUPS,
  GOAL_GROUPS,
  SHOW_GROUPS,
  START_BLANKS,
  barSentence,
  defaultOrder,
  groupsOf,
  startText,
  suggestedFor,
  fillBar,
  fillStart,
  matchRequest,
  openBlanks,
  rankRequest,
  readMatch,
  readRank,
  sentenceText,
  startSentence,
  type Picks,
} from '@/core/jev/sentence'
import { INTENTS } from '@/core/jev/say'
import { askJev } from '@/lib/jev'
import { useStore } from '@/state/store'
import { sayContext } from '@/state/jevSay'
import { fakeJev, realJev } from './helpers/fakeJev'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})
afterEach(() => realJev())

const pick = (id: string, words?: string) => [{ id, words: words ?? id }]

describe('the vocabularies', () => {
  it('point at real kinds, skins, sections and intents, with no repeated ids', () => {
    for (const list of [BUSINESSES, FEELS, GOALS, SHOWS, VERBS, PAGE_HOWS, SECTION_HOWS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length)
    expect(BUSINESSES.length).toBeGreaterThanOrEqual(55)
    expect(FEELS.length).toBeGreaterThanOrEqual(25)
    for (const b of BUSINESSES) expect(KINDS).toContain(b.kind)
    for (const k of KINDS) expect(BUSINESSES.some((b) => b.kind === k), k).toBe(true)
    for (const f of FEELS) for (const s of f.skins) expect(skinById(s), `${f.id} → ${s}`).toBeTruthy()
    for (const g of GOALS) for (const s of g.sections) expect(SECTION_TYPES).toContain(s)
    for (const s of SHOWS) if (s.section) expect(SECTION_TYPES).toContain(s.section)
    for (const v of [...VERBS, ...PAGE_HOWS, ...SECTION_HOWS]) expect(Object.keys(INTENTS)).toContain(v.intent)
    for (const list of [FEELS, GOALS, SHOWS]) for (const x of list) for (const k of x.kinds ?? []) expect(KINDS).toContain(k)
  })
})

describe('the start sentence', () => {
  it('shows every blank from the start, each saying what it asks for', () => {
    const segs = startSentence({})
    expect(segs.flatMap((s) => ('blank' in s ? [s.blank.id] : []))).toEqual(['business', 'name', 'feel', 'goal', 'show'])
    expect(segs.flatMap((s) => ('blank' in s ? [s.blank.ask] : []))).toEqual(['what it is', 'its name', 'a feeling', 'do what', 'what to show'])
    // Nothing that reads like an answer sits in an empty blank.
    const shown = sentenceText(segs, {})
    for (const example of ['bakery', 'Fern', 'cozy', 'order ahead', 'menu']) expect(shown).not.toContain(example)
  })

  it('says only what’s filled when written out', () => {
    expect(startText({})).toBe('')
    expect(startText({ business: pick('bakery', 'a bakery') })).toBe('I’m making a site for a bakery.')
    expect(startText({ name: [{ words: 'Fern' }], goal: pick('order', 'order ahead') })).toBe('I’m making a site called Fern. It should help people order ahead.')
  })

  it('puts every option in one of its blank’s groups', () => {
    const lists = [
      [BUSINESSES, Object.values(BUSINESS_GROUPS)],
      [FEELS, Object.keys(FEEL_GROUPS)],
      [GOALS, Object.keys(GOAL_GROUPS)],
      [SHOWS, Object.keys(SHOW_GROUPS)],
    ] as const
    for (const [list, groups] of lists) for (const o of list) expect(groups, o.id).toContain(o.group)
    for (const groups of [FEEL_GROUPS, GOAL_GROUPS, SHOW_GROUPS]) {
      const ids = Object.values(groups).flat()
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('groups each blank’s options, and suggests a few once there’s something to go on', () => {
    for (const b of [START_BLANKS.business, START_BLANKS.feel, START_BLANKS.goal, START_BLANKS.show]) {
      expect(groupsOf(b).map((g) => g.name)).toEqual(b.groups)
      expect(suggestedFor(b)).toEqual([])
    }
    expect(suggestedFor(START_BLANKS.goal, undefined, 'event').slice(0, 2).map((g) => g.id)).toEqual(expect.arrayContaining(['tickets']))
    expect(suggestedFor(START_BLANKS.feel, ['dark', 'techy', 'cozy'])[0].id).toBe('dark')
    // Groups follow the order too.
    expect(groupsOf(START_BLANKS.feel, ['dreamy']).find((g) => g.name === 'Soft & playful')!.options[0].id).toBe('dreamy')
  })

  it('fills in the kind, the sections, the looks and the button', () => {
    const picks: Picks = {
      business: pick('bakery', 'a bakery'),
      name: [{ words: 'Fern & Co' }],
      feel: pick('cozy'),
      goal: pick('order', 'order ahead'),
      show: [...pick('menu', 'our menu'), ...pick('hours', 'opening hours'), ...pick('team', 'our team'), ...pick('map', 'a map')],
    }
    const f = fillStart(picks)
    expect(f.kind).toBe('local')
    expect(f.name).toBe('Fern & Co')
    expect(f.sections).toEqual(expect.arrayContaining(['nav', 'hero', 'pricing', 'contact', 'team', 'footer']))
    expect(f.sections!.indexOf('pricing')).toBeLessThan(f.sections!.indexOf('contact'))
    expect(f.looks[0]).toBe('friendly')
    expect(f.button).toBe('Order ahead')
    expect(f.feel).toBe('cozy bakery')
    expect(f.wants).toEqual(['a map'])
    expect(f.text).toBe('I’m making a site for a bakery called Fern & Co. It should feel cozy and help people order ahead. Show our menu, opening hours, our team and a map.')
  })

  it('has no kind for your own words until they’re matched', () => {
    expect(fillStart({ business: [{ words: 'cosy coffee spot' }] }).kind).toBeNull()
    expect(fillStart({ business: [{ words: 'cosy coffee spot', id: 'cafe' }] }).kind).toBe('local')
  })

  it('orders options for the kind of site with Jev off', () => {
    const goals = defaultOrder(GOALS, 'event').map((g) => g.id)
    expect(goals.slice(0, 3)).toEqual(expect.arrayContaining(['tickets', 'rsvp']))
    expect(defaultOrder(GOALS, null)).toEqual(GOALS)
  })
})

describe('the bar’s sentences', () => {
  const sid = (type: string) => `s_${sayContext().sections.find((s) => s.type === type)!.id}`

  it('build the same actions Say it would, and they pass their command’s schema', () => {
    const ctx = sayContext()
    const types = ctx.sections.map((s) => s.type)
    const a = types.find((t) => t !== 'nav' && t !== 'footer' && t !== 'hero')!
    const b = types.filter((t) => t !== 'nav' && t !== 'footer').at(-1)!
    const cases: Picks[] = [
      { verb: pick('make'), section: pick(sid(a)), how: pick('darker') },
      { verb: pick('make'), section: pick(sid(a)), how: pick('full') },
      { verb: pick('make'), section: pick('page'), how: pick('roomier') },
      { verb: pick('make'), section: pick('page'), how: pick('dark') },
      { verb: pick('move'), section: pick(sid(b)), where: pick('above'), other: pick(sid(a)) },
      { verb: pick('move'), section: pick(sid(b)), where: pick('top') },
      { verb: pick('add'), type: pick('faq') },
      { verb: pick('remove'), section: pick(sid(a)) },
      { verb: pick('swap'), section: pick(sid(a)) },
    ]
    for (const p of cases) {
      const { action } = fillBar(p, ctx)
      expect(action, JSON.stringify(p)).toBeTruthy()
      const cmd = COMMANDS[action!.command as keyof typeof COMMANDS]
      expect(cmd, action!.command).toBeTruthy()
      if (action!.command !== 'swap_section') expect(cmd.input.safeParse(action!.input).success, JSON.stringify(action)).toBe(true)
    }
    expect(fillBar({ verb: pick('make'), section: pick(sid(a)), how: pick('darker') }, ctx).action!.input).toEqual({ section: sid(a).slice(2), surface: 'inverse' })
  })

  it('moves a section above another, as picked', () => {
    const ctx = sayContext()
    const body = ctx.sections.filter((s) => s.type !== 'nav' && s.type !== 'footer')
    const last = body.at(-1)!
    const first = body[1]
    const { action } = fillBar({ verb: pick('move'), section: pick(`s_${last.id}`), where: pick('above'), other: pick(`s_${first.id}`) }, ctx)
    expect(action!.command).toBe('move_section')
    expect(action!.input).toEqual({ section: last.id, to: first.position })
  })

  it('opens colors and dress up with the feel’s words', () => {
    const ctx = sayContext()
    const c = fillBar({ verb: pick('colors'), feel: [{ id: 'cozy', words: 'cozy' }] }, ctx)
    expect(c.action!.open).toBe('colors')
    expect(c.text).toBe('cozy')
    const d = fillBar({ verb: pick('dress'), section: pick(sid('hero')), feel: [{ words: 'like a jazz bar' }] }, ctx)
    expect(d.action!.open).toBe('dress')
    expect(d.text).toBe('like a jazz bar')
  })

  it('waits for every blank', () => {
    const ctx = sayContext()
    const p: Picks = { verb: pick('move'), section: pick(sid('hero')), where: pick('above') }
    expect(openBlanks(barSentence(p, ctx), p).map((b) => b.id)).toEqual(['other'])
    expect(fillBar(p, ctx).action).toBeNull()
    expect(sentenceText(barSentence(p, ctx), { ...p, verb: [{ id: 'move', words: 'Move' }], section: [{ words: 'Hero' }] })).toBe('Move Hero above …')
  })
})

describe('Jev on the sentence', () => {
  it('ranks each open blank from the sentence so far, every question carrying the sentence', async () => {
    const fake = fakeJev((name) => (name === 'rank_feel' ? { option: 'cozy', p: 0.6 } : name === 'rank_goal' ? { option: 'order', p: 0.5 } : undefined))
    const picks: Picks = { business: pick('bakery', 'a bakery') }
    const segs = startSentence(picks)
    const open = openBlanks(segs, picks)
    const req = rankRequest(sentenceText(segs, picks), [...open, { id: 'goal', placeholder: 'order ahead', options: GOALS }])
    expect(Object.keys(req.questions)).toEqual(['rank_feel', 'rank_goal', 'rank_show'])
    for (const q of Object.values(req.questions)) expect(JSON.stringify(q.instructions)).toContain('a bakery')
    const order = readRank(await askJev(req), [...open, { id: 'goal', placeholder: 'order ahead', options: GOALS }])
    expect(order.feel[0]).toBe('cozy')
    expect(order.goal[0]).toBe('order')
    expect(fake.requests).toHaveLength(1)
  })

  it('maps your own words to the nearest option, and offers the closest when unsure', async () => {
    fakeJev((name, q) => {
      expect(JSON.stringify(q.instructions)).toContain('cosy coffee spot')
      return name.startsWith('match') ? { option: 'cafe', p: 0.7 } : undefined
    })
    const m = readMatch(await askJev(matchRequest({ id: 'business', placeholder: 'a bakery', options: BUSINESSES }, 'cosy coffee spot')))
    expect(m.id).toBe('cafe')
    expect(m.closest[0]).toBe('cafe')
    fakeJev((name) => (name === 'match' ? { option: 'cafe', p: 0.4 } : name === 'match__r' ? { option: 'bakery', p: 0.4 } : undefined))
    const unsure = readMatch(await askJev(matchRequest({ id: 'business', placeholder: 'a bakery', options: BUSINESSES }, 'cosy coffee spot')))
    expect(unsure.id).toBeNull()
    expect(unsure.closest).toEqual(expect.arrayContaining(['cafe', 'bakery']))
  })
})
