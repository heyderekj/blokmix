import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { Check, CheckCheck, CornerDownLeft, RotateCcw, Trash2 } from 'lucide-react'
import type { Note, NoteAnchor, NoteKind, Slot } from '@/core/types'
import { NOTE_KINDS } from '@/core/types'
import { KIND_HINT, KIND_LABEL, SOURCE_LABEL, STATUS_LABEL, isMark, onSection, replaceWords } from '@/core/notes'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import type { FrameRect } from '@/frame/bridge'
import { keepInView } from '../canvas/inView'

/* ---------- the mark being written ---------- */

export interface MarkDraft {
  slotId: string
  anchor: NoteAnchor
  /** Where to place the composer, in page pixels of the section. */
  rect: FrameRect
  suggested?: string
}

export const useMarkDraft = create<{ draft: MarkDraft | null; open: (d: MarkDraft) => void; close: () => void }>()((set) => ({
  draft: null,
  open: (draft) => set({ draft }),
  close: () => set({ draft: null }),
}))

/** Start a mark on a block of a section (from the Note tool or the block bar). */
export function draftForBlock(slot: Slot, blockId: string, rect: FrameRect, words: Record<string, string>): MarkDraft | null {
  const b = slotClip(slot).blocks.find((x) => x.id === blockId)
  if (!b) return null
  const quote = b.field ? words[b.field] : undefined
  return { slotId: slot.id, rect, anchor: { kind: 'block', slotId: slot.id, clipId: slot.clipId, blockId: b.id, label: b.label, quote }, suggested: quote }
}

/* ---------- colors ---------- */

export const KIND_TONE: Record<NoteKind, { pin: string; chip: string; dot: string }> = {
  'must-fix': { pin: 'bg-problem text-white', chip: 'bg-problem-soft text-problem-ink', dot: 'bg-problem' },
  nit: { pin: 'bg-attention text-attention-ink', chip: 'bg-attention-soft text-attention-ink', dot: 'bg-attention' },
  question: { pin: 'bg-zinc-800 text-white', chip: 'bg-zinc-950/6 text-zinc-700', dot: 'bg-zinc-700' },
  keep: { pin: 'bg-done text-white', chip: 'bg-done-soft text-done-ink', dot: 'bg-done' },
}

export const STATUS_TONE = {
  open: 'bg-zinc-950/6 text-zinc-600',
  in_progress: 'bg-agent-soft text-agent-ink',
  resolved: 'bg-attention-soft text-attention-ink',
  verified: 'bg-done-soft text-done-ink',
} as const

/* ---------- pins on a section ---------- */

/**
 * The marks on one section: a numbered pin at each block or area, the card of
 * the open one, and the composer while you write a new one. Positions are page
 * pixels of the section (the frame renders 1:1).
 */
export function SectionMarks({
  slot,
  width,
  height,
  rects,
  drawing,
}: {
  slot: Slot
  width: number
  height: number
  rects: Record<string, FrameRect>
  drawing: FrameRect | null
}) {
  const notes = useStore((s) => s.notes)
  const openId = useStore((s) => s.ui.openNoteId)
  const draft = useMarkDraft((s) => (s.draft?.slotId === slot.id ? s.draft : null))
  const [hovered, setHovered] = useState<string | null>(null)
  const marks = useMemo(() => notes.filter((n) => isMark(n) && onSection(n.anchor) === slot.id), [notes, slot.id])

  const boxOf = (n: Note): FrameRect | null => {
    const a = n.anchor
    if (a.kind === 'block' || a.kind === 'words') return a.clipId === slot.clipId ? (rects[a.blockId] ?? null) : null
    if (a.kind === 'area') return { x: a.rect.x * width, y: a.rect.y * height, w: a.rect.w * width, h: a.rect.h * height }
    return null
  }
  const open = marks.find((m) => m.id === openId)
  const openBox = open ? boxOf(open) : null
  const hoverBox = hovered ? boxOf(marks.find((m) => m.id === hovered)!) : null

  return (
    <>
      {drawing && <Outline box={drawing} dashed />}
      {draft && <Outline box={draft.rect} />}
      {(hoverBox || openBox) && <Outline box={(hoverBox ?? openBox)!} soft />}
      {marks.map((m) => {
        const box = boxOf(m)
        if (!box) return null
        return <Pin key={m.id} mark={m} x={box.x + box.w} y={box.y} onHover={(on) => setHovered(on ? m.id : null)} />
      })}
      {open && openBox && (
        <Floating x={openBox.x + openBox.w} y={openBox.y + 14}>
          <MarkCard mark={open} />
        </Floating>
      )}
      {draft && (
        <Floating x={draft.rect.x} y={draft.rect.y + draft.rect.h}>
          {draft.anchor.kind === 'words' ? <WordsComposer draft={draft} anchor={draft.anchor} /> : <Composer draft={draft} />}
        </Floating>
      )}
    </>
  )
}

