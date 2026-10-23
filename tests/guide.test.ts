import { describe, expect, it } from 'vitest'
import { adoptDesign, choose, emptyGuide, promote, resolveGuide, unresolvedCount } from '@/core/guide'
import type { Clip, TokenSet } from '@/core/types'
import { BASE_TOKENS, contrastRatio, expandTokens } from '@/core/tokens'

const clip = (id: string, over: Partial<TokenSet>): Clip =>
  ({ id, tokens: { ...BASE_TOKENS, ...over } }) as unknown as Clip

const a = clip('hero.a-x', { 'color.primary': '#FF0000', 'font.display': "'Fraunces', serif", 'radius.base': '2px' })
const b = clip('hero.b-y', { 'color.primary': '#00ff00', 'font.display': 'Fraunces, Georgia', 'radius.base': '20px' })

describe('style guide', () => {
  it('falls back to base tokens when nothing is promoted', () => {
    const g = resolveGuide(emptyGuide())
    expect(g.tokens).toEqual(BASE_TOKENS)
    expect(g.conflicts).toEqual([])
  })

  it('flags conflicting values and lets the latest promotion win', () => {
    let s = promote(emptyGuide(), a, ['color'], 1)
    s = promote(s, b, ['color'], 2)
    const g = resolveGuide(s)
    const c = g.conflicts.find((x) => x.key === 'color.primary')!
    expect(c.options.map((o) => o.value)).toEqual(['#00ff00', '#FF0000'])
    expect(c.resolved).toBe(false)
    expect(g.tokens['color.primary']).toBe('#00ff00')
  })

  it('treats equal values (case, font stack) as one option', () => {
    let s = promote(emptyGuide(), a, ['type'], 1)
    s = promote(s, b, ['type'], 2)
    expect(resolveGuide(s).conflicts.find((c) => c.key === 'font.display')).toBeUndefined()
  })

  it('resolves conflicts with a candidate choice or a custom value', () => {
    let s = promote(promote(emptyGuide(), a, ['color'], 1), b, ['color'], 2)
    s = choose(s, 'color.primary', { kind: 'candidate', candidateId: 'hero.a-x#color' })
    let g = resolveGuide(s)
    expect(g.tokens['color.primary']).toBe('#FF0000')
    expect(unresolvedCount(g)).toBe(0)
    s = choose(s, 'color.primary', { kind: 'custom', value: '#123456' })
    g = resolveGuide(s)
    expect(g.tokens['color.primary']).toBe('#123456')
    expect(g.provenance['color.primary']).toBe('custom')
  })

  it('promoting only type leaves colors alone', () => {
    const s = promote(emptyGuide(), a, ['type'], 1)
    expect(resolveGuide(s).tokens['color.primary']).toBe(BASE_TOKENS['color.primary'])
  })

  it('adoptDesign makes a clip win every token in its groups', () => {
    let s = promote(emptyGuide(), b, ['shape'], 5)
    s = adoptDesign(s, a, ['shape'], 1)
    expect(resolveGuide(s).tokens['radius.base']).toBe('2px')
  })

  it('expands derived scales', () => {
    const v = expandTokens({ ...BASE_TOKENS, 'radius.base': '0px' })
    expect(v['--mx-radius-pill']).toBe('0px')
    expect(v['--mx-space-4']).toBe('16px')
    expect(v['--mx-text-lg']).toBe('20px')
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
  })
})

import { chooseGroup, openGroups } from '@/core/guide'
describe('group decisions', () => {
  it('counts conflicts per group and settles a whole group in one choice', () => {
    let s = promote(promote(emptyGuide(), a, ['color', 'shape'], 1), b, ['color', 'shape'], 2)
    expect(openGroups(resolveGuide(s))).toEqual(['color', 'shape'])
    s = chooseGroup(s, 'hero.a-x#color')
    expect(openGroups(resolveGuide(s))).toEqual(['shape'])
    expect(resolveGuide(s).tokens['color.primary']).toBe('#FF0000')
  })
})
