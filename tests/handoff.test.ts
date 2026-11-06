import { beforeEach, describe, expect, it } from 'vitest'
import { currentSlots, useStore } from '@/state/store'
import { agentPrompt } from '@/core/export/packet'
import { packetInputFor } from '@/lib/packet'
import { publishProblem } from '@/lib/publish'
import { withClip } from '@/core/library'
import { library } from '@/data/library'
import { emptyContract } from '@/core/contract'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

describe('the prompt you paste', () => {
  const input = () => {
    const st = useStore.getState()
    return packetInputFor({ mixName: st.mixName, site: st.site, guide: st.guide, content: st.content, notes: st.notes, versions: st.versions }, { version: null, targets: ['astro'], sections: {} })
  }
  it('leaves out reporting back to Blokmix when no agent is connected', () => {
    const plain = agentPrompt(input(), 'astro', undefined, { mcp: false })
    expect(plain).not.toMatch(/report_build|Report back|ReviseMy/)
    expect(plain).toMatch(/Run the dev server/)
    expect(agentPrompt(input(), 'astro')).toMatch(/Report back to Blokmix/)
  })
})

describe('publishing problems', () => {
  it('say what happened and what to do, never a bare code', () => {
    expect(publishProblem(419)).toMatch(/signed out/)
    expect(publishProblem(413, 'The POST data is too large')).toMatch(/smaller pictures/)
    expect(publishProblem(403, 'Free has one live page.')).toBe('Free has one live page.')
    expect(publishProblem(500)).not.toMatch(/\d/)
  })
})

describe('starting from a version', () => {
  it('saves your unsaved edits first and brings back its Keep or surprise', () => {
    const st = useStore.getState()
    st.setContract({ areas: { color: 'keep' } })
    const a = st.pressVersion()
    const letterA = useStore.getState().versions[a].letter
    // An edit, and different rules, after A.
    st.setContract({ areas: { color: 'surprise' } })
    st.setBrand('Fern & Co')
    const before = Object.keys(useStore.getState().versions).length
    const saved = useStore.getState().remix(a)
    const after = useStore.getState()
    expect(saved).not.toBeNull()
    expect(Object.keys(after.versions).length).toBe(before + 1)
    expect(after.content.brand).toBe(useStore.getState().versions[a].snapshot.content.brand)
    expect(after.contract?.areas?.color).toBe('keep')
    expect(letterA).toBeTruthy()
  })

  it('makes no extra version when nothing changed', () => {
    const st = useStore.getState()
    const a = st.pressVersion()
    const before = Object.keys(useStore.getState().versions).length
    expect(useStore.getState().remix(a)).toBeNull()
    expect(Object.keys(useStore.getState().versions).length).toBe(before)
  })
})

describe('Shuffle and the layout you had', () => {
  it('leaves layouts alone when Layout is set to Keep', () => {
    const st = useStore.getState()
    st.setContract({ ...emptyContract(), areas: { layout: 'keep' } })
    const before = currentSlots(useStore.getState()).map((s) => s.clipId)
    st.shuffle()
    expect(currentSlots(useStore.getState()).map((s) => s.clipId)).toEqual(before)
  })

  it('remembers the layout a section had', () => {
    const [a, b] = library.layoutsByType.hero
    const slot: { id: string; clipId: string; keep: { layout: boolean; style: boolean; content: boolean; motion: boolean }; prevClipId?: string } = { id: 's', clipId: a, keep: { layout: true, style: false, content: false, motion: true } }
    expect(withClip(slot, b, library).prevClipId).toBe(a)
  })
})
