import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentSlots, undo, useStore } from '@/state/store'
import { COMMANDS, type CommandName } from '@/core/commands/schema'
import { INTENTS, sayRequest, sectionByNumber, understand, type IntentId } from '@/core/jev/say'
import { doSay, hear, sayContext } from '@/state/jevSay'
import { fillBar } from '@/core/jev/sentence'
import { resolveGuide } from '@/core/guide'
import { toneOfGuide } from '@/core/dials'
import { surfaceTokens } from '@/core/surface'
import { runCommand } from '@/state/commands'
import type { ChoiceQuestion, JevResponse } from '@/core/jev'
import { answerFor, fakeJev, realJev, type Rule } from './helpers/fakeJev'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})
afterEach(() => realJev())

const key = (type: string) => `s_${currentSlots(useStore.getState()).find((s) => s.type === type)!.id}`

/** Jev "hears" an intent and arguments: by question name, an option (taken at 0.9) or { option, p }. */
const hears = (said: Record<string, string | { option: string; p: number }>): Rule => (name, q) => {
  const base = name.replace(/__r$/, '')
  return q.type === 'choice' ? (said[base] ?? undefined) : undefined
}

describe('Say it', () => {
  it('asks one request: the intent in both orders and every argument, from this page’s real sections', () => {
    const ctx = sayContext()
    const req = sayRequest('FAQ above pricing', ctx)
    expect(Object.keys(req.questions)).toEqual(expect.arrayContaining(['intent', 'intent__r', 'section', 'other', 'above_below', 'dial', 'more_less', 'tone', 'surface', 'section_width', 'section_type', 'skin']))
    expect(Object.keys((req.questions.section as ChoiceQuestion).criteria)).toContain(key('pricing'))
    expect(JSON.stringify(req.state)).toContain('FAQ above pricing')
  })

  it('moves a section above another, as one undo step', async () => {
    fakeJev(hears({ intent: 'move', section: key('testimonials'), other: key('features'), above_below: 'above' }))
    const h = (await hear('testimonials above features'))!
    expect(h.action).toMatchObject({ command: 'move_section', words: 'Move Testimonials above Features' })
    await doSay(h.action!, 'testimonials above features')
    const order = currentSlots(useStore.getState()).map((s) => s.type)
    expect(order.indexOf('testimonials')).toBe(order.indexOf('features') - 1)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('makes the page roomier from where the dial sits', async () => {
    fakeJev(hears({ intent: 'dial', dial: 'spacing', more_less: 'more' }))
    const before = sayContext().dials.spacing
    const h = (await hear('roomier'))!
    expect(h.action).toMatchObject({ command: 'set_dial', input: { dial: 'spacing', value: Math.min(100, before + 15) }, words: 'Roomier' })
  })

  it('lightens a visible dark band even when the page palette is already light, and undoes the edit in one step', async () => {
    const fake = fakeJev(undefined, { off: true })
    const pricing = sayContext().sections.find((s) => s.type === 'pricing')!
    useStore.getState().setSurface(pricing.id, 'inverse')
    useStore.temporal.getState().clear()
    const paintedTone = () => {
      const ctx = sayContext()
      return toneOfGuide(surfaceTokens(resolveGuide(useStore.getState().guide).tokens, ctx.sections.find((s) => s.id === pricing.id)!.surface))
    }
    const ctx = sayContext()
    expect(ctx.tone).toBe('light')
    expect(paintedTone()).toBe('dark')
    const typed = await hear('Make the page light')
    const guided = fillBar({ verb: [{ id: 'make', words: 'Make' }], section: [{ id: 'page', words: 'the page' }], how: [{ id: 'light', words: 'light' }] }, ctx)
    expect(typed.action).toEqual(guided.action)
    expect(typed.action?.command).toBe('set_tone')
    await doSay(typed.action!, 'Make the page light')
    expect(paintedTone()).toBe('light')
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
    undo()
    expect(paintedTone()).toBe('dark')
    expect(fake.requests).toHaveLength(0)
  })

  it('keeps dark and light section commands literal when the page palette is dark', async () => {
    fakeJev(undefined, { off: true })
    await runCommand('set_tone', { tone: 'dark' }, 'you')
    const light = await hear('make pricing light')
    expect(light.action).toMatchObject({ words: 'Pricing → light band', input: { surface: 'inverse' } })
    await doSay(light.action!, 'make pricing light')
    const dark = await hear('make pricing dark')
    expect(dark.action).toMatchObject({ words: 'Pricing → dark band', input: { surface: 'page' } })
  })

  it('asks for a section number when a typed edit would match multiple sections', async () => {
    const fake = fakeJev()
    useStore.getState().addSlot('pricing')
    const sections = sayContext().sections.filter((s) => s.type === 'pricing')
    const ambiguous = await hear('remove pricing')
    expect(ambiguous.action).toBeNull()
    expect(ambiguous.message).toContain('More than one section')
    const specific = await hear(`remove section ${sections[1].position}`)
    expect(specific.action).toMatchObject({ command: 'remove_section', input: { section: sections[1].id }, words: 'Remove Pricing (2)' })
    expect(fake.requests).toHaveLength(0)
  })

  it('reads “the third section” in code, whatever Jev picked', () => {
    const ctx = sayContext()
    expect(sectionByNumber('remove the third section', ctx)).toBe(ctx.sections[2].id)
    expect(sectionByNumber('section 2 dark', ctx)).toBe(ctx.sections[1].id)
    expect(sectionByNumber('make it roomier', ctx)).toBeNull()
  })

  it('offers what you might have meant when it isn’t sure, and never acts on it', async () => {
    fakeJev((name, q) => {
      if (name.startsWith('intent')) return { type: 'choice', choice: 'surface', confidence: 0.3, probabilities: Object.fromEntries(Object.keys((q as ChoiceQuestion).criteria).map((k) => [k, k === 'surface' ? 0.45 : k === 'dress' ? 0.35 : 0.2 / 17])) }
      if (name === 'section') return key('pricing')
      if (name === 'surface') return 'inverse'
      return undefined
    })
    const h = (await hear('pricing pop'))!
    expect(h.action).toBeNull()
    expect(h.options.map((o) => o.words)).toEqual(['Pricing → dark band', 'Background ideas for Pricing'])
  })

  it('finds another layout for “another hero”', async () => {
    fakeJev(hears({ intent: 'swap', section: key('hero') }))
    const h = (await hear('another hero'))!
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    expect(h.action?.command).toBe('swap_section')
    expect(h.action?.input?.clip_id).toMatch(/^hero\./)
    expect(h.action?.input?.clip_id).not.toBe(hero.clipId)
  })

  it('builds only commands that pass their own schema', () => {
    const ctx = sayContext()
    const req = sayRequest('x', ctx)
    const pick: Record<string, string> = { section: key('pricing'), other: key('features'), above_below: 'below', dial: 'type', more_less: 'less', tone: ctx.tone === 'dark' ? 'light' : 'dark', surface: 'brand', section_width: 'wide', section_type: 'faq', skin: ctx.skins[0].id }
    for (const intent of Object.keys(INTENTS) as IntentId[]) {
      const answers = Object.fromEntries(Object.entries(req.questions).map(([n, q]) => [n, answerFor(q, n.startsWith('intent') ? { option: intent, p: 0.95 } : pick[n])]))
      const u = understand({ model: 'x', answers, usage: { input_tokens: 0, output_tokens: 0 } } as JevResponse, 'x', ctx)
      const a = u.action
      if (intent === 'none') {
        expect(a).toBeNull()
        continue
      }
      expect(a, intent).not.toBeNull()
      if (a?.command && a.command !== 'swap_section') expect(COMMANDS[a.command as CommandName].input.safeParse(a.input).success, `${intent} → ${a.command}`).toBe(true)
    }
  })

  it('answers agents too, without changing anything', async () => {
    fakeJev(hears({ intent: 'surface', section: key('pricing'), surface: 'inverse' }))
    const out = (await runCommand('understand', { text: 'make pricing dark' })) as { action: { does: string; command: string } }
    expect(out.action).toMatchObject({ does: 'Pricing → dark band', command: 'set_section_surface' })
    expect(useStore.temporal.getState().pastStates).toHaveLength(0)
  })
})
