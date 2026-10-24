import type { Note, NoteAnchor } from '@/core/types'
import { hasPoint, importReviewMarks, isMark, MARK_GUIDANCE, sortMarks } from '@/core/notes'
import { type CommandInput } from '@/core/commands/schema'
import { TYPE_LABEL } from '@/core/content'
import { sectionAnchors } from '@/core/links'
import { allSlots } from '@/core/site'
import { library } from '@/data/library'
import { useStore } from '../store'
import { uid } from '../uid'
import { CommandError, findSection, findBlock, findNote, describeNote, wordsFor } from './refs'
import { findVersion } from './versions'

/**
 * A mark as agents see it, with where it came from: a mark from ReviseMy carries its review and mark
 * ids, so a fix here can be mirrored there (resolve_marks, reply_to_marks).
 */
function describe(n: Note) {
  const d = describeNote(n)
  const a = n.anchor
  const external = n.external ? { tool: n.external.tool, review: n.external.reviewId, mark: n.external.markId } : null
  if (a.kind !== 'preview') return { ...d, external }
  const v = useStore.getState().versions[a.versionId]
  const slot = a.slotId ? (v ? allSlots(v.snapshot.site) : []).find((s) => s.id === a.slotId) : undefined
  const where = hasPoint(a) ? `${Math.round(a.x * 100)}% across, ${Math.round(a.y * 100)}% down` : null
  const on = [`${v?.letter ?? 'a removed build'}’s preview at ${a.width}px`, slot ? `the ${TYPE_LABEL[slot.type]} section` : null, where].filter(Boolean).join(', ')
  return { ...d, on, section: null, version: v?.letter ?? null, preview: { width: a.width, x: hasPoint(a) ? a.x : null, y: hasPoint(a) ? a.y : null, page: a.pagePath ?? '/' }, external }
}

/** Feedback marks: reading, leaving, moving through statuses and replying. */
export const read = {
  list_notes: (i: CommandInput<'list_notes'>) => {
    const st = useStore.getState()
    const slotId = i.section !== undefined ? findSection(i.section).id : null
    const marks = sortMarks(st.notes.filter(isMark))
      .filter((m) => !i.status || m.status === i.status)
      .filter((m) => !i.kind || m.kind === i.kind)
      .filter((m) => !slotId || ('slotId' in m.anchor && m.anchor.slotId === slotId))
    return { guidance: MARK_GUIDANCE, marks: marks.map(describe) }
  },
}

export const write = {
  add_note: (i: CommandInput<'add_note'>) => {
    const st = useStore.getState()
    let anchor: NoteAnchor = { kind: 'page' }
    if (i.section !== undefined) {
      const slot = findSection(i.section)
      if (i.block) {
        const b = findBlock(slot, i.block)
        anchor = { kind: 'block', slotId: slot.id, clipId: slot.clipId, blockId: b.id, label: b.label, quote: b.field ? wordsFor(slot)[b.field] : undefined }
      } else anchor = { kind: 'area', slotId: slot.id, clipId: slot.clipId, rect: { x: 0, y: 0, w: 1, h: 1 } }
    }
    const id = st.addMark({ anchor, kind: i.kind, text: i.text, suggestedCopy: i.suggested_copy, source: 'agent' })
    return describeNote(useStore.getState().notes.find((n) => n.id === id)!)
  },
  update_note: (i: CommandInput<'update_note'>) => {
    const m = findNote(i.note)
    if (m.kind === 'keep') throw new CommandError(`N${m.number} is marked “Love this”: there’s nothing to change`)
    if (m.status === 'verified') throw new CommandError(`N${m.number} is already verified by a person`)
    useStore.getState().setMarkStatus(m.id, i.status, i.resolution)
    const d = describe(useStore.getState().notes.find((n) => n.id === m.id)!)
    // Remind the agent to say the same thing in ReviseMy, where the person reviews.
    return m.external ? { ...d, mirror: `Mirror this in ReviseMy: resolve_marks {id: "${m.external.reviewId}", marks: [{id: ${m.external.markId}, status: "${i.status}"${i.resolution ? ', note: …' : ''}}]}` } : d
  },
  reply_note: (i: CommandInput<'reply_note'>) => {
    const m = findNote(i.note)
    useStore.getState().replyToMark(m.id, i.text, 'agent')
    return describe(useStore.getState().notes.find((n) => n.id === m.id)!)
  },
  import_review_marks: (i: CommandInput<'import_review_marks'>) => {
    const v = findVersion(i.version)
    const st = useStore.getState()
    const anchors = sectionAnchors(allSlots(v.snapshot.site).filter((s) => library.clips[s.clipId]))
    const { notes, added, updated } = importReviewMarks(st.notes, i.review, i.marks, { versionId: v.id, anchors, now: Date.now(), newId: () => uid('mark') })
    const review = { tool: 'revisemy' as const, id: i.review.id, url: i.review.url, status: i.review.status, syncedAt: Date.now() }
    useStore.setState((s) => ({ notes, versions: { ...s.versions, [v.id]: { ...s.versions[v.id], review } } }))
    const now = useStore.getState().notes
    const pick = (ids: string[]) => ids.map((id) => describe(now.find((n) => n.id === id)!))
    return { version: v.letter, review: i.review.id, added: pick(added), updated: pick(updated) }
  },
}
