import type { GuideState, Note, ProjectContent, Site, MixSnapshot } from '@/core/types'
import { allSlots } from '@/core/site'
import { generalNotesFor, marksFor, slotNotesFor } from '@/core/versions'
import { library } from '@/data/library'

/** The whole site as it is now, for a version. */
export function snapshotOf(st: { site: Site; guide: GuideState; content: ProjectContent; notes: Note[] }): MixSnapshot {
  const slots = allSlots(st.site)
  return structuredClone({
    site: st.site,
    guide: st.guide,
    content: st.content,
    slotNotes: slotNotesFor(slots, st.notes),
    generalNotes: generalNotesFor(st.notes),
    marks: marksFor(slots, st.notes),
    clipHashes: Object.fromEntries(slots.map((s) => [s.clipId, library.clips[s.clipId]?.hash ?? ''])),
  })
}
