import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { editList, listOrder, nextNumber, sectionClip, tileNeighbor } from '@/core/lists'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { indexBlocks } from '@/core/blocks'
import { parseHtml } from '@/core/html/parse'

const clip = (id: string) => library.clips[id]

describe('lists', () => {
  it('finds what each list is numbered by, and leaves unnumbered or split lists fixed', () => {
    const keys = (id: string) => sectionClip(clip(id)).blocks.filter((b) => b.kind === 'list').map((b) => b.listKey ?? null)
    expect(keys('features.layout-grid')).toEqual(['f'])
    expect(keys('faq.layout-accordion')).toEqual(['faq'])
    expect(keys('pricing.layout-tiers')).toEqual(['t', 't1F', 't2F', 't3F'])
    expect(keys('footer.layout-columns')).toEqual(['col', 'col1L', 'col2L', 'col3L'])
    expect(keys('contact.layout-cards')).toEqual([null]) // email, phone, address
    expect(keys('nav.layout-centered')).toEqual([null, null]) // one list split in two
  })

  it('keeps the clip’s own ids and blocks when nothing changed', () => {
    for (const c of Object.values(library.clips)) {
      const s = sectionClip(c)
      expect(s.blocks.map((b) => [b.id, b.kind, b.label]), c.id).toEqual(c.blocks.map((b) => [b.id, b.kind, b.label]))
      expect(s.fields, c.id).toEqual(c.fields)
      expect(s.patches).toEqual([])
    }
  })

  it('swaps two items like sliding tiles: they trade places, nothing else moves', () => {
    const c = clip('features.layout-grid')
    const base = sectionClip(c)
    const list = base.blocks.find((b) => b.kind === 'list')!
    const items = base.blocks.filter((b) => b.parent === list.id && b.kind === 'item')
    const slot: Slot = { id: 's', type: c.type, clipId: c.id, locked: false, keep: { ...DEFAULT_KEEP } }
    const next = editList(slot, base, DEFAULT_CONTENT, { op: 'swap', itemId: items[0].id, withId: items[3].id })
    const order = listOrder(sectionClip(c, next.lists), list.id)
    const first = listOrder(base, list.id)
    expect(order).toEqual([first[3], first[1], first[2], first[0], ...first.slice(4)])
    expect(() => editList(slot, base, DEFAULT_CONTENT, { op: 'swap', itemId: items[0].id, withId: list.id })).toThrow()
  })

  it('finds the tile beside, above and below by where items sit, not their order', () => {
    // A 3-across grid: a b c / d e f
    const r = (x: number, y: number) => ({ x, y, w: 100, h: 80 })
    const rects = { a: r(0, 0), b: r(120, 0), c: r(240, 0), d: r(0, 100), e: r(120, 100), f: r(240, 100) }
    const ids = Object.keys(rects)
    expect(tileNeighbor(rects, ids, 'b', 'down')).toBe('e')
    expect(tileNeighbor(rects, ids, 'e', 'up')).toBe('b')
    expect(tileNeighbor(rects, ids, 'e', 'left')).toBe('d')
    expect(tileNeighbor(rects, ids, 'e', 'right')).toBe('f')
    expect(tileNeighbor(rects, ids, 'a', 'left')).toBeNull()
    expect(tileNeighbor(rects, ids, 'c', 'up')).toBeNull()
    // A stack: only up and down.
    const stack = { p: { x: 0, y: 0, w: 600, h: 50 }, q: { x: 0, y: 60, w: 600, h: 50 } }
    expect(tileNeighbor(stack, ['p', 'q'], 'p', 'down')).toBe('q')
    expect(tileNeighbor(stack, ['p', 'q'], 'p', 'right')).toBeNull()
  })

  it('keeps what only the first item has (a wide tile, an open answer) with the first position', () => {
    // The team bento's first member is the wide one; its members' art differs, which travels with each member.
    const moved = sectionClip(clip('team.layout-bento'), { m: [{ n: 2 }, { n: 3 }, { n: 4 }, { n: 1 }] })
    expect(moved.html.indexOf('m2Name')).toBeLessThan(moved.html.indexOf('m1Name'))
    const lis = [...moved.html.matchAll(/<(?:li|article|div)[^>]*data-mx-block="item"[^>]*>/g)].map((m) => m[0])
    expect(lis[0]).toContain('feature')
    expect(lis.slice(1).some((t) => /class="[^"]*feature/.test(t))).toBe(false)
    const faq = sectionClip(clip('faq.layout-compact'), { faq: [{ n: 2 }, { n: 1 }, { n: 3 }] })
    expect([...faq.html.matchAll(/<details[^>]*>/g)].map((m) => /\bopen\b/.test(m[0]))).toEqual([true, false, false])
  })

  it('reorders, removes and adds items, renumbering copies and keeping ids stable', () => {
    const c = clip('faq.layout-accordion')
    const base = sectionClip(c)
    const list = base.blocks.find((b) => b.kind === 'list')!
    expect(listOrder(base, list.id)).toEqual([1, 2, 3, 4, 5, 6])
    const s = sectionClip(c, { faq: [{ n: 3 }, { n: 1 }, { n: 7, from: 2 }] })
    expect(listOrder(s, list.id)).toEqual([3, 1, 7])
    expect(s.fields.faq7Q).toBe(c.fields.faq2Q) // copied from item 2
    expect(s.fields.faq2Q).toBeUndefined()
    const items = s.blocks.filter((b) => b.parent === list.id)
    const orig3 = base.blocks.find((b) => b.n === 3 && b.parent === list.id)!
    expect(items[0].id).toBe(orig3.id)
    expect(items[2].id).toMatch(/^b\d+\.faq7$/)
    expect(items.map((b) => b.label.split(' · ').at(-1))).toEqual(['Item 1', 'Item 2', 'Item 3'].map((l) => l.replace('Item', items[0].label.split(' · ').at(-1)!.replace(/ \d+$/, ''))))
    expect(s.patches).toHaveLength(1)
    expect(s.patches[0].sel).toBe(`[data-mx-b="${list.id}"]`)
    expect(nextNumber(s, 'faq', [3, 1, 7])).toBe(8)
  })

  it('copies nested lists with their item: a new plan brings its own features', () => {
    const c = clip('pricing.layout-tiers')
    const s = sectionClip(c, { t: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }] })
    expect(s.fields.t4Name).toBe(c.fields.t1Name)
    expect(s.fields.t4F1).toBe(c.fields.t1F1)
    const nested = s.blocks.filter((b) => b.listKey === 't4F')
    expect(nested).toHaveLength(1)
    // …and that plan's features can change on their own.
    const t = sectionClip(c, { t: [{ n: 1 }, { n: 4 }], t4F: [{ n: 2 }] })
    expect(Object.keys(t.fields).filter((f) => /^t4F/.test(f))).toEqual(['t4F2'])
    expect(new Set(t.blocks.map((b) => b.id)).size).toBe(t.blocks.length)
  })

  it('moves a marquee’s mirrored copy with its list', () => {
    const c = clip('logos.layout-marquee')
    const s = sectionClip(c, { logo: [{ n: 2 }, { n: 1 }, { n: 9 }] })
    const mirrors = [...s.html.matchAll(/data-mx-mirror="(logo\d+)"/g)].map((m) => m[1])
    expect(mirrors).toEqual(['logo2', 'logo1', 'logo9'])
    expect(s.patches.map((p) => p.sel)).toContain(`[data-mx-set="${s.blocks.find((b) => b.kind === 'list')!.id}"]`)
  })

  it('indexes stamped trees by their stamps', () => {
    const blocks = indexBlocks(parseHtml('<section data-mx-section="hero"><h1 data-mx-block="heading" data-mx-b="b9.f2" data-mx-field="f2Title">x</h1></section>'), 'hero')
    expect(blocks[0].id).toBe('b9.f2')
  })
})
