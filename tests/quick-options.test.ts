import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { columnsOf, quickOptions, styleRows } from '@/core/blocks/quick'
import { blockCss } from '@/core/blocks/style'
import { sectionClip } from '@/core/lists'
import { allSlots } from '@/core/site'
import type { BlockInfo } from '@/core/types'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

const layouts = Object.values(library.clips).filter((c) => c.origin === 'layout')
const css = (b: BlockInfo, style: object) => blockCss({ blocks: [b], edits: { [b.id]: { style } }, select: (x) => `[data-mx-b="${x.id}"]` })

describe('quick options', () => {
  it('put what you change most on the thing itself, a few at a time', () => {
    for (const c of layouts)
      for (const b of c.blocks) {
        const q = quickOptions(b)
        expect(q.length, `${c.id} ${b.label}`).toBeLessThanOrEqual(6)
        expect(new Set(q).size).toBe(q.length)
      }
    const four = library.clips['features.layout-four-up'].blocks
    expect(quickOptions(four.find((b) => b.kind === 'list')!)).toEqual(['columns', 'gap', 'add'])
    const hero = library.clips['hero.layout-bento'].blocks
    expect(quickOptions(hero.find((b) => b.kind === 'button')!)).toEqual(expect.arrayContaining(['color', 'size', 'words', 'link']))
    expect(quickOptions(hero.find((b) => b.kind === 'heading')!)).toEqual(expect.arrayContaining(['size', 'align', 'words']))
    expect(quickOptions(hero.find((b) => b.role === 'buttons')!)).toEqual(['direction', 'align', 'gap'])
  })

  it('leave out what does nothing for a kind: no fill on a list or a heading', () => {
    const four = library.clips['features.layout-four-up'].blocks
    expect(styleRows(four.find((b) => b.kind === 'list')!)).not.toContain('fill')
    expect(styleRows(four.find((b) => b.kind === 'heading')!)).not.toContain('fill')
    expect(styleRows(four.find((b) => b.kind === 'item')!)).toContain('fill')
  })

  it('know a grid list’s columns as the layout made them', () => {
    const c = sectionClip(library.clips['features.layout-four-up'])
    const list = c.blocks.find((b) => b.kind === 'list')!
    expect(list.grid).toBe(true)
    expect(columnsOf(c.html, list.id)).toBe(4)
  })
})

describe('alignment, columns and direction', () => {
  it('align a heading with its words, and a group with what’s in it', () => {
    const heading: BlockInfo = { id: 'b1', kind: 'heading', parent: null, children: [], label: 'H' }
    expect(css(heading, { align: 'center' })).toMatch(/text-align: center;.*margin-inline: auto;/s)
    const group: BlockInfo = { id: 'g0', kind: 'group', role: 'header', parent: null, children: [], label: 'H' }
    expect(css(group, { align: 'end' })).toContain('[data-mx-b="g0"] :where(.actions, .head, .heading, .lead) { text-align: end; justify-content: flex-end; }')
  })

  it('set a grid list’s columns, two at most on tablets and one on phones; a list off the grid is left alone', () => {
    const list: BlockInfo = { id: 'b4', kind: 'list', grid: true, parent: null, children: [], label: 'L' }
    const out = css(list, { columns: 3 })
    expect(out).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(out).toContain('[data-mx-b="b4"] > * { grid-column: auto; }')
    expect(out).toMatch(/max-width: 1080px\) \{ \[data-mx-b="b4"\] \{ grid-template-columns: repeat\(2/)
    expect(out).toMatch(/max-width: 760px\) \{\s+\[data-mx-b="b4"\] \{ grid-template-columns: minmax\(0, 1fr\); \}/)
    expect(css({ ...list, grid: false }, { columns: 3 })).toBe('')
  })

  it('stack a row of buttons, lined up as it says', () => {
    const row: BlockInfo = { id: 'g1', kind: 'group', role: 'buttons', parent: null, children: [], label: 'B' }
    expect(css(row, { direction: 'column', align: 'center' })).toMatch(/flex-direction: column;.*align-items: var\(--b-align, flex-start\)/s)
  })
})

describe('commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('set_block takes align, columns and direction; get_options says what’s quick', async () => {
    const st = useStore.getState()
    const hero = allSlots(st.site).find((s) => s.type === 'hero')!
    const heading = library.clips[hero.clipId].blocks.find((b) => b.kind === 'heading')!
    await runCommand('set_block', { section: 'hero', block: heading.id, style: { align: 'center' } }, 'agent')
    const now = allSlots(useStore.getState().site).find((s) => s.id === hero.id)!
    expect(now.edits?.[now.clipId]?.[heading.id]?.style?.align).toBe('center')
    const opts = (await runCommand('get_options', { section: 'hero', block: heading.id }, 'agent')) as { quick: string[]; style: string[] }
    expect(opts.quick).toContain('align')
    expect(opts.style).not.toContain('fill')
  })
})
