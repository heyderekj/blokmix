import { draftList, forkDraft, MAX_DRAFTS, swapDraft } from '@/core/drafts'
import { pageOf } from '@/core/site'
import { uid } from '../uid'
import type { State } from '../store'

type Set = (partial: Partial<State> | ((st: State) => Partial<State>)) => void
type Get = () => State

/** Drafts: opening one, making one, renaming, deleting. Each is one undo step. */
export function draftActions(set: Set, get: Get): Pick<State, 'switchDraft' | 'addDraft' | 'updateDraft' | 'deleteDraft' | 'restoreVersion'> {
  const open = (id: string) => {
    const st = get()
    const out = swapDraft(st, id, st.ui.pageId)
    if (!out) return false
    const { pageId, ...rest } = out
    const site = rest.site ?? st.site
    set({ ...rest, ui: { ...st.ui, pageId: pageOf(site, pageId).id, focusedSlotId: null, selectedBlockId: null, selectedFrameId: 'mix', mode: 'unified' } })
    return true
  }
  return {
    switchDraft: open,
    addDraft: (from = {}, opts = {}) => {
      const st = get()
      const count = Object.keys(st.drafts).length
      if (count >= MAX_DRAFTS) return null
      const draft = forkDraft(st, from, { id: uid('draft'), name: opts.name })
      if (!draft) return null
      set({ drafts: { ...st.drafts, [draft.id]: draft } })
      if (opts.open !== false) open(draft.id)
      return draft.id
    },
    updateDraft: (id, patch) =>
      set((st) => (st.drafts[id] ? { drafts: { ...st.drafts, [id]: { ...st.drafts[id], ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.status ? { status: patch.status } : {}) } } } : {})),
    deleteDraft: (id) => {
      const st = get()
      const list = draftList(st.drafts)
      if (!st.drafts[id] || list.length < 2) return false
      // The open one goes: its neighbour opens first, so there's always an open draft.
      if (id === st.draftId) open(list[list.findIndex((d) => d.id === id) + 1]?.id ?? list[list.findIndex((d) => d.id === id) - 1].id)
      set((s) => {
        const drafts = { ...s.drafts }
        delete drafts[id]
        const versions = Object.fromEntries(Object.entries(s.versions).filter(([, v]) => v.draftId !== id))
        return { drafts, versions }
      })
      return true
    },
    restoreVersion: (versionId) => {
      const v = get().versions[versionId]
      if (!v) return null
      // A version from another draft: that draft opens first, so the version lands in its own history.
      if (v.draftId && v.draftId !== get().draftId && get().drafts[v.draftId]) open(v.draftId)
      return get().remix(versionId)
    },
  }
}

/** Whether this mix's owner can have another draft (for buttons; the action asks again). */
export const canAddDraft = (st: Pick<State, 'drafts'>) => Object.keys(st.drafts).length < MAX_DRAFTS
