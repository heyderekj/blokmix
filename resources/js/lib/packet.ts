import type { BuildTarget, MixSnapshot, Note, VersionNode } from '@/core/types'
import { bindContextFor } from '@/state/collections'
import { resolveGuide } from '@/core/guide'
import { composeSite } from '@/core/compose'
import { allSlots, mapSlots } from '@/core/site'
import type { PacketInput } from '@/core/export/packet'
import { generalNotesFor, marksFor, slotNotesFor } from '@/core/versions'
import { library } from '@/data/library'
import { uploadData } from './assets'
import type { MixData } from '@/state/store'

/** Where each section sits inside a version frame, as measured on the canvas. */
type SectionRows = Record<string, { slot: string; top: number; height: number }[]>

export interface PacketSource {
  /** The working mix (null) or a version. */
  version: VersionNode | null
  targets: BuildTarget[]
  /** Measured section positions, so notes pinned on a version frame name their section. */
  sections?: SectionRows
}

/**
 * Everything a packet needs, from the mix's state: the composed page, the
 * style guide, notes and marks. No React, so the export panel and agent
 * commands (prepare_build) build the same packet.
 */
export function packetInputFor(st: Pick<MixData, 'mixName' | 'site' | 'guide' | 'content' | 'notes' | 'versions'>, src: PacketSource): PacketInput {
  const { version, targets, sections = {} } = src
  const live = allSlots(st.site)
  const snap: Pick<MixSnapshot, 'site' | 'guide' | 'content' | 'slotNotes' | 'marks' | 'generalNotes'> = version?.snapshot ?? {
    site: st.site,
    guide: st.guide,
    content: st.content,
    slotNotes: slotNotesFor(live, st.notes),
    marks: marksFor(live, st.notes),
    generalNotes: generalNotesFor(st.notes),
  }
  const slots = allSlots(snap.site)
  const guide = resolveGuide(snap.guide)
  // Notes pinned on a version frame land in the packet, tagged with the section they sit on.
  const frameNotes = version
    ? st.notes
        .filter((n: Note) => n.anchor.kind === 'frame' && n.anchor.frameId === version.id && n.text.trim())
        .map((n) => {
          const dy = n.anchor.kind === 'frame' ? n.anchor.dy : 0
          const sec = (sections[version.id] ?? []).find((s) => dy >= s.top && dy < s.top + s.height)
          const slot = sec && slots.find((s) => s.id === sec.slot)
          return slot ? `[${slot.type}] ${n.text.trim()}` : n.text.trim()
        })
    : []
  const parent = version?.parentId ? st.versions[version.parentId] : null
  return {
    page: composeSite({ site: mapSlots(snap.site, (s) => (library.clips[s.clipId] ? s : null)), guide, content: snap.content, library, slotNotes: snap.slotNotes, title: snap.content.brand, page: snap.guide, uploads: uploadData, bind: bindContextFor(snap.site) }),
    guide,
    guideState: snap.guide,
    library,
    mixName: st.mixName,
    version: version ? { id: version.id, letter: version.letter, title: version.title, status: version.status, parentLetter: parent?.letter } : null,
    targets,
    notes: [...(snap.generalNotes ?? []), ...frameNotes],
    // A version's marks live on with the mix, so read them live rather than from the snapshot.
    marks: version ? marksFor(slots, st.notes) : snap.marks,
  }
}
