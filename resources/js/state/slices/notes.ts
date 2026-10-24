import { initialStatus, nextNumber } from '@/core/notes'
import { uid } from '../uid'
import type { State } from '../store'

type Set = (partial: Partial<State> | ((st: State) => Partial<State>)) => void

/** Notes and marks: sticky notes, feedback with a kind and status, and replies. */
export function noteActions(set: Set): Pick<State, 'addNote' | 'updateNote' | 'deleteNote' | 'addMark' | 'setMarkStatus' | 'replyToMark'> {
  return {
    addNote: (anchor, color = 'yellow') => {
      const id = uid('n')
      set((st) => ({ notes: [...st.notes, { id, text: '', color, anchor, createdAt: Date.now() }], ui: { ...st.ui, editingNoteId: id, tool: 'select' } }))
      return id
    },
    updateNote: (id, patch) => set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
    deleteNote: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id), ui: { ...st.ui, openNoteId: st.ui.openNoteId === id ? null : st.ui.openNoteId } })),
    addMark: ({ anchor, kind, text, suggestedCopy, source = 'you', author }) => {
      const id = uid('mark')
      set((st) => ({
        notes: [
          ...st.notes,
          {
            id,
            text,
            color: 'yellow',
            anchor,
            createdAt: Date.now(),
            kind,
            status: initialStatus(kind),
            source,
            author: author ?? (source === 'you' ? st.ui.myName : source === 'agent' ? 'Agent' : 'Checklist'),
            number: nextNumber(st.notes),
            suggestedCopy: suggestedCopy?.trim() || undefined,
          },
        ],
      }))
      return id
    },
    setMarkStatus: (id, status, resolution) =>
      set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, status, ...(resolution !== undefined ? { resolution: resolution || undefined } : {}) } : n)) })),
    replyToMark: (id, text, source = 'you', author) =>
      set((st) => ({
        notes: st.notes.map((n) =>
          n.id === id
            ? { ...n, replies: [...(n.replies ?? []), { id: uid('r'), text, source, author: author ?? (source === 'you' ? st.ui.myName : 'Agent'), at: Date.now() }] }
            : n,
        ),
      })),
  }
}
