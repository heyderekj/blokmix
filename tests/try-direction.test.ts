import { beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import '@/data/directions'
import { directionById, directionList } from '@/core/directions'
import { allSlots, updateSlotIn } from '@/core/site'
import { guideInDirection, siteInDirection } from '@/core/tryDirection'
import { emptyContract } from '@/core/contract'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

const hero = () => allSlots(useStore.getState().site).find((s) => s.type === 'hero')!
const d = () => directionById('corner-bakery')!

describe('another direction for a site you have', () => {
  it('lays your pages out in its layouts, keeping your words and every section', () => {
    const st = useStore.getState()
    const site = updateSlotIn(st.site, hero().id, (s) => ({ ...s, words: { ...s.words, headline: 'Bread at dawn' } }))
    const out = siteInDirection(site, d(), library)
    const before = allSlots(site)
    const after = allSlots(out)
    expect(after.map((s) => s.type)).toEqual(before.map((s) => s.type))
    expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id))
    const h = after.find((s) => s.type === 'hero')!
    expect(h.clipId).toBe(d().layouts.hero?.[0]?.includes('.') ? d().layouts.hero![0] : `hero.layout-${d().layouts.hero![0]}`)
    expect(h.words?.headline).toBe('Bread at dawn')
  })

  it('leaves locked sections, and layouts set to Keep, as they are', () => {
    const st = useStore.getState()
    const locked = updateSlotIn(st.site, hero().id, (s) => ({ ...s, locked: true }))
    expect(allSlots(siteInDirection(locked, d(), library)).find((s) => s.type === 'hero')!.clipId).toBe(hero().clipId)
    const keep = { ...emptyContract(), areas: { ...emptyContract().areas, layout: 'keep' as const } }
    expect(siteInDirection(st.site, d(), library, keep)).toBe(st.site)
  })

  it('dresses the guide in its look, your brand color kept', () => {
    const g = guideInDirection({ ...useStore.getState().guide, brand: { color: '#0a7d4f' } }, d())
    expect(g.skin?.id).toBe(d().theme.split('/')[0])
    expect(g.brand?.color).toBe('#0a7d4f')
  })

  it('try_direction makes a new draft, leaves the one you were in, and counts as picked', async () => {
    const st = useStore.getState()
    const was = { id: st.draftId, hero: hero().clipId, skin: st.guide.skin }
    const out = (await runCommand('try_direction', { direction: 'corner-bakery' }, 'agent')) as { draft: { id: string; name: string } }
    const now = useStore.getState()
    expect(now.draftId).toBe(out.draft.id)
    expect(out.draft.name).toBe(d().name)
    expect(now.guide.skin?.id).not.toEqual(was.skin?.id)
    expect(now.content.taste?.events.at(-1)).toMatchObject({ kind: 'picked', ref: 'corner-bakery' })
    now.switchDraft(was.id)
    expect(hero().clipId).toBe(was.hero)
    await expect((async () => runCommand('try_direction', { direction: 'nope' }, 'agent'))()).rejects.toThrow(/No direction/)
  })

  it('refuses past the drafts a site can hold', async () => {
    const ids = directionList().slice(0, 8).map((x) => x.id)
    for (const id of ids.slice(0, 5)) await runCommand('try_direction', { direction: id }, 'agent')
    await expect((async () => runCommand('try_direction', { direction: ids[6] }, 'agent'))()).rejects.toThrow(/6 drafts/)
  })
})
