import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { editList, sectionClip, extrasOf } from '@/core/lists'
import { addInsert, INSERT_KINDS, removeInsert, insertOf } from '@/core/inserts'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type InsertKind, type Slot } from '@/core/types'

const slotFor = (id: string): Slot => ({ id: 's', type: library.clips[id].type, clipId: id, locked: false, keep: { ...DEFAULT_KEEP } })
const drawn = (s: Slot) => sectionClip(library.clips[s.clipId], s.lists, extrasOf(s))
const add = (s: Slot, kind: InsertKind, after: string) => addInsert(s, drawn(s), kind, after)
const ids = (html: string) => [...html.matchAll(/data-mx-b="([^"]+)"/g)].map((m) => m[1])

/** The first block outside every list item: a heading, a lead, a button… */
const firstLoose = (s: Slot) => {
  const c = drawn(s)
  const inItem = (id: string): boolean => {
    for (let b = c.blocks.find((x) => x.id === id); b; b = c.blocks.find((x) => x.id === b!.parent)) if (b.kind === 'item') return true
    return false
  }
  return c.blocks.find((b) => b.kind !== 'list' && b.kind !== 'item' && !inItem(b.id))
}

describe('adding a blok to any layout', () => {
  const layouts = Object.keys(library.clips).filter((id) => library.clips[id].origin === 'layout' && !library.clips[id].status)
  it.each(INSERT_KINDS)('%s: keeps every layout’s own ids, adds one block with its own, and composes', (kind) => {
    for (const id of layouts) {
      const s = slotFor(id)
      const anchor = firstLoose(s)
      if (!anchor) continue
      const before = drawn(s)
      const out = add(s, kind, anchor.id)
      const after = drawn(out.slot)
      // The layout's own blocks keep their ids; the new blok is there, once.
      for (const b of before.blocks) expect(after.blocks.some((x) => x.id === b.id), `${id} lost ${b.id}`).toBe(true)
      expect(after.blocks.find((b) => b.id === out.blockId)?.kind, id).toBe(kind)
      const all = ids(after.html)
      expect(new Set(all).size, `${id} has duplicate ids`).toBe(all.length)
      // Words for the ones with words, under a field the section knows.
      if (kind !== 'image' && kind !== 'icon') expect(Object.keys(after.fields).length, id).toBeGreaterThan(Object.keys(before.fields).length)
      // A frame gets it as a patch: right after its anchor, or inside the list it sits in.
      expect(after.patches.some((p) => p.html.includes(`data-mx-b="${out.blockId}"`)), id).toBe(true)
      // It composes for export.
      const compose = (x: Slot) => JSON.stringify(composePage({ slots: [x], guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library }).sections[0].tree)
      expect(compose(out.slot).length, id).toBeGreaterThan(compose(s).length)
    }
  })
})

describe('in every item', () => {
  it('a button lands in each feature, numbered per item, and a new item gets one too', () => {
    let s = slotFor('features.layout-grid')
    const c = drawn(s)
    const item = c.blocks.find((b) => b.kind === 'item')!
    const body = c.blocks.find((b) => b.parent === item.id && b.kind === 'text') ?? c.blocks.find((b) => b.parent === item.id)!
    const out = add(s, 'button', body.id)
    s = out.slot
    const fields = Object.keys(drawn(s).fields).filter((f) => /^f\d+Cta$/.test(f))
    expect(fields.length).toBe(c.blocks.filter((b) => b.kind === 'item').length)
    const list = drawn(s).blocks.find((b) => b.kind === 'list')!
    s = editList(s, drawn(s), DEFAULT_CONTENT, { op: 'add', listId: list.id })
    expect(Object.keys(drawn(s).fields).filter((f) => /^f\d+Cta$/.test(f)).length).toBe(fields.length + 1)
  })
})

describe('taking a blok away', () => {
  it('removes it, and only it', () => {
    const s = slotFor('hero.layout-split')
    const anchor = firstLoose(s)!
    const a = add(s, 'badge', anchor.id)
    const b = add(a.slot, 'text', anchor.id)
    const gone = removeInsert(b.slot, insertOf(a.blockId)!)
    expect(drawn(gone).blocks.some((x) => x.id === a.blockId)).toBe(false)
    expect(drawn(gone).blocks.some((x) => x.id === b.blockId)).toBe(true)
    expect(removeInsert(gone, insertOf(b.blockId)!).inserts).toBeUndefined()
  })
})
