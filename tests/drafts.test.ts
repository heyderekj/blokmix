import { beforeEach, describe, expect, it } from 'vitest'
import { draftList, draftsFromLegacy, LEGACY_DRAFT, versionsOf } from '@/core/drafts'
import { allSlots } from '@/core/site'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'
import { mixFromStart } from '@/lib/start'
import { startCandidates } from '@/core/start'
import { library } from '@/data/library'

const st = () => useStore.getState()
const sections = () => allSlots(st().site).length

beforeEach(() => {
  st().resetDemo()
  useStore.temporal.getState().clear()
})

describe('drafts', () => {
  it('the demo opens as one draft, holding its version', () => {
    expect(draftList(st().drafts).map((d) => d.letter)).toEqual(['A'])
    expect(Object.values(st().versions).every((v) => v.draftId === st().draftId)).toBe(true)
  })

  it('a new draft is a copy you can change without touching the first', () => {
    const before = sections()
    const a = st().draftId
    const b = st().addDraft()!
    expect(st().draftId).toBe(b)
    expect(st().drafts[b].letter).toBe('B')
    st().removeSlot(allSlots(st().site).find((s) => s.type === 'hero')!.id)
    expect(sections()).toBe(before - 1)
    st().switchDraft(a)
    expect(sections()).toBe(before)
    st().switchDraft(b)
    expect(sections()).toBe(before - 1)
  })

  it('switching is one undo step', async () => {
    const a = st().draftId
    const b = st().addDraft(undefined, { open: false })!
    useStore.temporal.getState().clear()
    // History takes one step per 400ms (store.ts `leading`).
    await new Promise((r) => setTimeout(r, 450))
    st().switchDraft(b)
    expect(st().draftId).toBe(b)
    useStore.temporal.getState().undo()
    expect(st().draftId).toBe(a)
  })

  it('versions belong to the open draft, numbered in it', () => {
    const first = st().pressVersion()
    expect(st().versions[first].letter).toBe('A1')
    const b = st().addDraft()!
    const v = st().pressVersion()
    expect(st().versions[v].draftId).toBe(b)
    expect(st().versions[v].letter).toBe('B1')
    expect(versionsOf(st().versions, b).map((x) => x.id)).toEqual([v])
  })

  it('renaming the site reaches every draft when it opens', () => {
    const a = st().draftId
    const b = st().addDraft(undefined, { open: false })!
    st().setBrand('Mill Bakery')
    st().switchDraft(b)
    expect(st().content.brand).toBe('Mill Bakery')
    st().switchDraft(a)
    expect(st().content.brand).toBe('Mill Bakery')
  })

  it('deleting keeps one, and the open one hands over to its neighbour', () => {
    const a = st().draftId
    expect(st().deleteDraft(a)).toBe(false)
    const b = st().addDraft()!
    st().pressVersion()
    expect(st().deleteDraft(b)).toBe(true)
    expect(st().draftId).toBe(a)
    expect(Object.values(st().versions).some((v) => v.draftId === b)).toBe(false)
  })

  it('reads a mix saved before drafts as one draft', () => {
    const out = draftsFromLegacy({ versions: { v1: { id: 'v1' } as never }, branchFrom: 'v1', head: null })
    expect(out.draftId).toBe(LEGACY_DRAFT)
    expect(out.head).toBe('v1')
    expect(out.versions.v1.draftId).toBe(LEGACY_DRAFT)
  })

  it('a guided start’s three picks are three drafts, the chosen one open', () => {
    const starts = startCandidates({ kind: 'local', name: 'Mill' }, library)
    const mix = mixFromStart({ name: 'Mill' }, starts, starts[1].id)
    expect(Object.keys(mix.drafts)).toHaveLength(starts.length)
    expect(mix.drafts[mix.draftId].body).toBeNull()
    expect(mix.site).toBe(starts[1].site)
    expect(Object.keys(mix.versions)).toHaveLength(0)
  })
})

describe('draft commands', () => {
  it('lists, makes, opens, renames and deletes', () => {
    const made = runCommand('new_draft', { name: 'Darker' }) as { letter: string; open: boolean }
    expect(made).toMatchObject({ letter: 'B', open: true })
    runCommand('switch_draft', { draft: 'A' })
    expect((runCommand('list_drafts', {}) as { drafts: { letter: string; open: boolean }[] }).drafts.map((d) => [d.letter, d.open])).toEqual([
      ['A', true],
      ['B', false],
    ])
    runCommand('update_draft', { draft: 'B', name: 'Dark one', status: 'ready' })
    expect(st().drafts[Object.keys(st().drafts).find((k) => st().drafts[k].letter === 'B')!].name).toBe('Dark one')
    runCommand('delete_draft', { draft: 'Dark one' })
    expect(draftList(st().drafts)).toHaveLength(1)
    expect(() => runCommand('switch_draft', { draft: 'Z' })).toThrow(/No draft/)
  })
})
