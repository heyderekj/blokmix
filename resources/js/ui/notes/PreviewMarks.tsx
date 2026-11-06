import { useMemo } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import type { Note, NoteAnchor, VersionNode } from '@/core/types'
import { KIND_LABEL, STATUS_LABEL, hasPoint, isMark, outstanding } from '@/core/notes'
import { useStore } from '@/state/store'
import { KIND_TONE, MarkCard } from './Marks'

type PreviewAnchor = Extract<NoteAnchor, { kind: 'preview' }>
type PreviewMark = Note & { anchor: PreviewAnchor }

/** ReviseMy captures phones at 375 and we ask for 390: close enough to be the same page. */
const sameWidth = (a: number, b: number) => Math.abs(a - b) <= 20

/** Marks brought back from a review of this version's preview. */
function usePreviewMarks(versionId: string): PreviewMark[] {
  const notes = useStore((s) => s.notes)
  return useMemo(() => notes.filter((n): n is PreviewMark => isMark(n) && n.anchor.kind === 'preview' && n.anchor.versionId === versionId), [notes, versionId])
}

/**
 * Pins for review marks, at the point the reviewer marked, when the frame shows the preview at the
 * width it was reviewed at. `width` is the page's CSS width; the frame may draw it smaller.
 */
export function PreviewPins({ v, width, frameW, frameH }: { v: VersionNode; width: number; frameW: number; frameH: number }) {
  const marks = usePreviewMarks(v.id)
  const openId = useStore((s) => s.ui.openNoteId)
  const here = marks.filter((m) => sameWidth(m.anchor.width, width) && hasPoint(m.anchor))
  if (!here.length || !frameH) return null
  const open = here.find((m) => m.id === openId)
  return (
    <>
      {open && open.anchor.w && open.anchor.h && (
        <div
          className="pointer-events-none absolute z-10 rounded-[3px]"
          style={{
            left: open.anchor.x * frameW,
            top: open.anchor.y * frameH,
            width: open.anchor.w * frameW,
            height: open.anchor.h * frameH,
            boxShadow: '0 0 0 calc(1.5px / var(--zl)) color-mix(in oklab, var(--color-problem) 55%, transparent)',
          }}
        />
      )}
      {here.map((m) => (
        <Pin key={m.id} mark={m} x={(m.anchor.x + (m.anchor.w ?? 0)) * frameW} y={m.anchor.y * frameH} open={m.id === openId} />
      ))}
      {open && (
        <div className="absolute z-40" style={{ left: (open.anchor.x + (open.anchor.w ?? 0)) * frameW, top: open.anchor.y * frameH + 14, width: 0, height: 0 }}>
          <div className="absolute left-0 top-0 origin-top-left pt-2" style={{ transform: 'scale(min(calc(1 / var(--zl)), 3.4))' }} data-chrome onPointerDown={(e) => e.stopPropagation()}>
            <MarkCard mark={open} />
          </div>
        </div>
      )}
    </>
  )
}

function Pin({ mark, x, y, open }: { mark: PreviewMark; x: number; y: number; open: boolean }) {
  const done = mark.status === 'resolved' || mark.status === 'verified'
  return (
    <div className="absolute z-30" style={{ left: x, top: y, width: 0, height: 0 }}>
      <button
        type="button"
        data-chrome
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          useStore.getState().setUi({ openNoteId: open ? null : mark.id })
        }}
        title={`N${mark.number} · ${KIND_LABEL[mark.kind!]} · ${STATUS_LABEL[mark.status!]}: ${mark.text}`}
        className={`absolute grid h-6 min-w-6 place-items-center rounded-full rounded-bl-[4px] px-1.5 text-[11px] font-bold tabular-nums shadow-md ring-2 ring-white transition hover:scale-110 ${KIND_TONE[mark.kind!].pin} ${mark.status === 'verified' ? 'opacity-55' : ''}`}
        style={{ transform: 'translate(-30%, -70%) scale(min(calc(1 / var(--zl)), 3.4))', transformOrigin: '0 100%', left: 0, top: 0 }}
      >
        {done ? <Check size={12} strokeWidth={3} /> : `N${mark.number}`}
      </button>
    </div>
  )
}

/** "3 marks at 390px" for the marks this width doesn't show, and a chip to the review itself. */
export function PreviewMarksBar({ v, width }: { v: VersionNode; width: number }) {
  const marks = usePreviewMarks(v.id)
  const elsewhere = new Map<number, number>()
  for (const m of marks) if (outstanding(m) && !(sameWidth(m.anchor.width, width) && hasPoint(m.anchor))) elsewhere.set(m.anchor.width, (elsewhere.get(m.anchor.width) ?? 0) + 1)
  const away = [...elsewhere].sort((a, b) => b[0] - a[0])
  if (!v.review && !away.length) return null
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] @max-[340px]:hidden">
      {away.map(([w, n]) => (
        <span key={w} className="shrink-0 truncate text-zinc-500" title={`Switch the canvas to ${w > 760 ? 'desktop' : 'mobile'} to see them`}>
          {n} {n === 1 ? 'mark' : 'marks'} at {w}px
        </span>
      ))}
      {v.review && (
        <a
          href={v.review.url}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-chip px-2 font-semibold text-zinc-700 transition hover:bg-chip-hover"
          title={`ReviseMy review · ${v.review.status.replace(/_/g, ' ')}`}
        >
          ReviseMy <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}
