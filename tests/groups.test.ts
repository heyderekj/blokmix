import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { DEFAULT_CONTENT } from '@/core/content'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_KEEP, type BlockInfo, type Slot } from '@/core/types'
import { sectionClip } from '@/core/lists'
import { groupName, indexBlocks, upOf } from '@/core/blocks'
import { parseHtml, type HEl } from '@/core/html/parse'
import { serialize } from '@/core/html/serialize'

const layouts = Object.values(library.clips).filter((c) => c.origin === 'layout')
const slotFor = (clipId: string, extra: Partial<Slot> = {}): Slot => ({ id: 's1', type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...extra })
const pageFor = (slots: Slot[]) => composePage({ slots, guide: resolveGuide(emptyGuide()), content: DEFAULT_CONTENT, library })
const chain = (blocks: BlockInfo[], id: string) => {
  const out: string[] = []
  for (let b = blocks.find((x) => x.id === id); b; b = blocks.find((x) => x.id === upOf(b!))) out.push(b.label.split(' · ').at(-1)!)
  return out
}

describe('groups', () => {
  it('never shift a block’s id: blocks are b0, b1… in order, as before groups', () => {
    for (const c of layouts) {
      // Blocks a layout gave its own ids (l1, l2…) take no number.
      const ids = c.blocks.filter((b) => b.kind !== 'group' && !/^l\d+$/.test(b.id)).map((b) => b.id)
      expect(ids, c.id).toEqual(ids.map((_, i) => `b${i}`))
      expect(c.blocks.filter((b) => b.kind === 'group').map((b) => b.id), c.id).toEqual(c.blocks.filter((b) => b.kind === 'group').map((_, i) => `g${i}`))
    }
  })

  it('keep parent and children meaning blocks only', () => {
    for (const c of layouts) {
      const groups = new Set(c.blocks.filter((b) => b.kind === 'group').map((b) => b.id))
      for (const b of c.blocks) {
        expect(groups.has(b.parent ?? ''), `${c.id} ${b.id}`).toBe(false)
        expect(b.children.some((x) => groups.has(x)), `${c.id} ${b.id}`).toBe(false)
      }
    }
  })

  it('are stamped on the section with the ids the library gave them', () => {
    for (const c of layouts) {
      const s = sectionClip(c)
      expect(s.blocks.map((b) => [b.id, b.kind, b.label, b.group ?? null]), c.id).toEqual(c.blocks.map((b) => [b.id, b.kind, b.label, b.group ?? null]))
      const stamped = [...s.html.matchAll(/data-mx-group="([^"]*)" data-mx-b="(g\d+)"/g)].map((m) => m[2])
      expect(stamped, c.id).toEqual(c.blocks.filter((b) => b.kind === 'group').map((b) => b.id))
    }
  })

  it('read a header and a row of buttons off the layout, two blocks or more', () => {
    const blocks = library.clips['hero.layout-bento'].blocks
    const buttons = blocks.find((b) => b.kind === 'group' && b.label === 'Hero · Buttons')!
    expect(buttons).toBeTruthy()
    expect(blocks.filter((b) => b.group === buttons.id).map((b) => b.kind)).toEqual(['button', 'button'])
    // One button alone is not a group.
    const [one] = parseHtml('<div class="actions"><a class="btn" data-mx-block="button" data-mx-field="cta">Go</a></div>') as HEl[]
    expect(groupName(one)).toBeUndefined()
    const many = layouts.filter((c) => c.blocks.some((b) => b.label.endsWith('Header'))).length
    expect(many).toBeGreaterThan(40)
  })

  it('let you climb from a nav link to its item, the list and the section', () => {
    const blocks = library.clips['nav.layout-cells'].blocks
    const link = blocks.find((b) => b.kind === 'link')!
    expect(chain(blocks, link.id)).toEqual(['Link', 'Link 1', 'Links'])
  })

  it('stay out of an export, and a group you changed gets its class', () => {
    const id = 'hero.layout-bento'
    const g = library.clips[id].blocks.find((b) => b.kind === 'group')!
    const s = pageFor([slotFor(id, { edits: { [id]: { [g.id]: { style: { above: 6 } } } } })]).sections[0]
    const html = serialize(s.tree, 'html')
    expect(html).not.toContain('data-mx-group')
    expect(html).toMatch(new RegExp(`class="actions mx-[\\w-]+-${g.id}"`))
    expect(s.blocks.find((b) => b.id === g.id)?.kind).toBe('group')
  })

  it('a group you hide leaves the page, with what’s in it', () => {
    const id = 'hero.layout-bento'
    const g = library.clips[id].blocks.find((b) => b.label === 'Hero · Buttons')!
    const s = pageFor([slotFor(id, { edits: { [id]: { [g.id]: { hidden: true } } } })]).sections[0]
    expect(s.content).not.toHaveProperty('ctaPrimary')
  })

  it('index the same whether or not the markup was stamped', () => {
    for (const c of layouts.slice(0, 40)) {
      const raw = indexBlocks(parseHtml(c.html), c.type)
      const stamped = indexBlocks(parseHtml(sectionClip(c).html), c.type)
      expect(stamped.map((b) => [b.id, b.label]), c.id).toEqual(raw.map((b) => [b.id, b.label]))
    }
  })
})
