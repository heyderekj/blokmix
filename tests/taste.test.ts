import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import '@/data/directions'
import { rankDirections } from '@/core/directions'
import { cleanTaste, dropLean, leanOf, noteTaste, passedRefs, TASTE_CAP, tasteWords, traitsFromWords, type Taste } from '@/core/taste'
import { groupOf, OPENERS, TRAIT_GROUPS, traitsOf, type Trait } from '@/core/traits'
import { applySkin, themeList } from '@/core/skins'
import { emptyGuide } from '@/core/guide'
import { pickable } from '@/core/library'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

describe('traits', () => {
  it('every theme on every opener answers each question once', () => {
    const heroes = pickable(library, 'hero').filter((id) => library.clips[id].origin === 'layout')
    for (const skin of themeList()) {
      const guide = applySkin(emptyGuide(), skin)
      for (const hero of heroes) {
        const traits = traitsOf(guide, ['nav.layout-simple', hero, 'features.layout-grid', 'footer.layout-columns'], library, { feel: skin.feel })
        for (const g of ['tone', 'heading', 'corners', 'pictures', 'motion', 'odd'] as const) expect(traits.filter((t) => groupOf(t) === g), `${skin.id} ${hero} ${g}`).toHaveLength(1)
        expect(traits.filter((t) => groupOf(t) === 'opener').length).toBeLessThanOrEqual(1)
      }
    }
  })
  it('reads openers and pictures from the layouts', () => {
    const guide = applySkin(emptyGuide(), themeList()[0])
    expect(traitsOf(guide, ['hero.layout-split'], library)).toContain('opener:split')
    expect(traitsOf(guide, ['hero.layout-backdrop'], library)).toContain('picture-led')
    expect(OPENERS.every((o) => TRAIT_GROUPS.opener.includes(`opener:${o}`))).toBe(true)
  })
})

describe('taste from words', () => {
  it('reads toward and away, a clause at a time', () => {
    expect(traitsFromWords('warmer, not corporate')).toMatchObject({ more: ['warm'], less: ['serious'] })
    const dark = traitsFromWords('dark and moody but not too bold')
    expect(dark.more).toContain('dark')
    expect(dark.less).toEqual(expect.arrayContaining(['light', 'bold']))
    expect(traitsFromWords('a bit editorial, lots of photos').more).toEqual(expect.arrayContaining(['serif', 'picture-led']))
    expect(traitsFromWords('hello there')).toEqual({ more: [], less: [] })
  })
})

describe('the lean', () => {
  it('weighs what you said over what you passed on, newest first, capped', () => {
    let t: Taste = noteTaste(undefined, { kind: 'passed', traits: ['dark'], source: 'you' }, { kind: 'more', traits: ['warm'], source: 'you' })
    expect(leanOf(t).warm).toBeGreaterThan(-leanOf(t).dark!)
    t = noteTaste(t, { kind: 'less', traits: ['warm'], source: 'you' })
    expect(leanOf(t).warm).toBeLessThan(0)
    for (let i = 0; i < 80; i++) t = noteTaste(t, { kind: 'kept', traits: ['calm'], source: 'you' })
    expect(t.events).toHaveLength(TASTE_CAP)
  })
  it('counts an agent’s word for less than yours, and the brief’s feel as a standing lean', () => {
    const you = leanOf(noteTaste(undefined, { kind: 'more', traits: ['bold'], source: 'you' })).bold!
    const agent = leanOf(noteTaste(undefined, { kind: 'more', traits: ['bold'], source: 'agent' })).bold!
    expect(agent).toBeLessThan(you)
    expect(leanOf(undefined, { feel: ['classic'] }).classic).toBeGreaterThan(0)
  })
  it('drops one lean, says the rest in words, and cleans what it reads', () => {
    const t = noteTaste(undefined, { kind: 'more', traits: ['warm', 'serif'], source: 'you' }, { kind: 'less', traits: ['dark'], source: 'you' })
    expect(tasteWords(leanOf(t))).toBe('Leaning warm, serif headings. Less dark.')
    expect(leanOf(dropLean(t, 'warm')).warm).toBeUndefined()
    expect(cleanTaste({ events: [{ kind: 'shout', traits: ['warm'] }, { kind: 'more', traits: ['warm', 'nope'], source: 'x', at: 1 }] })).toEqual({ events: [{ kind: 'more', traits: ['warm'], source: 'you', at: 1 }] })
    expect(passedRefs(noteTaste(undefined, { kind: 'passed', traits: [], ref: 'ledger', source: 'you' }))).toEqual(['ledger'])
  })
})