function Outline({ box, dashed, soft }: { box: FrameRect; dashed?: boolean; soft?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute z-10 rounded-[3px] ${dashed ? 'bg-problem/8' : ''}`}
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxShadow: `0 0 0 calc(${soft ? 1.5 : 2}px / var(--z)) ${soft ? 'color-mix(in oklab, var(--color-problem) 55%, transparent)' : 'var(--color-problem)'}`,
        outline: dashed ? 'calc(1px / var(--z)) dashed var(--color-problem)' : undefined,
      }}
    />
  )
}

/** Chrome placed in the section, counter-scaled so it stays screen-sized. */
function Floating({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="absolute z-40" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="absolute left-0 top-0 origin-top-left pt-2" style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }} data-chrome onPointerDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Pin({ mark, x, y, onHover }: { mark: Note; x: number; y: number; onHover: (on: boolean) => void }) {
  const open = useStore((s) => s.ui.openNoteId === mark.id)
  const tone = KIND_TONE[mark.kind!]
  const done = mark.status === 'resolved' || mark.status === 'verified'
  return (
    <div className="absolute z-30" style={{ left: x, top: y, width: 0, height: 0 }}>
      <button
        type="button"
        data-chrome
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={(e) => {
          e.stopPropagation()
          useStore.getState().setUi({ openNoteId: open ? null : mark.id })
        }}
        title={`N${mark.number} · ${KIND_LABEL[mark.kind!]} · ${STATUS_LABEL[mark.status!]}: ${mark.text}`}
        className={`absolute grid h-6 min-w-6 place-items-center rounded-full rounded-bl-[4px] px-1.5 text-[11px] font-bold tabular-nums shadow-md ring-2 ring-white transition hover:scale-110 ${tone.pin} ${mark.status === 'verified' ? 'opacity-55' : ''} ${open ? 'scale-110' : ''}`}
        style={{ transform: 'translate(-30%, -70%) scale(min(calc(1 / var(--z)), 3.4))', transformOrigin: '0 100%', left: 0, top: 0 }}
      >
        {done ? <Check size={12} strokeWidth={3} /> : `N${mark.number}`}
      </button>
    </div>
  )
}

/* ---------- writing a mark ---------- */

function Composer({ draft }: { draft: MarkDraft }) {
  const slot = useStore((s) => currentSlots(s).find((x) => x.id === draft.slotId))
  const [kind, setKind] = useState<NoteKind>('must-fix')
  const [text, setText] = useState('')
  const [copy, setCopy] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useMarkDraft((s) => s.close)
  useLayoutEffect(() => keepInView(ref.current), [])
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [close])

  const a = draft.anchor
  const target = a.kind === 'block' ? a.label : slot ? `An area of ${TYPE_LABEL[slot.type]}` : 'The page'
  const wantsCopy = (kind === 'must-fix' || kind === 'nit') && a.kind === 'block' && !!draft.suggested
  const save = () => {
    if (!text.trim()) return
    const st = useStore.getState()
    const id = st.addMark({ anchor: a, kind, text: text.trim(), suggestedCopy: wantsCopy && copy.trim() && copy.trim() !== draft.suggested ? copy : undefined })
    close()
    st.setUi({ openNoteId: id })
  }

  return (
    <div
      ref={ref}
      className="glass-menu w-[340px] animate-pop rounded-2xl p-2"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
      }}
    >
      <div className="mb-2 flex items-center gap-1.5 px-1 text-[12px] text-zinc-500">
        on <span className="truncate rounded-md bg-zinc-950/6 px-1.5 py-0.5 font-medium text-zinc-800">{target}</span>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1" role="radiogroup" aria-label="Kind">
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            title={KIND_HINT[k]}
            onClick={() => setKind(k)}
            className={`flex h-7 items-center justify-center gap-1 rounded-full text-[11.5px] font-semibold transition ${kind === k ? KIND_TONE[k].chip + ' ring-1 ring-current/20' : 'text-zinc-500 hover:bg-zinc-950/5'}`}
          >
            <span className={`size-1.5 rounded-full ${KIND_TONE[k].dot}`} />
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={kind === 'keep' ? 'What’s working here?' : kind === 'question' ? 'What do you want to know?' : 'What should change here?'}
        rows={3}
        className="w-full resize-none rounded-xl bg-white px-3 py-2 text-[13px] leading-snug text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
      />
      {wantsCopy && (
        <label className="mt-1.5 block">
          <span className="px-1 text-[11px] font-semibold text-zinc-400">Suggested copy (optional): the exact words for the agent</span>
          <input
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            placeholder={draft.suggested}
            className="mt-1 w-full rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
          />
        </label>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 px-1 text-[11px] text-zinc-400">
          <span className="kbd">⌘</span>
          <span className="kbd">↵</span> to save
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={close} className="h-8 rounded-full px-3 text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-950/5">
            Cancel
          </button>
          <button type="button" disabled={!text.trim()} onClick={save} className="btn-lit btn-ink cursor-pointer h-8 rounded-full px-3.5 text-[12.5px] font-semibold">
            Add note
          </button>
        </div>
      </div>
    </div>
  )
}

/** Words you selected: change them now, or suggest the change as a note (Koati's "select text to change it"). */
function WordsComposer({ draft, anchor }: { draft: MarkDraft; anchor: Extract<NoteAnchor, { kind: 'words' }> }) {
  const slot = useStore((s) => currentSlots(s).find((x) => x.id === draft.slotId))
  const content = useStore((s) => s.content)
  const [next, setNext] = useState(anchor.quote)
  const [why, setWhy] = useState('')
  const [kind, setKind] = useState<NoteKind>('nit')
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const close = useMarkDraft((s) => s.close)
  useLayoutEffect(() => {
    keepInView(ref.current)
    input.current?.select()
  }, [])
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [close])
  if (!slot) return null

  const clip = slotClip(slot)
  const full = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields[anchor.field] ?? ''
  const changed = next.trim() && next.trim() !== anchor.quote
  const st = useStore.getState
  const applyNow = () => {
    if (!changed) return
    const replaced = replaceWords(full, anchor.quote, next.trim())
    if (replaced === null) {
      st().showFlash('Couldn’t find those exact words; suggest it as a note instead')
      return
    }
    st().setWord(slot.id, anchor.field, replaced)
    st().showFlash(`Changed “${anchor.quote}”`, { undo: true })
    close()
  }
  const suggest = () => {
    if (!changed && !why.trim()) return
    const id = st().addMark({
      anchor,
      kind,
      text: why.trim() || `Change “${anchor.quote}” to “${next.trim()}”`,
      suggestedCopy: changed ? next.trim() : undefined,
    })
    close()
    st().setUi({ openNoteId: id })
  }

  return (
    <div
      ref={ref}
      className="glass-menu w-[340px] animate-pop rounded-2xl p-2"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) suggest()
        else if (e.key === 'Enter' && e.target === input.current) applyNow()
      }}
    >
      <div className="mb-1.5 px-1 text-[11px] font-semibold text-zinc-400">Change these words</div>
      <div className="mb-1.5 rounded-lg bg-key/10 px-2.5 py-1.5 text-[12.5px] text-zinc-600 line-through decoration-zinc-400">{anchor.quote}</div>
      <input
        ref={input}
        autoFocus
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="w-full rounded-lg bg-white px-2.5 py-2 text-[13px] text-zinc-900 outline-none ring-1 ring-zinc-950/10 focus:ring-zinc-400"
        aria-label="Change to"
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder="Why? (optional, for a suggestion)"
        rows={2}
        className="mt-1.5 w-full resize-none rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-900 outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
      />
      <div className="mt-1.5 flex items-center gap-1">
        {(['must-fix', 'nit', 'question'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition ${kind === k ? KIND_TONE[k].chip : 'text-zinc-500 hover:bg-zinc-950/5'}`}
          >
            <span className={`size-1.5 rounded-full ${KIND_TONE[k].dot}`} />
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1">
        <button type="button" disabled={!changed && !why.trim()} onClick={suggest} className="h-8 rounded-full px-3 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-950/5 disabled:opacity-40" title="Leave it as a note (⌘↵)">
          Suggest
        </button>
        <button type="button" disabled={!changed} onClick={applyNow} className="btn-lit btn-ink cursor-pointer h-8 rounded-full px-3.5 text-[12.5px] font-semibold" title="Change the words now (↵)">
          Change it
        </button>
      </div>
    </div>
  )
}

