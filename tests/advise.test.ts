import { describe, expect, it } from 'vitest'
import type { BlockInfo, TokenSet } from '@/core/types'
import { BASE_TOKENS } from '@/core/tokens'
import { advise, refToHex, suggestedVariants } from '@/core/advise'

const tokens = { ...BASE_TOKENS, 'color.bg': '#ffffff', 'color.text': '#111111', 'color.primary': '#e2508d', 'color.onPrimary': '#ffffff', 'color.accent': '#ffd400' } as TokenSet
const b = (id: string, kind: BlockInfo['kind'], extra: Partial<BlockInfo> = {}): BlockInfo => ({ id, kind, parent: 'b0', children: [], label: `Hero · ${kind}`, ...extra })
const blocks = [b('b0', 'card', { parent: null }), b('b1', 'heading', { field: 'heading' }), b('b2', 'button', { field: 'ctaPrimary' }), b('b3', 'button', { field: 'ctaSecondary' })]
const fields = { heading: 'Clip the web', ctaPrimary: 'Get started', ctaSecondary: 'Click here' }

describe('advise', () => {
  it('flags two solid buttons side by side and offers outline', () => {
    const a = advise({ blocks, edits: { b2: { variant: 'solid' }, b3: { variant: 'pill' } }, tokens, fields })
    const one = a.find((x) => x.rule === 'one-primary')!
    expect(one.blockId).toBe('b3')
    expect(one.fix?.edit).toEqual({ variant: 'outline' })
  })

  it('flags unreadable text on a fill and suggests the better ink', () => {
    const a = advise({ blocks, edits: { b2: { style: { fill: 'accent', ink: 'bg' } } }, tokens, fields })
    const c = a.find((x) => x.rule === 'contrast')!
    expect(c.level).toBe('problem')
    expect(c.fix?.edit).toEqual({ style: { ink: 'text' } })
  })

  it('passes readable combinations', () => {
    expect(advise({ blocks, edits: { b2: { style: { fill: 'accent', ink: 'text' } } }, tokens, fields }).filter((x) => x.rule === 'contrast')).toEqual([])
  })

  it('asks for labels that say what happens, and comfortable tap targets', () => {
    const a = advise({ blocks, edits: {}, tokens, fields, rects: { b2: { w: 120, h: 30 } } })
    expect(a.find((x) => x.rule === 'label')?.blockId).toBe('b3')
    expect(a.find((x) => x.rule === 'tap-target')?.blockId).toBe('b2')
  })

  it('nudges towards one look when a kind has several one-offs', () => {
    const a = advise({ blocks, edits: { b2: { variant: 'pill' } }, tokens, fields, pageStyles: { button: ['pill', 'outline'] } })
    expect(a.find((x) => x.rule === 'consistency')?.fix?.promote).toBe(true)
  })

  it('mixes tints towards the page colour', () => {
    expect(refToHex('primary/50', tokens, [])).toBe('#f1a8c6')
    expect(refToHex('x:Sunset', tokens, [{ id: 's', name: 'Sunset', value: '#ff7a00' }])).toBe('#ff7a00')
  })

  it('suggests a quieter look for a second button', () => {
    expect(suggestedVariants(blocks[2], { blocks, fields })[0]).toBe('solid')
    expect(suggestedVariants(blocks[3], { blocks, fields })[0]).toBe('outline')
  })
})
