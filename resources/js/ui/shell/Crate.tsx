import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Scissors } from 'lucide-react'
import type { Clip, SectionType } from '@/core/types'
import { SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { frameStateFor } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'
import { LayoutTag } from './Alternatives'

/**
 * The crate: every clip you've collected, dug through like records. It follows
 * the section you're on, so it usually opens on just the alternatives that matter.
 */
export function Crate() {
  const filter = useStore((s) => s.ui.crateFilter)
  const focusedType = useStore((s) => s.slots.find((x) => x.id === s.ui.focusedSlotId)?.type ?? null)
  const focusedId = useStore((s) => s.ui.focusedSlotId)
  const slots = useStore((s) => s.slots)
  const used = useMemo(() => new Set(slots.map((s) => s.clipId)), [slots])
  const st = useStore.getState
  const effective: SectionType | 'all' = filter === 'auto' ? (focusedType ?? 'all') : filter

  // Picking another section re-follows it.
  useEffect(() => {
    if (useStore.getState().ui.crateFilter !== 'auto') st().setUi({ crateFilter: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId])

  const [shelf, setShelf] = useState<'clips' | 'layouts'>('clips')
  const pool = (t: SectionType) => (shelf === 'layouts' ? library.layoutsByType[t] : library.byType[t].filter((id) => library.clips[id].origin === 'clip'))
  const ids = effective === 'all' ? SECTION_TYPES.flatMap(pool) : pool(effective)
  const scroller = useRef<HTMLDivElement>(null)
  const chip = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1'

  return (
    <div className="pb-2 pt-3">
      <div className="mb-2 flex items-center gap-3 px-3">
        <div className="flex rounded-full bg-chip p-0.5" role="tablist">
          {(['clips', 'layouts'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={shelf === k}
              onClick={() => setShelf(k)}
              className={`h-6 rounded-full px-3 text-[12px] font-semibold transition ${chip} ${
                shelf === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {k === 'clips' ? 'Your clips' : 'Layouts'}
            </button>
          ))}
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11.5px] text-zinc-500">
          <Scissors size={13} /> Drag onto a section, or click to drop in
        </span>
      </div>
      {/* full-bleed scrollers: content runs to the panel's edge, but rests aligned with the padding */}
      <div className="fade-x mb-2.5 flex scroll-px-3 items-center gap-1 overflow-x-auto px-3 py-0.5 no-scrollbar">
        {(['all', ...SECTION_TYPES] as const).map((t) => {
          const on = effective === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => st().setUi({ crateFilter: t })}
              className={`h-7 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition active:scale-[0.97] ${chip} ${
                on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]}
              {t !== 'all' && t === focusedType && <span className={`ml-1.5 inline-block size-1.5 rounded-full align-middle ${on ? 'bg-key' : 'bg-tape'}`} title="The section you’re on" />}
            </button>
          )
        })}
      </div>
      <div
        ref={scroller}
        className="thin-scroll fade-x grid scroll-px-3 auto-cols-[208px] grid-flow-col gap-2 overflow-x-auto px-3 pb-1.5"
        style={{ gridTemplateRows: effective === 'all' && ids.length > 6 ? 'repeat(2, auto)' : undefined }}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scroller.current) scroller.current.scrollLeft += e.deltaY
        }}
      >
        {ids.map((id) => (
          <ClipCard key={id} clip={library.clips[id]} used={used.has(id)} />
        ))}
        {!ids.length && (
          <div className="col-span-full flex h-[60px] items-center gap-2 text-[12.5px] text-zinc-500">
            No {effective === 'all' ? '' : `${TYPE_LABEL[effective]} `}clips yet.
            <button type="button" onClick={() => setShelf('layouts')} className={`rounded-full px-2 py-0.5 font-semibold text-zinc-800 hover:bg-zinc-950/5 ${chip}`}>
              Browse layouts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ClipCard({ clip, used }: { clip: Clip; used: boolean }) {
  const source = library.sources[clip.sourceId]
  const [hover, setHover] = useState(false)
  const timer = useRef<number>(0)
  const ref = useRef<HTMLButtonElement>(null)
  const t = clip.tokens

  const place = () => {
    const st = useStore.getState()
    const focused = st.slots.find((s) => s.id === st.ui.focusedSlotId)
    const target = focused?.type === clip.type ? focused : st.slots.find((s) => s.type === clip.type)
    if (target) {
      st.setClip(target.id, clip.id)
      st.focusSlot(target.id)
    } else st.addSlot(clip.type, clip.id)
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-mixtape-clip', clip.id)
          e.dataTransfer.effectAllowed = 'copy'
          setHover(false)
        }}
        onClick={place}
        onMouseEnter={() => {
          timer.current = window.setTimeout(() => setHover(true), 260)
        }}
        onMouseLeave={() => {
          window.clearTimeout(timer.current)
          setHover(false)
        }}
        className={`group flex items-center gap-2.5 rounded-xl p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${used ? 'bg-key-soft/70' : 'hover:bg-zinc-950/5'}`}
      >
        <div
          className="relative grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-950/10 transition group-hover:-translate-y-0.5"
          style={{ background: t['color.bg'] }}
        >
          <span style={{ fontFamily: t['font.display'], color: t['color.text'], fontWeight: Number(t['type.displayWeight']) || 600 }} className="text-[17px] leading-none">
            Aa
          </span>
          <div className="absolute bottom-1 right-1 flex gap-0.5">
            <span className="size-2 rounded-full" style={{ background: t['color.primary'] }} />
            <span className="size-2 rounded-full" style={{ background: t['color.accent'] }} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-zinc-900">{clip.origin === 'layout' ? clip.title : source?.name}</span>
            {clip.origin === 'layout' ? <LayoutTag /> : <span className="shrink-0 text-[11px] text-zinc-400">{TYPE_LABEL[clip.type]}</span>}
          </div>
          <div className="truncate text-[11.5px] text-zinc-500" title={clip.title}>
            {used ? 'On the tape' : clip.origin === 'layout' ? TYPE_LABEL[clip.type] : clip.title}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-400">{primaryFamily(t['font.display'])}</div>
        </div>
      </button>
      {hover && ref.current && createPortal(<HoverPreview clip={clip} anchor={ref.current.getBoundingClientRect()} />, document.body)}
    </>
  )
}

/** A live look at the clip as captured, floating above the crate. */
function HoverPreview({ clip, anchor }: { clip: Clip; anchor: DOMRect }) {
  const content = useStore((s) => s.content)
  const state = useMemo(() => frameStateFor(clip, null, 'captured', clip.tokens, content, 'desktop'), [clip, content])
  const [h, setH] = useState(500)
  const scale = 0.28
  const w = 1280 * scale
  const height = Math.min(h, 1400) * scale
  const left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - w / 2), window.innerWidth - w - 12)
  const top = Math.max(12, anchor.top - height - 14)
  return (
    <div className="pointer-events-none fixed z-[60] animate-pop overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-zinc-950/10" style={{ left, top, width: w, height }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: 1280 }}>
        <ClipFrame clip={clip} width={1280} state={state} onHeight={setH} />
      </div>
      <div className="absolute bottom-1.5 left-1.5 rounded-md bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[10px] text-white">{clip.origin === 'layout' ? 'Mixtape layout' : new URL(clip.capture.url).host}</div>
    </div>
  )
}
