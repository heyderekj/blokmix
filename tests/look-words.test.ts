import { beforeEach, describe, expect, it } from 'vitest'
import { readLook, saysAnything } from '@/core/lookWords'
import { readDials } from '@/core/dials'
import { resolveGuide } from '@/core/guide'
import { emptyContract } from '@/core/contract'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

describe('reading a look from your words', () => {
  it('leans toward the feelings said, away from those said with a “not”', () => {
    const r = readLook('warm and handmade, a bit editorial, not corporate')
    expect(r.words).toEqual(expect.arrayContaining(['warm', 'classic']))
    expect(r.avoid).toEqual(['serious'])
  })

  it('reads nudges and tone, never one said with a “not”', () => {
    const r = readLook('cozy, roomier and rounder, dark')
    expect(r.nudges).toEqual(['roomier', 'rounder'])
    expect(r.tone).toBe('dark')
    expect(readLook('calm but not roomier').nudges).toEqual([])
    expect(readLook('bold, not dark').tone).toBeNull()
  })

  it('has nothing to act on in words with no feeling', () => {
    expect(saysAnything(readLook('my bakery website'))).toBe(false)
  })
})

describe('look_from_words', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('puts on the best theme for those feelings, with the nudges, and keeps the words in the brief', () => {
    const before = readDials(resolveGuide(useStore.getState().guide).tokens)
    const out = runCommand('look_from_words', { text: 'playful and bold, roomier' }, 'agent') as { theme: string; nudged: string[] }
    expect(out.theme).toBeTruthy()
    expect(out.nudged).toContain('roomier')
    const st = useStore.getState()
    expect(st.content.brief?.feelWords).toEqual(['playful and bold, roomier'])
    expect(st.content.brief?.feel).toEqual(expect.arrayContaining(['playful', 'bold']))
    expect(readDials(resolveGuide(st.guide).tokens).spacing).toBeGreaterThan(before.spacing)
  })

  it('is one undo step', async () => {
    await new Promise((r) => setTimeout(r, 450))
    const skin = useStore.getState().guide.skin
    runCommand('look_from_words', { text: 'warm and classic, darker' }, 'agent')
    useStore.temporal.getState().undo()
    expect(useStore.getState().guide.skin).toEqual(skin)
  })

  it('leaves nudges out of an area Rules for your agent keeps', () => {
    const before = readDials(resolveGuide(useStore.getState().guide).tokens).spacing
    useStore.getState().setContract({ ...emptyContract(), areas: { ...emptyContract().areas, space: 'keep' } })
    const out = runCommand('look_from_words', { text: 'calm, roomier' }, 'agent') as { nudged: string[] }
    expect(out.nudged).not.toContain('roomier')
    expect(readDials(resolveGuide(useStore.getState().guide).tokens).spacing).toBe(before)
  })

  it('says so when there’s no feeling in it', () => {
    expect(() => runCommand('look_from_words', { text: 'my bakery website' }, 'agent')).toThrow(/No feeling/)
  })
})

describe('keep what you like, mix the rest', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
    runCommand('apply_skin', { skin: 'acoustic' }, 'agent')
  })

  it('leaves the pinned parts as they are and brings the rest from other themes', () => {
    const before = resolveGuide(useStore.getState().guide).tokens
    const out = runCommand('surprise_me', { seed: 7, keep: ['color', 'type'] }, 'agent') as { words: string }
    const after = resolveGuide(useStore.getState().guide).tokens
    for (const k of ['color.primary', 'color.bg', 'color.text', 'font.display', 'font.body'] as const) expect(after[k], k).toBe(before[k])
    expect(out.words).not.toMatch(/^Color from|, color from|type from/i)
    expect(useStore.getState().guide.skin?.id).toBe('remix')
  })

  it('refuses when everything is pinned', () => {
    expect(() => runCommand('surprise_me', { keep: ['color', 'type', 'shape', 'space', 'motion', 'looks', 'sections', 'pictures'] }, 'agent')).toThrow(/Nothing to surprise/)
  })
})
