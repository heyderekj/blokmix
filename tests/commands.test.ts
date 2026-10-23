import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { runCommand, tools } from '@/state/commands'

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
    const faq = s.slots.find((x) => x.id === added.id)!
    expect(faq.words?.heading).toBe('Questions, answered')
    expect(faq.spacing).toEqual({ top: 'tight' })
    expect(s.guide.components?.button?.variant).toBe('pill')
  })

  it('suggests options and reviews against the checklist', () => {
    const opts = runCommand('get_options', { at: 2 }) as { types: { type: string; reason: string }[] }
    expect(opts.types[0].reason.length).toBeGreaterThan(0)
    expect(Array.isArray(runCommand('review', {}))).toBe(true)
  })
})

describe('note commands', () => {
  type Marks = { guidance: string; marks: { number: string; kind: string; status: string; on: string; suggestedCopy: string | null; replies: unknown[] }[] }

  it('leave, list, progress and reply on marks, most important first', () => {
    runCommand('add_note', { kind: 'nit', text: 'Calmer', section: 'pricing' })
    const m = runCommand('add_note', { kind: 'must-fix', text: 'Say what happens', section: 'hero', block: 'Hero · Button', suggested_copy: 'Start your tape' }) as { number: string; on: string }
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