/* ---------- reading one ---------- */

export function MarkCard({ mark }: { mark: Note }) {
  const [reply, setReply] = useState('')
  const st = useStore.getState
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => keepInView(ref.current), [])
  const a = mark.anchor
  const status = mark.status!
  return (
    <div ref={ref} className="glass-menu w-[320px] animate-pop rounded-2xl p-3" onKeyDown={(e) => e.stopPropagation()}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[12px] font-bold tabular-nums text-zinc-900">N{mark.number}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[mark.kind!].chip}`}>{KIND_LABEL[mark.kind!]}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
        <span className="ml-auto text-[11px] text-zinc-400">{mark.author ?? SOURCE_LABEL[mark.source ?? 'you']}</span>
      </div>
      {a.kind === 'block' && <div className="mb-1 truncate text-[11.5px] text-zinc-500">on {a.label}</div>}
      {a.kind === 'words' && (
        <div className="mb-1 truncate text-[11.5px] text-zinc-500">
          on <span className="rounded bg-key/15 px-1 text-zinc-700">“{a.quote}”</span> in {a.label}
        </div>
      )}
      <p className="text-[13px] leading-snug text-zinc-800">{mark.text}</p>
      {mark.suggestedCopy && (
        <div className="mt-2 rounded-lg bg-zinc-950/[0.04] px-2.5 py-1.5 text-[12.5px] text-zinc-700">
          <span className="text-[11px] font-semibold text-zinc-400">Suggested copy</span>
          <div>“{mark.suggestedCopy}”</div>
        </div>
      )}
      {mark.resolution && (
        <div className="mt-2 text-[12px] text-zinc-600">
          <span className="font-semibold">Done:</span> {mark.resolution}
        </div>
      )}
      {!!mark.replies?.length && (
        <div className="mt-2 space-y-1.5 border-t border-zinc-950/6 pt-2">
          {mark.replies.map((r) => (
            <div key={r.id} className="text-[12.5px] leading-snug">
              <span className={`font-semibold ${r.source === 'agent' ? 'text-agent-ink' : 'text-zinc-900'}`}>{r.author}</span> <span className="text-zinc-700">{r.text}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && reply.trim()) {
              st().replyToMark(mark.id, reply.trim())
              setReply('')
            }
          }}
          placeholder="Reply…"
          className="h-8 min-w-0 flex-1 rounded-full bg-white px-3 text-[12.5px] outline-none ring-1 ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-zinc-400"
        />
        <CornerDownLeft size={13} className="shrink-0 text-zinc-300" />
      </div>
      <div className="mt-2 flex items-center gap-1">
        {mark.kind !== 'keep' && (status === 'open' || status === 'in_progress') && (
          <Action icon={Check} onClick={() => st().setMarkStatus(mark.id, 'resolved')}>
            Resolve
          </Action>
        )}
        {mark.kind !== 'keep' && status === 'resolved' && (
          <Action icon={CheckCheck} primary onClick={() => st().setMarkStatus(mark.id, 'verified')}>
            Verify
          </Action>
        )}
        {mark.kind !== 'keep' && (status === 'resolved' || status === 'verified') && (
          <Action icon={RotateCcw} onClick={() => st().setMarkStatus(mark.id, 'open')}>
            Reopen
          </Action>
        )}
        <span className="flex-1" />
        <Action
          icon={Trash2}
          onClick={() => {
            st().deleteNote(mark.id)
            st().showFlash(`Removed N${mark.number}`, { undo: true })
          }}
        >
          Delete
        </Action>
      </div>
    </div>
  )
}

function Action({ icon: Icon, children, onClick, primary }: { icon: typeof Check; children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold transition ${primary ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
    >
      <Icon size={13} /> {children}
    </button>
  )
}
