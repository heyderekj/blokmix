import { memo, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import type { Note, NoteColor } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { anchorAt, canvasApi } from '../canvas/Canvas'
import type { FramePlacement } from '../canvas/geometry'

export const NOTE_COLORS: Record<NoteColor, { bg: string; border: string }> = {
  yellow: { bg: '#fff3a8', border: '#e9d45a' },
  pink: { bg: '#ffd1e3', border: '#f2a3c3' },
  blue: { bg: '#cfe6ff', border: '#9cc8f5' },
  green: { bg: '#cdf5d5', border: '#94dca4' },
}

export function notePosition(n: Note, placements: FramePlacement[], rows: Record<string, { top: number }>) {
  const a = n.anchor
  if (a.kind === 'world') return { x: a.x, y: a.y }
  if (a.kind === 'slot') {
    const r = rows[a.slotId]
    return r ? { x: a.dx, y: r.top + a.dy } : null
  }
  const p = placements.find((x) => x.id === a.frameId)
  return p ? { x: p.x + a.dx, y: p.y + a.dy } : null
}

export function NotesLayer({ placements }: { placements: FramePlacement[] }) {
  const notes = useStore((s) => s.notes)
  const rows = useLayout((s) => s.rows)
  return (
    <>
      {notes.map((n) => {
        const pos = notePosition(n, placements, rows)
        return pos ? <StickyNote key={n.id} note={n} x={pos.x} y={pos.y} placements={placements} /> : null
      })}
    </>
  )
}

const StickyNote = memo(function StickyNote({ note, x, y, placements }: { note: Note; x: number; y: number; placements: FramePlacement[] }) {
  const editing = useStore((s) => s.ui.editingNoteId === note.id)
  const slots = useStore((s) => s.slots)
  const ref = useRef<HTMLTextAreaElement>(null)
  const st = useStore.getState
  const c = NOTE_COLORS[note.color]

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  const attachedTo = (() => {
    const a = note.anchor
    if (a.kind === 'slot') {
      const s = slots.find((x) => x.id === a.slotId)
      return s ? `on ${TYPE_LABEL[s.type]} track` : null
    }
    if (a.kind === 'frame') {
      const p = placements.find((x) => x.id === a.frameId)
      return p ? `on ${p.node.letter}` : null
    }
    return null
  })()

  const onDragStart = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    const el = (e.currentTarget as HTMLElement).closest('[data-note]') as HTMLElement
    const move = (ev: PointerEvent) => {
      const z = canvasApi.get().z
      el.style.translate = `${(ev.clientX - start.x) / z}px ${(ev.clientY - start.y) / z}px`
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.style.translate = ''
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return
      const p = canvasApi.screenToWorld(ev.clientX, ev.clientY)
      // The handle sits ~12px into the card; anchor at the card's corner.
      const z = canvasApi.get().z
      st().updateNote(note.id, { anchor: anchorAt(p.x - 12 / z, p.y - 12 / z) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="absolute left-0 top-0 z-30" style={{ transform: `translate(${x}px, ${y}px)` }} data-note data-chrome>
      <div className="origin-top-left" style={{ transform: 'scale(calc(1 / var(--z)))' }} onPointerDown={(e) => e.stopPropagation()}>
        <div
          className="group w-56 animate-pop rounded-md rounded-tl-none border shadow-[0_8px_20px_-6px_rgb(0_0_0/0.25)]"
          style={{ background: c.bg, borderColor: c.border, rotate: '-1deg' }}
        >
          <div className="flex h-6 cursor-grab items-center gap-1 px-1.5 active:cursor-grabbing" onPointerDown={onDragStart}>
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map((k) => (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => st().updateNote(note.id, { color: k })}
                className={`size-3 rounded-full border border-black/15 transition hover:scale-125 ${note.color === k ? 'ring-1 ring-black/50 ring-offset-1' : 'opacity-0 group-hover:opacity-100'}`}
                style={{ background: NOTE_COLORS[k].bg }}
                aria-label={`${k} note`}
              />
            ))}
            <span className="ml-auto truncate text-[10px] font-medium text-black/45">{attachedTo ?? 'drag onto a track'}</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => st().deleteNote(note.id)}
              className="grid size-5 place-items-center rounded text-black/40 opacity-0 transition hover:bg-black/10 hover:text-black group-hover:opacity-100"
              aria-label="Delete note"
            >
              <Trash2 size={11} />
            </button>
          </div>
          <textarea
            ref={ref}
            value={note.text}
            placeholder="Note for the agent…"
            onChange={(e) => st().updateNote(note.id, { text: e.target.value })}
            onFocus={() => st().setUi({ editingNoteId: note.id })}
            onBlur={() => {
              st().setUi({ editingNoteId: null })
              if (!note.text.trim()) st().deleteNote(note.id)
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
            }}
            rows={3}
            className="block w-full resize-none bg-transparent px-2.5 pb-2.5 text-[13px] leading-snug text-[#18181b] outline-none placeholder:text-black/35"
            style={{ fieldSizing: 'content', minHeight: 64 } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  )
})
