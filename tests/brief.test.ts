import { beforeEach, describe, expect, it } from 'vitest'
import { actionChoices, briefContext, briefFromKind, briefOf, goalSections, guessBrief, kindOf, patchBrief, FORMATS, INDUSTRIES } from '@/core/brief'
import { contentFor } from '@/core/start'
import { suggestTypes } from '@/core/suggest'
import { composeSite } from '@/core/compose'
import { resolveGuide } from '@/core/guide'
import { packetFiles } from '@/core/export/packet'
import { packetInputFor } from '@/lib/packet'
import { library } from '@/data/library'
import { KINDS } from '@/core/types'
import { runCommand } from '@/state/commands'
import { currentSlots, useStore } from '@/state/store'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

describe('the brief', () => {
  it('derives a kind from every format and industry, and reads one back from every kind', () => {
    for (const f of FORMATS) for (const i of INDUSTRIES) expect(KINDS).toContain(kindOf({ format: f, industry: i }))
    for (const k of KINDS) expect(kindOf(briefFromKind(k))).toBe(k)
    expect(kindOf({ format: 'business', industry: 'food' })).toBe('local')
    expect(kindOf({ format: 'landing', industry: 'events' })).toBe('event')
    expect(kindOf({}, 'writing')).toBe('writing')
  })

  it('guesses from words when suggestions are off', () => {
    const g = guessBrief('A bakery on Elm Street that takes pre-orders, with our menu and hours')
    expect(g.industry).toBe('food')
    expect(g.format).toBe('business')
    expect(g.goals).toContain('orders')
    expect(g.sure).toBe(true)
    expect(guessBrief('').sure).toBe(false)
  })

  it('offers main-button words that fit the goal and industry', () => {
    expect(actionChoices({ goals: ['bookings'], industry: 'food' })[0]).toBe('Book a table')
    expect(actionChoices({ goals: ['bookings'], industry: 'health' })[0]).toBe('Book an appointment')
    expect(actionChoices({ format: 'blog' })[0]).toBe('Subscribe')
    expect(actionChoices({}).length).toBeGreaterThan(0)
  })

  it('says it in one plain sentence', () => {
    const s = briefContext({ brand: 'Fern & Co', brief: { format: 'business', industry: 'food', goals: ['bookings', 'visit'], mainAction: 'Book a table' } })
    expect(s).toBe('Fern & Co: a small business site for food and drink. It should take bookings and get people to visit. Main button: Book a table.')
    expect(briefContext({ brand: 'Fern & Co' })).toBe('Fern & Co')
  })

  it('drops empty values when patched', () => {
    expect(patchBrief({ who: 'locals', goals: ['visit'] }, { who: '', goals: [] })).toEqual({})
  })

  it('ranks the sections its goals lean on first in Add section', () => {
    const slots = [{ type: 'nav' as const }, { type: 'hero' as const }, { type: 'footer' as const }].map((s, i) => ({ ...s, id: `s${i}`, clipId: '', locked: false, keep: {} as never }))
    const plain = suggestTypes(slots, 2)
    const booking = suggestTypes(slots, 2, { goals: ['bookings'] })
    const at = (r: typeof plain) => r.findIndex((t) => t.type === 'contact')
    expect(at(booking)).toBeLessThan(at(plain))
    expect(booking.find((t) => t.type === 'contact')!.reason).toMatch(/Suggested for take bookings/i)
    expect(goalSections({ goals: ['bookings'] })[0]).toBe('contact')
  })
})

describe('the brief on the page', () => {
  it('puts the main button’s words in the buttons, as yours only when typed', () => {
    const picked = contentFor({ kind: 'local', name: 'Fern & Co', brief: { mainAction: 'Order ahead' } }, 2026)
    expect(picked.fields.hero?.ctaPrimary).toBe('Order ahead')
    expect(picked.fields.nav?.cta).toBe('Order ahead')
    expect(picked.mine ?? []).not.toContain('hero.ctaPrimary')
    const typed = contentFor({ kind: 'local', name: 'Fern & Co', brief: { mainAction: 'Grab a loaf', mainActionTyped: true } }, 2026)
    expect(typed.mine).toContain('hero.ctaPrimary')
  })

  it('never lands on the page or in the content files, but reaches the agent', () => {
    const secret = 'Zebra-Quokka-7731'
    useStore.getState().setBrief({ what: secret, who: secret, goalsOther: secret, format: 'business', industry: 'food', goals: ['bookings'] })
    const st = useStore.getState()
    const page = composeSite({ site: st.site, guide: resolveGuide(st.guide), content: st.content, library })
    expect(JSON.stringify(page.sections.map((s) => s.tree))).not.toContain(secret)
    const files = packetFiles(packetInputFor(useStore.getState(), { version: null, targets: ['astro'] }))
    for (const [path, body] of Object.entries(files)) {
      if (path === 'BLOKMIX.md' || path === 'blokmix.json' || typeof body !== 'string') continue
      expect(body, path).not.toContain(secret)
    }
    expect(files['BLOKMIX.md']).toContain('## What this site is for')
    expect(files['BLOKMIX.md']).toContain(secret)
    expect(JSON.parse(files['blokmix.json'] as string).brief.goals).toEqual(['bookings'])
  })
})

describe('brief commands', () => {
  it('sets and reads it in one undo step, and the kind follows', () => {
    runCommand('set_brief', { format: 'blog', industry: 'media', goals: ['subscribers'], main_action: 'Subscribe' })
    const b = runCommand('get_brief', {}) as { format: string; kind: string; in_a_sentence: string }
    expect(b.format).toBe('blog')
    expect(b.kind).toBe('writing')
    expect(b.in_a_sentence).toMatch(/blog or newsletter/)
    expect((runCommand('get_page', {}) as { brief: { format: string } }).brief.format).toBe('blog')
    useStore.temporal.getState().undo()
    expect(briefOf(useStore.getState().content).format).not.toBe('blog')
    expect(currentSlots(useStore.getState()).length).toBeGreaterThan(0)
  })
})
