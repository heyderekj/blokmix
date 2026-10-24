import type { NoteAnchor } from '@/core/types'
import { isMark, MARK_GUIDANCE, sortMarks } from '@/core/notes'
import { type CommandInput } from '@/core/commands/schema'
import { useStore } from '../store'
import { CommandError, findSection, findBlock, findNote, describeNote, wordsFor } from './refs'

/** Feedback marks: reading, leaving, moving through statuses and replying. */
export const read = {
  list_notes: (i: CommandInput<'list_notes'>) => {
    const st = useStore.getState()
    const slotId = i.section !== undefined ? findSection(i.section).id : null
    const marks = sortMarks(st.notes.filter(isMark))
      .filter((m) => !i.status || m.status === i.status)
      .filter((m) => !i.kind || m.kind === i.kind)
      .filter((m) => !slotId || ('slotId' in m.anchor && m.anchor.slotId === slotId))
    return { guidance: MARK_GUIDANCE, marks: marks.map(describeNote) }
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
    return describeNote(useStore.getState().notes.find((n) => n.id === m.id)!)
  },
  reply_note: (i: CommandInput<'reply_note'>) => {
    const m = findNote(i.note)
    useStore.getState().replyToMark(m.id, i.text, 'agent')
    return describeNote(useStore.getState().notes.find((n) => n.id === m.id)!)
  },
}
