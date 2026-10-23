import { useMemo, useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import type { Note, NoteKind, NoteStatus } from '@/core/types'
import { NOTE_KINDS } from '@/core/types'
import { KIND_LABEL, STATUS_LABEL, SOURCE_LABEL, isMark, outstanding, sortMarks } from '@/core/notes'
import { TYPE_LABEL } from '@/core/content'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { canvasApi } from '../canvas/Canvas'
import { VIEW_W } from '../canvas/geometry'
import { KIND_TONE, STATUS_TONE } from '../notes/Marks'

type StatusFilter = 'todo' | 'resolved' | 'all'

/**
 * Every mark on the tape, most important first: a reading list, not a board.
 * Click one to fly to it; resolve and verify from here.
 */
export function NotesPanel() {
  const notes = useStore((s) => s.notes)
  const slots = useStore((s) => s.slots)
  const [kind, setKind] = useState<NoteKind | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('todo')
  const marks = useMemo(() => sortMarks(notes.filter(isMark)), [notes])
  const shown = marks
    .filter((m) => kind === 'all' || m.kind === kind)
    .filter((m) => (status === 'all' ? true : status === 'todo' ? outstanding(m) || m.kind === 'keep' : m.status === 'resolved' || m.status === 'verified'))

  const groups = new Map<string, Note[]>()
  for (const m of shown) {
    const key = 'slotId' in m.anchor ? m.anchor.slotId : 'page'
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const order = [...groups.keys()].sort((a, b) => slots.findIndex((s) => s.id === a) - slots.findIndex((s) => s.id === b))
  const toVerify = marks.filter((m) => m.status === 'resolved').length

  return (
    <div>
      <div className="sticky top-0 z-10 space-y-2 border-b border-zinc-950/5 bg-[color-mix(in_srgb,var(--lift)_85%,transparent)] px-4 py-2.5 backdrop-blur">
        <div className="flex gap-1">
          {(['all', ...NOTE_KINDS] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition ${kind === k ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}
            >
              {k !== 'all' && <span className={`size-1.5 rounded-full ${KIND_TONE[k].dot}`} />}
              {k === 'all' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['todo', 'resolved', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`h-6 rounded-full px-2.5 text-[11.5px] font-semibold transition ${status === s ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-950/5' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {s === 'todo' ? 'To do' : s === 'resolved' ? 'Done' : 'Everything'}
            </button>
          ))}
          {toVerify > 0 && (
            <button
              type="button"
              onClick={() => marks.filter((m) => m.status === 'resolved').forEach((m) => useStore.getState().setMarkStatus(m.id, 'verified'))}
              className="ml-auto flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold text-done-ink hover:bg-done-soft"
              title="You’ve checked the resolved ones"
            >
              <CheckCheck size={12} /> Verify {toVerify}
            </button>
          )}
        </div>
      </div>

      {!marks.length ? (
        <p className="px-4 py-5 text-[12.5px] leading-relaxed text-zinc-500">
          No notes yet. Pick the Note tool (<span className="kbd">N</span>) and click a block, or drag across an area, to leave specific feedback.
        </p>
      ) : !shown.length ? (
        <p className="px-4 py-5 text-[12.5px] text-zinc-500">Nothing here with these filters.</p>
      ) : (
        order.map((key) => {
          const slot = slots.find((s) => s.id === key)
          return (
            <section key={key} className="border-b border-zinc-950/5 px-2 py-2 last:border-0">
              <h4 className="eyebrow px-2 pb-1 pt-1">{slot ? `${slots.indexOf(slot) + 1}. ${TYPE_LABEL[slot.type]}` : 'Whole page'}</h4>
              {groups.get(key)!.map((m) => (
                <Row key={m.id} mark={m} />
              ))}
            </section>
          )
        })
      )}
    </div>
  )
}

function Row({ mark }: { mark: Note }) {
  const st = useStore.getState
  const status = mark.status as NoteStatus
  const a = mark.anchor
  const goTo = () => {
    const s = useStore.getState()
    if ('slotId' in a) {
      const row = useLayout.getState().rows[a.slotId]
      const w = VIEW_W[s.ui.viewport]
      if (row) canvasApi.focusRect({ x: -40, y: row.top - 60, w: w + 80, h: Math.min(row.height, 1400) + 120 }, 0.8)
    }
    s.setUi({ openNoteId: mark.id })
  }
  return (
    <div className="group flex gap-2.5 rounded-xl px-2 py-2 transition hover:bg-zinc-950/[0.035]">
      <button type="button" onClick={goTo} className={`mt-0.5 grid h-6 min-w-7 shrink-0 place-items-center rounded-full rounded-bl-[4px] px-1 text-[11px] font-bold tabular-nums ${KIND_TONE[mark.kind!].pin}`}>
        N{mark.number}
      </button>
      <button type="button" onClick={goTo} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-500">
          <span className="truncate">{a.kind === 'block' ? a.label : a.kind === 'area' ? 'An area' : 'Whole page'}</span>
          <span>·</span>
          <span className="shrink-0">{mark.author ?? SOURCE_LABEL[mark.source ?? 'you']}</span>
        </div>
        <div className={`text-[13px] leading-snug ${status === 'verified' ? 'text-zinc-400 line-through decoration-zinc-300' : 'text-zinc-800'}`}>{mark.text}</div>
        {mark.suggestedCopy && <div className="mt-0.5 truncate text-[12px] text-zinc-500">→ “{mark.suggestedCopy}”</div>}
        {mark.resolution && <div className="mt-0.5 text-[12px] text-zinc-500">Done: {mark.resolution}</div>}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
        {mark.kind !== 'keep' && (status === 'open' || status === 'in_progress') && (
          <button type="button" onClick={() => st().setMarkStatus(mark.id, 'resolved')} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-zinc-500 opacity-0 transition hover:bg-zinc-950/5 hover:text-zinc-900 group-hover:opacity-100">
            <Check size={11} /> Resolve
          </button>
        )}
        {status === 'resolved' && (
          <button type="button" onClick={() => st().setMarkStatus(mark.id, 'verified')} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-done-ink hover:bg-done-soft">
            <CheckCheck size={11} /> Verify
          </button>
        )}
      </div>
    </div>
  )
}
