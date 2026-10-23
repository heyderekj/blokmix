import type { GuideState, Note, ProjectContent, Slot, TapeSnapshot } from '@/core/types'
import { generalNotesFor, marksFor, slotNotesFor } from '@/core/versions'
import { library } from '@/data/library'

export function snapshotOf(st: { slots: Slot[]; guide: GuideState; content: ProjectContent; notes: Note[] }): TapeSnapshot {
  return structuredClone({
    slots: st.slots,
    guide: st.guide,
    content: st.content,
    slotNotes: slotNotesFor(st.slots, st.notes),
    generalNotes: generalNotesFor(st.notes),
    marks: marksFor(st.slots, st.notes),
    clipHashes: Object.fromEntries(st.slots.map((s) => [s.clipId, library.clips[s.clipId]?.hash ?? ''])),
  })
}
