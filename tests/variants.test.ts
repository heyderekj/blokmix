import { describe, expect, it } from 'vitest'
import { findVariant, VARIANTS, variantsFor } from '@/core/blocks/variants'
import type { BlockKind } from '@/core/types'

const all = Object.entries(VARIANTS) as [BlockKind, NonNullable<(typeof VARIANTS)[BlockKind]>][]

describe('block looks', () => {
  it('have unique ids per kind and say when to use them', () => {
    for (const [kind, list] of all) {
      const ids = list.map((v) => v.id)
      expect(new Set(ids).size, kind).toBe(ids.length)
      for (const v of list) {
        expect(v.label, `${kind}.${v.id}`).toBeTruthy()
        expect(v.hint.length, `${kind}.${v.id}`).toBeGreaterThan(8)
      }
    }
  })

  it('are written only in tokens, so they re-theme under any style guide', () => {
    for (const [kind, list] of all)
      for (const v of list) {
        expect(v.css, `${kind}.${v.id}`).not.toMatch(/#[0-9a-f]{3,8}\b/i)
        expect(v.css, `${kind}.${v.id}`).not.toMatch(/\b(rgba?|hsla?|oklch|lab|lch|hwb)\(/i)
        expect(v.css, `${kind}.${v.id}`).not.toMatch(/transition\s*:\s*all\b|\bease-in\b(?!-)/)
        expect(v.css.split('{').length, `${kind}.${v.id} braces`).toBe(v.css.split('}').length)
      }
  })

  it('offer a range for every kind people restyle', () => {
    const floor: Partial<Record<BlockKind, number>> = { button: 10, link: 6, badge: 6, heading: 8, text: 6, card: 8, image: 3, icon: 5, input: 5, banner: 5 }
    for (const [kind, n] of Object.entries(floor) as [BlockKind, number][]) expect(variantsFor(kind).length, kind).toBeGreaterThanOrEqual(n)
    expect(variantsFor('item')).toBe(variantsFor('card'))
  })

  it('press every filled button with a slight scale', () => {
    for (const id of ['solid', 'soft', 'outline', 'ghost', 'pill', 'inverse', 'gradient', 'raised', 'caps'])
      expect(findVariant('button', id)?.css, id).toContain('scale: 0.97')
  })

  it('flip the words inside an inverse card to the primary’s ink', () => {
    const css = findVariant('card', 'inverse')!.css
    expect(css).toContain('--mx-color-text: var(--b-ink, var(--mx-color-on-primary))')
    expect(css).toContain('background: var(--b-fill, var(--mx-color-primary))')
  })
})