describe('taste commands', () => {
  it('note, read, drop and clear, each one undo step, shared by every draft', () => {
    const out = runCommand('note_taste', { words: 'warmer, not corporate' }, 'you') as { line: string }
    expect(out.line).toMatch(/Leaning warm/)
    expect(useStore.getState().content.taste?.words).toBe('warmer, not corporate')
    runCommand('new_draft', { open: true }, 'you')
    expect(useStore.getState().content.taste?.events.length).toBeGreaterThan(0)
    runCommand('drop_taste', { trait: 'warm' }, 'you')
    expect((runCommand('get_taste', {}) as { lean: Record<string, number> }).lean.warm).toBeUndefined()
    useStore.temporal.getState().undo()
    expect((runCommand('get_taste', {}) as { lean: Record<string, number> }).lean.warm).toBeGreaterThan(0)
    runCommand('clear_taste', {}, 'you')
    expect(useStore.getState().content.taste).toBeUndefined()
  })
  it('suggests a row that moves with what you say', () => {
    const plain = runCommand('suggest_directions', { count: 4 }) as { directions: { id: string }[] }
    const dark = runCommand('suggest_directions', { count: 4, words: 'dark, moody and techy' }) as { directions: { id: string; traits: string[] }[]; leaning: string }
    expect(dark.leaning).toMatch(/dark/)
    expect(dark.directions[0].traits).toContain('dark')
    expect(dark.directions.map((d) => d.id)).not.toEqual(plain.directions.map((d) => d.id))
    const reacted = runCommand('note_taste', { ref: dark.directions[0].id, reaction: 'more' }, 'agent') as { events: number }
    expect(reacted.events).toBe(1)
  })
})

describe('a person with a hidden preference', () => {
  // They like warm, serif, picture-led pages and say so only by reacting: "More like this" on the card that's
  // closest, "Not this" on the rest.
  const wants: Trait[] = ['warm', 'serif', 'picture-led']
  const input = { kind: 'product' as const, name: 'Loop', brief: { industry: 'saas' as const } }
  const match = (traits: Trait[]) => wants.filter((w) => traits.includes(w)).length

  it('gets rows closer to it, round by round', () => {
    const blind = rankDirections({ input, lib: library, count: 3 })
    let taste: Taste | undefined
    let row = blind
    for (let round = 0; round < 3; round++) {
      const best = [...row].sort((a, b) => match(b.traits) - match(a.traits))[0]
      taste = noteTaste(
        taste,
        { kind: 'more', traits: best.traits.filter((t) => wants.includes(t)), ref: best.direction.id, source: 'you' },
        ...row.filter((r) => r !== best).map((r) => ({ kind: 'less' as const, traits: r.traits.filter((t) => !wants.includes(t)), ref: r.direction.id, source: 'you' as const })),
      )
      row = rankDirections({ input, lib: library, count: 3, taste })
    }
    const score = (r: typeof row) => r.filter((x) => !x.stretch).reduce((n, x) => n + match(x.traits), 0) / r.filter((x) => !x.stretch).length
    expect(score(row)).toBeGreaterThan(score(blind))
    expect(match(row[0].traits)).toBe(wants.length)
  })
})
