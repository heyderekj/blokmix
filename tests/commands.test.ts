import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { runCommand, tools } from '@/state/commands'

// The checklist lays the page out in hidden frames; here a fake layout stands in, per width.
const measured = vi.hoisted(() => ({ calls: [] as number[] }))
vi.mock('@/lib/measure', async (orig) => {
  const real = await orig<typeof import('@/lib/measure')>()
  return {
    ...real,
    measurePage: vi.fn(async (width: number) => {
      measured.calls.push(width)
      const { useStore } = await import('@/state/store')
      const { slotClip } = await import('@/data/library')
      const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
      const btn = slotClip(hero).blocks.find((b) => b.kind === 'button')!
      // The hero's button is a comfortable size on desktop and too small on a phone.
      return { [hero.id]: { [btn.id]: { x: 0, y: 0, w: 140, h: width === 390 ? 30 : 48 } } }
    }),
  }
})

type Page = { sections: { id: string; type: string; blocks: { id: string; kind: string; label: string; look: string | null; style: Record<string, unknown> | null }[] }[] }

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

describe('commands', () => {
  it('describes every command as a tool with a JSON schema', () => {
    const t = tools()
    expect(t.map((x) => x.name)).toContain('set_block')
    for (const x of t) expect(x.input_schema.type).toBe('object')
  })

  it('reads the page with labelled blocks', () => {
    const page = runCommand('get_page', {}) as Page
    expect(page.sections[0].type).toBe('nav')
    expect(page.sections.find((s) => s.type === 'hero')!.blocks.some((b) => b.kind === 'heading')).toBe(true)
  })

  it('changes a block by label, as one undo step', () => {
    const hero = (runCommand('get_page', { section: 'hero' }) as Page).sections[0]
    const btn = hero.blocks.find((b) => b.kind === 'button')!
    runCommand('set_block', { section: 'hero', block: btn.label, look: 'outline', style: { fill: 'accent', padding: 4 } })
    const after = (runCommand('get_page', { section: 'hero' }) as Page).sections[0].blocks.find((b) => b.id === btn.id)!
    expect(after.look).toBe('outline')
    expect(after.style).toEqual({ fill: 'accent', padding: 4 })
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)
    useStore.temporal.getState().undo()
    const undone = (runCommand('get_page', { section: 'hero' }) as Page).sections[0].blocks.find((b) => b.id === btn.id)!
    expect(undone.look).toBeNull()
  })

  it('explains bad input instead of guessing', () => {
    expect(() => runCommand('set_block', { section: 'hero', block: 'b0', look: 'sparkly' })).toThrow(/Looks:/)
    expect(() => runCommand('set_block', { section: 'nope', block: 'b0' })).toThrow(/No section/)
    expect(() => runCommand('set_words', { section: 2, words: { nope: 'x' } })).toThrow(/Fields:/)
    expect(() => runCommand('launch_rockets', {})).toThrow(/Unknown command/)
  })

  it('adds sections where they fit, edits words and spacing, and sets page-wide looks', () => {
    const added = runCommand('add_section', { type: 'faq', at: 4 }) as { id: string; position: number }
    expect(added.position).toBe(5)
    runCommand('set_words', { section: added.id, words: { heading: 'Questions, answered' } })
    runCommand('set_section_spacing', { section: added.id, top: 'tight' })
    runCommand('set_look_for_all', { kind: 'button', look: 'pill' })
    const s = useStore.getState()
    const faq = currentSlots(s).find((x) => x.id === added.id)!
    expect(faq.words?.heading).toBe('Questions, answered')
    expect(faq.spacing).toEqual({ top: 'tight' })
    expect(s.guide.components?.button?.variant).toBe('pill')
  })

  it('suggests options and reviews against the checklist', () => {
    const opts = runCommand('get_options', { at: 2 }) as { types: { type: string; reason: string }[] }
    expect(opts.types[0].reason.length).toBeGreaterThan(0)
  })
})

