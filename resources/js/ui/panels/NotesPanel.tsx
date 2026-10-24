import { useMemo, useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import type { Note, NoteKind, NoteStatus } from '@/core/types'
import { NOTE_KINDS } from '@/core/types'
import { KIND_LABEL, STATUS_LABEL, SOURCE_LABEL, isMark, onSection, outstanding, sortMarks } from '@/core/notes'
import { TYPE_LABEL } from '@/core/content'
import { useStore, currentSlots } from '@/state/store'
import { useLayout } from '@/state/layout'
import { canvasApi } from '../canvas/Canvas'
import { VIEW_W, placeVersions } from '../canvas/geometry'
import { KIND_TONE, STATUS_TONE } from '../notes/Marks'

type StatusFilter = 'todo' | 'resolved' | 'all'

/**
 * Every mark on the mix, most important first: a reading list, not a board.
 * Click one to fly to it; resolve and verify from here.
 */
export function NotesPanel() {
  const notes = useStore((s) => s.notes)
  const slots = useStore(currentSlots)
  const versions = useStore((s) => s.versions)
  const [kind, setKind] = useState<NoteKind | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('todo')
  const marks = useMemo(() => sortMarks(notes.filter(isMark)), [notes])
  const shown = marks
    .filter((m) => kind === 'all' || m.kind === kind)
    .filter((m) => (status === 'all' ? true : status === 'todo' ? outstanding(m) || m.kind === 'keep' : m.status === 'resolved' || m.status === 'verified'))

  const groups = new Map<string, Note[]>()
  for (const m of shown) {
    // Marks from a review of a build's preview group under that build, after the mix's own sections.
    const key = m.anchor.kind === 'preview' ? `v:${m.anchor.versionId}` : (onSection(m.anchor) ?? 'page')
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const rank = (k: string) => (k.startsWith('v:') ? slots.length + 1 : slots.findIndex((s) => s.id === k))
  const order = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const toVerify = marks.filter((m) => m.status === 'resolved').length

  const inStatus = marks.filter((m) => (status === 'all' ? true : status === 'todo' ? outstanding(m) || m.kind === 'keep' : m.status === 'resolved' || m.status === 'verified'))
  const count = (st: StatusFilter) =>
    marks.filter((m) => (st === 'all' ? true : st === 'todo' ? outstanding(m) || m.kind === 'keep' : m.status === 'resolved' || m.status === 'verified')).length

  return (
    <div>
      {marks.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-zinc-950/5 bg-[color-mix(in_srgb,var(--lift)_85%,transparent)] px-3 py-2 backdrop-blur">
          {/* Which ones: to do, done, or all of them. */}
          <div className="flex shrink-0 rounded-full bg-chip p-0.5" role="tablist" aria-label="Show">
            {(['todo', 'resolved', 'all'] as const).map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={status === st}
                onClick={() => setStatus(st)}
                className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-[background-color,color] duration-150 ${status === st ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                {st === 'todo' ? 'To do' : st === 'resolved' ? 'Done' : 'All'}
                <span className="tabular-nums text-zinc-400">{count(st)}</span>
              </button>
            ))}
          </div>
          {/* Which kind: a colored dot each, its count beside it; the name on hover. */}
          <div className="ml-auto flex shrink-0 items-center">
            {NOTE_KINDS.map((k) => {
              const n = inStatus.filter((m) => m.kind === k).length
              const on = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  title={on ? `Showing ${KIND_LABEL[k]} only · click for all` : `Only ${KIND_LABEL[k]}`}
                  onClick={() => setKind(on ? 'all' : k)}
                  className={`flex h-7 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-full px-1.5 text-[12px] font-semibold tabular-nums transition-[background-color,color,opacity] duration-150 ${
                    on ? KIND_TONE[k].chip : kind !== 'all' ? 'text-zinc-400 opacity-60 hover:opacity-100' : n ? 'text-zinc-600 hover:bg-zinc-950/5' : 'text-zinc-300 hover:bg-zinc-950/5'
                  }`}
                >
                  <span className={`size-2 rounded-full ${KIND_TONE[k].dot} ${n || on ? '' : 'opacity-40'}`} />
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {toVerify > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-950/5 bg-done-soft/60 px-4 py-1.5 text-[12px] text-done-ink">
          <span>
            {toVerify} resolved, ready for you to check
          </span>
          <button
            type="button"
            onClick={() => marks.filter((m) => m.status === 'resolved').forEach((m) => useStore.getState().setMarkStatus(m.id, 'verified'))}
            className="flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 font-semibold transition-[background-color,scale] duration-150 hover:bg-done-soft active:scale-[0.97]"
          >
            <CheckCheck size={13} /> Verify all
          </button>
        </div>
      )}

      {!marks.length ? (
        <div className="grid justify-items-center gap-3 px-6 pb-6 pt-7 text-center">
          {/* A note as it sits on the page: its numbered pin by a block. */}
          <div aria-hidden className="relative h-14 w-40">
            <div className="absolute inset-x-0 bottom-0 h-9 rounded-xl bg-zinc-950/[0.04] ring-1 ring-zinc-950/5">
              <div className="mx-3 mt-3 h-1.5 w-16 rounded-full bg-zinc-950/10" />
              <div className="mx-3 mt-1.5 h-1.5 w-24 rounded-full bg-zinc-950/[0.06]" />
            </div>
            <span className={`absolute -top-1 right-6 grid h-7 min-w-8 place-items-center rounded-full rounded-bl-[5px] px-1.5 text-[12px] font-bold shadow-[0_6px_14px_-6px_rgb(0_0_0/0.35)] ${KIND_TONE['must-fix'].pin}`}>N1</span>
          </div>
          <div className="grid gap-1">
            <p className="text-[14px] font-semibold text-zinc-900">No notes yet</p>
            <p className="mx-auto max-w-[30ch] text-[12.5px] leading-relaxed text-pretty text-zinc-500">Click a block or drag across an area to say what to change, ask, or keep.</p>
          </div>
          <button
            type="button"
            onClick={() => useStore.getState().setUi({ tool: 'note', sheet: 'none', openNoteId: null })}
            className="btn-quiet flex h-8 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold"
          >
            Leave a note <span className="kbd">N</span>
          </button>
        </div>
      ) : !shown.length ? (
        <div className="grid justify-items-center gap-2 px-6 py-8 text-center">
          <p className="text-[13px] text-zinc-500">{status === 'todo' ? 'Nothing left to do here.' : 'Nothing here with these filters.'}</p>
          {kind !== 'all' && (
            <button type="button" onClick={() => setKind('all')} className="cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-950/5">
              Show every kind
            </button>
          )}
        </div>
      ) : (
        order.map((key) => {
          const slot = slots.find((s) => s.id === key)
          return (
            <section key={key} className="border-b border-zinc-950/5 px-2 py-2 last:border-0">
              <h4 className="eyebrow flex items-center justify-between px-2 pb-1 pt-1">
                <span>{slot ? `${slots.indexOf(slot) + 1}. ${TYPE_LABEL[slot.type]}` : key.startsWith('v:') ? `${versions[key.slice(2)]?.letter ?? 'Build'} · preview` : 'Whole page'}</span>
                <span className="tabular-nums">{groups.get(key)!.length}</span>
              </h4>
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
    const slot = onSection(a)
    if (a.kind === 'preview') {
      const p = placeVersions(s.versions, s.ui.viewport, s.framePos).find((x) => x.id === a.versionId)
      const h = useLayout.getState().frameHeights[a.versionId] ?? 2400
      const y = a.y >= 0 ? p && p.y + a.y * h : p?.y
      if (p && y !== undefined) canvasApi.focusRect({ x: p.x - 40, y: y - 300, w: p.w + 80, h: 700 }, 0.8)
    } else if (slot) {
      const row = useLayout.getState().rows[slot]
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
          <span className="truncate">{a.kind === 'block' ? a.label : a.kind === 'area' ? 'An area' : a.kind === 'preview' ? `Preview at ${a.width}px` : 'Whole page'}</span>
          {(mark.source ?? 'you') !== 'you' && (
            <>
              <span>·</span>
              <span className="shrink-0">{mark.author ?? SOURCE_LABEL[mark.source ?? 'you']}</span>
            </>
          )}
          <span className={`ml-auto shrink-0 text-[10.5px] font-semibold ${KIND_TONE[mark.kind!].chip} rounded-full px-1.5`}>{KIND_LABEL[mark.kind!]}</span>
        </div>
        <div className={`text-[13px] leading-snug ${status === 'verified' && mark.kind !== 'keep' ? 'text-zinc-400 line-through decoration-zinc-300' : 'text-zinc-800'}`}>{mark.text}</div>
        {mark.suggestedCopy && <div className="mt-0.5 truncate text-[12px] text-zinc-500">→ “{mark.suggestedCopy}”</div>}
        {mark.resolution && <div className="mt-0.5 text-[12px] text-zinc-500">Done: {mark.resolution}</div>}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {status !== 'open' && mark.kind !== 'keep' && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>}
        {mark.kind !== 'keep' && (status === 'open' || status === 'in_progress') && (
          <button type="button" onClick={() => st().setMarkStatus(mark.id, 'resolved')} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold cursor-pointer text-zinc-500 opacity-0 transition hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
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
