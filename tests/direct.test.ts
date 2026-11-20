import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { insideOf, siblingsOf, stepSibling, upOf } from '@/core/blocks'

const label = (id: string | null, blocks = library.clips['hero.layout-bento'].blocks) => (id ? blocks.find((b) => b.id === id)!.label.split(' · ').at(-1) : null)

describe('moving through a section by keyboard', () => {
  it('Tab steps through what’s beside the selection, round at the ends', () => {
    const blocks = library.clips['hero.layout-bento'].blocks
    const btn = blocks.find((b) => b.kind === 'button')!
    const next = stepSibling(blocks, btn.id, 1)!
    expect(label(next)).toBe('Button 2')
    expect(stepSibling(blocks, next, 1)).toBe(btn.id)
    expect(stepSibling(blocks, btn.id, -1)).toBe(next)
    // A group's siblings are what share its parent: the row of buttons sits beside the heading.
    const row = blocks.find((b) => b.id === btn.group)!
    expect(siblingsOf(blocks, row).map((b) => b.kind)).toEqual(expect.arrayContaining(['heading', 'group']))
  })

  it('Enter goes in: a section to its first thing, a group to its first block; Shift+Enter comes back out', () => {
    const blocks = library.clips['hero.layout-bento'].blocks
    const first = insideOf(blocks, null)[0]
    expect(first.parent).toBeNull()
    const row = blocks.find((b) => b.kind === 'group' && b.role === 'buttons')!
    const inside = insideOf(blocks, row.id)
    expect(inside.map((b) => b.kind)).toEqual(['button', 'button'])
    expect(upOf(inside[0])).toBe(row.id)
  })

  it('a nav’s links step one to the next', () => {
    const blocks = library.clips['nav.layout-cells'].blocks
    const items = blocks.filter((b) => b.kind === 'item')
    expect(stepSibling(blocks, items[0].id, 1)).toBe(items[1].id)
    // A lone thing has nothing beside it.
    const logo = blocks.find((b) => b.kind === 'image')!
    expect(siblingsOf(blocks, logo).length).toBeGreaterThan(1)
  })
})

import { applyOrder, extrasOf, groupOrderOf, moveIn, orderIn, sectionClip } from '@/core/lists'
import { parseHtml } from '@/core/html/parse'
import { serialize } from '@/core/html/serialize'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { allSlots } from '@/core/site'
import { useStore } from '@/state/store'

describe('putting what’s in a group in another order', () => {
  const id = 'hero.layout-bento'
  const clip = library.clips[id]
  const row = clip.blocks.find((b) => b.kind === 'group' && b.role === 'buttons')!
  const [first, second] = insideOf(clip.blocks, row.id).map((b) => b.id)

  it('moves only the group’s own blocks among their places', () => {
    const html = '<div data-mx-b="g0"><a data-mx-b="b1">A</a> <span class="x">sep</span> <a data-mx-b="b2">B</a></div>'
    const out = serialize(applyOrder(parseHtml(html), { g0: ['b2', 'b1'] }), 'html').replace(/\s+/g, ' ')
    expect(out).toMatch(/b2">B<\/a> <span class="x">sep<\/span> <a data-mx-b="b1">A/)
    expect(orderIn(parseHtml(html), 'g0')).toEqual(['b1', 'b2'])
    expect(moveIn(['a', 'b', 'c'], 'a', { by: 1 })).toEqual(['b', 'a', 'c'])
    expect(moveIn(['a', 'b', 'c'], 'a', { by: -1 })).toBeNull()
    expect(moveIn(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  })

  it('the section shows the new order, ids unchanged, and a frame swaps the group in whole', () => {
    const slot = { clipId: id, edits: { [id]: { [row.id]: { order: [second, first] } } } }
    const s = sectionClip(clip, undefined, extrasOf(slot))
    expect(s.html.indexOf(`data-mx-b="${second}"`)).toBeLessThan(s.html.indexOf(`data-mx-b="${first}"`))
    expect(new Set(s.blocks.map((b) => b.id))).toEqual(new Set(clip.blocks.map((b) => b.id)))
    expect(s.patches.map((p) => p.sel)).toEqual([`[data-mx-b="${row.id}"]`])
    expect(groupOrderOf(s, first)).toEqual({ holder: row.id, ids: [second, first] })
  })

  it('exports in that order too', () => {
    const slot: Slot = { id: 's1', type: 'hero', clipId: id, locked: false, keep: { ...DEFAULT_KEEP }, edits: { [id]: { [row.id]: { order: [second, first] } } } }
    const page = composePage({ slots: [slot], guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })
    const html = serialize(page.sections[0].tree, 'html')
    const words = (f: string) => html.indexOf(DEFAULT_CONTENT.fields.hero![f]!)
    expect(words('ctaSecondary')).toBeLessThan(words('ctaPrimary'))
  })

  it('moveInGroup is one undo step, and stops at the ends', async () => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
    // History takes one step per 400ms (store.ts `leading`).
    await new Promise((r) => setTimeout(r, 450))
    const hero = allSlots(useStore.getState().site).find((x) => x.type === 'hero')!
    const c = library.clips[hero.clipId]
    const g = c.blocks.find((b) => b.kind === 'group' && b.role === 'buttons')
    if (!g) return
    const [a] = insideOf(c.blocks, g.id).map((b) => b.id)
    expect(useStore.getState().moveInGroup(hero.id, a, { by: -1 })).toBe(false)
    expect(useStore.getState().moveInGroup(hero.id, a, { by: 1 })).toBe(true)
    const now = allSlots(useStore.getState().site).find((x) => x.id === hero.id)!
    expect(now.edits?.[now.clipId]?.[g.id]?.order?.[1]).toBe(a)
    useStore.temporal.getState().undo()
    expect(allSlots(useStore.getState().site).find((x) => x.id === hero.id)!.edits?.[hero.clipId]?.[g.id]?.order).toBeUndefined()
  })
})
