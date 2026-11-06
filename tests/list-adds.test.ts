import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { editList, listContext, listOrder, sectionClip } from '@/core/lists'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot } from '@/core/types'
import { GRID_SPAN_CSS } from '@/core/export/base-css'

const slotFor = (id: string): Slot => ({ id: 's', type: library.clips[id].type, clipId: id, locked: false, keep: { ...DEFAULT_KEEP } })
const run = (s: Slot, op: Parameters<typeof editList>[3]) => editList(s, sectionClip(library.clips[s.clipId], s.lists), DEFAULT_CONTENT, op)
const listOf = (s: Slot) => sectionClip(library.clips[s.clipId], s.lists).blocks.find((b) => b.kind === 'list')!
const itemsOf = (s: Slot) => sectionClip(library.clips[s.clipId], s.lists).blocks.filter((b) => b.parent === listOf(s).id && b.kind === 'item')
const html = (s: Slot) => sectionClip(library.clips[s.clipId], s.lists).html

describe('adding an item', () => {
  it('puts it right after the item you’re on', () => {
    let s = slotFor('features.layout-grid')
    const second = itemsOf(s)[1]
    s = run(s, { op: 'add', listId: listOf(s).id, after: second.id })
    const order = listOrder(sectionClip(library.clips[s.clipId], s.lists), listOf(s).id)
    expect(order.slice(0, 3)).toEqual([1, 2, 7])
  })

  it('shows the item’s controls from anything inside it', () => {
    const s = slotFor('features.layout-grid')
    const c = sectionClip(library.clips[s.clipId])
    const title = c.blocks.find((b) => b.kind === 'heading' && b.parent && c.blocks.find((x) => x.id === b.parent)?.kind === 'item')!
    expect(listContext(c, s, title.id)).toBeNull()
    expect(listContext(c, s, title.id, { within: true })?.item?.kind).toBe('item')
  })

  it('says it’s new, instead of repeating the item it copies', () => {
    let s = slotFor('features.layout-grid')
    s = run(s, { op: 'add', listId: listOf(s).id })
    expect(Object.values(s.words ?? {})).toContain('New feature')
  })

  it('numbers its pictures for itself', () => {
    let s = slotFor('features.layout-bento')
    s = run(s, { op: 'add', listId: listOf(s).id })
    const media = [...html(s).matchAll(/data-mx-media="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(media).size).toBe(media.length)
  })
})

describe('the layout adjusts to the count', () => {
  it('a 4-up with 6 items becomes a 3-up of full rows', () => {
    let s = slotFor('features.layout-four-up')
    s = run(s, { op: 'add', listId: listOf(s).id })
    s = run(s, { op: 'add', listId: listOf(s).id })
    const spans = [...html(s).matchAll(/data-mx-span="(\d+)"/g)].map((m) => m[1])
    expect(spans).toEqual(['4', '4', '4', '4', '4', '4'])
  })

  it('a 2-up with 5 items centres the last one', () => {
    let s = slotFor('features.layout-two-up')
    s = run(s, { op: 'add', listId: listOf(s).id })
    expect(html(s)).toMatch(/data-mx-span="6" data-mx-start="4"/)
  })

  it('back to the layout’s own count, nothing is added', () => {
    let s = slotFor('features.layout-four-up')
    s = run(s, { op: 'add', listId: listOf(s).id })
    s = run(s, { op: 'remove', itemId: itemsOf(s).at(-1)!.id })
    expect(html(s)).not.toMatch(/data-mx-span/)
  })

  it('has the rules to draw it, on wide screens only', () => {
    expect(GRID_SPAN_CSS).toMatch(/@container \(min-width: 953px\)/)
    expect(GRID_SPAN_CSS).toMatch(/data-mx-span="4"\] \{ grid-column: auto \/ span 4; \}/)
  })
})

describe('bento and mosaic', () => {
  it.each(['features.layout-bento', 'features.layout-mosaic'])('%s: a new card takes no one else’s spot', (id) => {
    let s = slotFor(id)
    s = run(s, { op: 'add', listId: listOf(s).id })
    const cards = [...html(s).matchAll(/class="([^"]*)"[^>]*data-mx-block="item"/g)].map((m) => m[1].split(/\s+/))
    const last = cards.at(-1)!
    expect(last.some((c) => /^c\d$/.test(c))).toBe(false)
  })
})

describe('slider layouts', () => {
  // A slider wraps its list, so a rule spacing the head from the list ("+ .row") misses it: the heading then sits on
  // the cards. Every layout with a slider spaces whatever follows its head, or the slider itself.
  const sliders = Object.values(library.clips).filter((c) => c.origin === 'layout' && /data-slider[\s>]/.test(c.html) && /class="[^"]*\b(head|top)\b/.test(c.html))
  it.each(sliders.map((c) => c.id))('%s leaves room between its head and its slider', (id) => {
    const css = library.clips[id].css
    expect(/\.head \+ \*\s*\{[^}]*margin-top|\+ \.slider\s*\{[^}]*margin-top/.test(css) || /\.container\s*\{[^}]*display:\s*grid[^}]*gap/.test(css)).toBe(true)
  })
})