describe('mobile commands', () => {
  type Block = Page['sections'][0]['blocks'][0] & { hidden: boolean; mobile: { style?: Record<string, number>; hidden?: boolean } | null }
  const heroBlocks = () => (runCommand('get_page', { section: 'hero' }) as { sections: { blocks: Block[]; spacing: unknown }[] }).sections[0]

  it('set_block sets phone spacing and hiding, as one undo step, and get_page reports it', () => {
    const btn = heroBlocks().blocks.find((b) => b.kind === 'button')!
    const steps = useStore.temporal.getState().pastStates.length
    runCommand('set_block', { section: 'hero', block: btn.id, style: { padding: 4 }, mobile: { style: { padding: 2 }, hidden: true } })
    expect(useStore.temporal.getState().pastStates.length).toBe(steps + 1)
    let b = heroBlocks().blocks.find((x) => x.id === btn.id)!
    expect(b.style).toEqual({ padding: 4 })
    expect(b.mobile).toEqual({ style: { padding: 2 }, hidden: true })
    expect(b.hidden).toBe(false)
    // Phone values merge; null goes back to desktop; a value that matches desktop falls away.
    runCommand('set_block', { section: 'hero', block: btn.id, mobile: { style: { below: 6, padding: null }, hidden: false } })
    expect(heroBlocks().blocks.find((x) => x.id === btn.id)!.mobile).toEqual({ style: { below: 6 } })
    runCommand('set_block', { section: 'hero', block: btn.id, mobile: { style: { below: null, padding: 4 } } })
    expect(heroBlocks().blocks.find((x) => x.id === btn.id)!.mobile).toBeNull()
    runCommand('set_block', { section: 'hero', block: btn.id, mobile: { hidden: true } })
    runCommand('set_block', { section: 'hero', block: btn.id, mobile: null })
    b = heroBlocks().blocks.find((x) => x.id === btn.id)!
    expect(b.mobile).toBeNull()
  })

  it('set_section_spacing takes phone spacing', () => {
    runCommand('set_section_spacing', { section: 'hero', top: 'roomy', mobile: { top: 'tight', bottom: 'none' } })
    expect(heroBlocks().spacing).toEqual({ top: 'roomy', mobile: { top: 'tight', bottom: 'none' } })
    runCommand('set_section_spacing', { section: 'hero', mobile: { bottom: null } })
    expect(heroBlocks().spacing).toEqual({ top: 'roomy', mobile: { top: 'tight' } })
    // Back to the clip's own padding on phones only.
    runCommand('set_section_spacing', { section: 'hero', mobile: { top: 'default' } })
    expect(heroBlocks().spacing).toEqual({ top: 'roomy', mobile: { top: 'default' } })
    runCommand('set_section_spacing', { section: 'hero', mobile: null })
    expect(heroBlocks().spacing).toEqual({ top: 'roomy' })
  })

  it('review measures at both widths and says which', async () => {
    measured.calls = []
    type Item = { section: string; rule: string; at: number; message: string }
    const all = (await runCommand('review', { section: 'hero' })) as Item[]
    expect(measured.calls.sort((a, b) => a - b)).toEqual([390, 1280])
    const tap = all.filter((a) => a.rule === 'tap-target')
    expect(tap.map((a) => a.at)).toEqual([390])
    expect(tap[0].message).toMatch(/^At 390px/)
    // Advice that reads the same at both widths comes once, at desktop.
    expect(all.filter((a) => a.at === 390).every((a) => !all.some((d) => d.at === 1280 && d.message === a.message && d.rule === a.rule))).toBe(true)
    measured.calls = []
    const desk = (await runCommand('review', { section: 'hero', widths: ['desktop'] })) as Item[]
    expect(measured.calls).toEqual([1280])
    expect(desk.every((a) => a.at === 1280)).toBe(true)
  })
})

describe('note commands', () => {
  type Marks = { guidance: string; marks: { number: string; kind: string; status: string; on: string; suggestedCopy: string | null; replies: unknown[] }[] }

  it('leave, list, progress and reply on marks, most important first', () => {
    runCommand('add_note', { kind: 'nit', text: 'Calmer', section: 'pricing' })
    const m = runCommand('add_note', { kind: 'must-fix', text: 'Say what happens', section: 'hero', block: 'Hero · Button', suggested_copy: 'Start your mix' }) as { number: string; on: string }
    expect(m.on).toBe('Hero · Button')
    const list = runCommand('list_notes', {}) as Marks
    expect(list.marks[0].kind).toBe('must-fix')
    expect(list.guidance).toMatch(/must-fix first/)
    runCommand('update_note', { note: m.number, status: 'resolved', resolution: 'Relabelled' })
    runCommand('reply_note', { note: m.number, text: 'Used the suggested copy' })
    const done = (runCommand('list_notes', { status: 'resolved' }) as Marks).marks[0]
    expect(done.replies).toHaveLength(1)
  })

  it('never lets an agent verify or touch a keep', () => {
    const keep = runCommand('add_note', { kind: 'keep', text: 'Love the plate', section: 'hero' }) as { number: string; status: string }
    expect(keep.status).toBe('verified')
    expect(() => runCommand('update_note', { note: keep.number, status: 'resolved' })).toThrow(/Love this/)
    expect(() => runCommand('update_note', { note: 'N1', status: 'verified' })).toThrow(/Invalid input/)
  })
})

describe('image commands', () => {
  it('fills an image block with a placeholder and alt text, and refuses non-image blocks', () => {
    const hero = (runCommand('get_page', { section: 'hero' }) as Page).sections[0]
    const img = hero.blocks.find((b) => b.kind === 'image')!
    const r = runCommand('set_image', { section: 'hero', block: img.id, placeholder: 'arch', alt: 'An arch at dusk' }) as { media: { source: string; alt: string } }
    expect(r.media).toMatchObject({ source: 'placeholder', alt: 'An arch at dusk' })
    expect(() => runCommand('set_image', { section: 'hero', block: hero.blocks.find((b) => b.kind === 'heading')!.id, placeholder: 'mesh' })).toThrow(/isn’t an image block/)
  })
})

describe('media commands', () => {
  it('puts a YouTube video in an image block with a lightbox and a custom thumbnail', () => {
    const hero = (runCommand('get_page', { section: 'hero' }) as Page).sections[0]
    const img = hero.blocks.find((b) => b.kind === 'image')!
    const r = runCommand('set_media', { section: 'hero', block: img.id, url: 'https://youtu.be/abc', thumbnail: 'https://example.com/cover.jpg' }) as { media: { source: string; lightbox: boolean; poster: string } }
    expect(r.media).toMatchObject({ source: 'embed', lightbox: true, poster: 'https://example.com/cover.jpg' })
    expect(() => runCommand('set_media', { section: 'hero', block: img.id, play: 'hover' })).toThrow(/Embeds play on click/)
  })
})
