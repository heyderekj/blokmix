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

describe('craft suggestions from your customisations', () => {
  const card = (id: string, extra: Partial<BlockInfo> = {}) => b(id, 'card', { parent: 'L', ...extra })
  const list = [b('L', 'list', { parent: null }), card('c1'), card('c2'), card('c3'), b('h', 'heading', { parent: 'c1', field: 'heading' })]

  it('keeps one expressive treatment per section', () => {
    const a = advise({ blocks, edits: { b1: { variant: 'gradient' }, b2: { variant: 'offset' } }, tokens, fields })
    expect(a.find((x) => x.rule === 'expressive')).toMatchObject({ blockId: 'b2', lens: 'IIDS' })
  })

  it('flags display treatments on small headings and cramped filled cards', () => {
    const a = advise({ blocks: list, edits: { h: { variant: 'hollow' }, c1: { variant: 'raised', style: { padding: 1 } } }, tokens, fields })
    expect(a.find((x) => x.rule === 'small-display')?.blockId).toBe('h')
    expect(a.find((x) => x.rule === 'cramped')?.fix?.edit).toEqual({ style: { padding: 4 } })
  })

  it('evens out spacing between siblings, to the common step', () => {
    const a = advise({ blocks: list, edits: { c1: { style: { below: 4 } }, c2: { style: { below: 4 } }, c3: { style: { below: 8 } } }, tokens, fields })
    const r = a.find((x) => x.rule === 'rhythm')!
    expect(r.blockId).toBe('c3')
    expect(r.fix?.edit).toEqual({ style: { below: 4 } })
  })

  it('watches line length on the selected text', () => {
    const t = [b('t', 'text', { parent: null, field: 'body' })]
    const long = { body: 'word '.repeat(60) }
    expect(advise({ blocks: t, edits: { t: {} }, tokens, fields: long, rects: { t: { w: 1100, h: 80 } } }).some((x) => x.rule === 'line-length')).toBe(true)
    expect(advise({ blocks: t, edits: { t: {} }, tokens, fields: long, rects: { t: { w: 560, h: 80 } } }).some((x) => x.rule === 'line-length')).toBe(false)
  })
})

import { gateHover, VARIANTS } from '@/core/blocks/variants'
describe('variant feel', () => {
  it('only hovers where hover is real, and presses with a slight scale', () => {
    expect(gateHover('color: red; &:hover { color: blue; }')).toBe('color: red; @media (hover: hover) and (pointer: fine) { &:hover { color: blue; } }')
    for (const v of Object.values(VARIANTS).flat()) expect(v!.css.replace(/@media \(hover: hover\) and \(pointer: fine\) \{ &:hover/g, '')).not.toMatch(/&:hover/)
    expect(VARIANTS.button!.find((v) => v.id === 'solid')!.css).toContain('scale: 0.97')
  })
})
