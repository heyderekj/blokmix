import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Slot, TokenSet } from '@/core/types'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { frameStateFor } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'
import { TILE_GAP, VIEW_W } from '../canvas/geometry'
import { TrackPill } from './TrackPill'

const SPIN_STEP = 90

interface Props {
  slot: Slot
  index: number
  count: number
  guide: TokenSet
  focused: boolean
}

/**
 * One track of the tape: every clip of this section type sits side by side, and
 * the row slides between them. Neighbors peek out beside the page so it reads
 * like a sliding-tile puzzle.
 */
export const SlotRow = memo(function SlotRow({ slot, index, count, guide, focused }: Props) {
  const mode = useStore((s) => s.ui.mode)
  const viewport = useStore((s) => s.ui.viewport)
  const content = useStore((s) => s.content)
  const shuffleSeq = useStore((s) => s.shuffleSeq)
  const previewing = useStore((s) => s.ui.previewFrameId === 'mix')
  const ids = library.byType[slot.type]
  const W = VIEW_W[viewport]
  const GAP = TILE_GAP[viewport]

  // `shown` trails the store so shuffles can spin like a slot machine before landing.
  const [shown, setShown] = useState(slot.clipId)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState(0)
  const seqRef = useRef(shuffleSeq)
  const timer = useRef<number>(0)

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (shown === slot.clipId) return
    const isShuffle = shuffleSeq !== seqRef.current
    seqRef.current = shuffleSeq
    if (!isShuffle || ids.length < 2) {
      setShown(slot.clipId)
      setLanded((n) => n + 1)
      return
    }
    const n = ids.length
    let cur = ids.indexOf(shown)
    const target = ids.indexOf(slot.clipId)
    const steps = ((target - cur + n) % n) + n
    let k = 0
    const tick = () => {
      k++
      cur = (cur + 1) % n
      setShown(ids[cur])
      if (k < steps) {
        setSpinning(true)
        timer.current = window.setTimeout(tick, SPIN_STEP)
      } else {
        setSpinning(false)
        setLanded((x) => x + 1)
      }
    }
    timer.current = window.setTimeout(tick, index * 70)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.clipId, shuffleSeq])

  const [heights, setHeights] = useState<Record<string, number>>({})
  const height = heights[shown] ?? 520
  const rowRef = useRef<HTMLDivElement>(null)
  const setRow = useLayout((s) => s.setRow)
  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => setRow(slot.id, el.offsetTop, el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slot.id, setRow, height, index])

  const [dropping, setDropping] = useState(false)
  const prevRel = useRef<Record<string, number>>({})
  const shownIndex = ids.indexOf(shown)
  const st = useStore.getState

  return (
    <div
      ref={rowRef}
      className="group/row relative"
      style={{
        height,
        transition: 'height 520ms cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: focused ? 20 : 1,
      }}
      onPointerDown={() => st().focusSlot(slot.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-mixtape-clip')) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        const clipId = e.dataTransfer.getData('application/x-mixtape-clip')
        setDropping(false)
        const clip = library.clips[clipId]
        if (!clip) return
        e.preventDefault()
        e.stopPropagation()
        if (clip.type === slot.type) st().setClip(slot.id, clipId)
        else st().addSlot(clip.type, clipId, index + 1)
        st().focusSlot(clip.type === slot.type ? slot.id : useStore.getState().ui.focusedSlotId)
      }}
      data-slot={slot.id}
    >
      {/* the track: clips side by side, clipped to the current clip's height */}
      <div className="absolute inset-0" style={{ overflow: 'visible clip' }}>
        {ids.map((clipId, i) => {
          const n = ids.length
          let rel = (((i - shownIndex) % n) + n) % n
          if (rel > n / 2) rel -= n
          const jump = Math.abs(rel - (prevRel.current[clipId] ?? rel)) > 1
          prevRel.current[clipId] = rel
          const isCurrent = rel === 0
          return (
            <Tile
              key={clipId}
              clipId={clipId}
              slot={slot}
              rel={rel}
              jump={jump}
              spinning={spinning}
              width={W}
              gap={GAP}
              mode={mode}
              guide={guide}
              content={content}
              viewport={viewport}
              replayKey={isCurrent ? landed : 0}
              interactive={isCurrent && previewing}
              onHeight={(h) => setHeights((m) => (m[clipId] === h ? m : { ...m, [clipId]: h }))}
              onPick={() => st().setClip(slot.id, clipId)}
            />
          )
        })}
      </div>

      {dropping && <div className="pointer-events-none absolute inset-0 z-10 bg-tape/15" style={{ boxShadow: 'inset 0 0 0 calc(4px / var(--z)) var(--color-tape)' }} />}

      {/* focus ring */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          boxShadow: `inset 0 0 0 calc(3px / var(--z)) var(--color-tape)`,
          opacity: focused ? 1 : 0,
        }}
      />
      {!slot.keep.layout && mode === 'unified' && (
        <div className="pointer-events-none absolute right-0 top-0 origin-top-right" style={{ transform: 'scale(calc(1 / var(--z)))' }}>
          <span className="m-2 inline-block rounded-md bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-white">Layout: reference only</span>
        </div>
      )}

      {/* chevrons on the page edges */}
      {ids.length > 1 && !previewing && (
        <>
          <EdgeButton side="left" onClick={() => st().cycle(slot.id, -1)} visible={focused} />
          <EdgeButton side="right" onClick={() => st().cycle(slot.id, 1)} visible={focused} />
        </>
      )}

      <TrackPill slot={slot} index={index} count={count} focused={focused} pos={shownIndex + 1} total={ids.length} />
    </div>
  )
})

const Tile = memo(function Tile(p: {
  clipId: string
  slot: Slot
  rel: number
  jump: boolean
  spinning: boolean
  width: number
  gap: number
  mode: 'captured' | 'unified'
  guide: TokenSet
  content: ReturnType<typeof useStore.getState>['content']
  viewport: 'desktop' | 'mobile'
  replayKey: number
  interactive: boolean
  onHeight: (h: number) => void
  onPick: () => void
}) {
  const clip = library.clips[p.clipId]
  const state = useMemo(
    () => frameStateFor(clip, p.slot, p.mode, p.guide, p.content, p.viewport),
    [clip, p.slot, p.mode, p.guide, p.content, p.viewport],
  )
  const visible = Math.abs(p.rel) <= 1
  const isCurrent = p.rel === 0
  const transition = p.jump
    ? 'opacity 200ms'
    : p.spinning
      ? `transform ${SPIN_STEP - 10}ms linear, opacity 120ms`
      : 'transform 560ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 300ms'
  return (
    <div
      className={`absolute left-0 top-0 ${isCurrent ? '' : 'cursor-pointer hover:!opacity-70'}`}
      style={{
        transform: `translateX(${p.rel * (p.width + p.gap)}px)`,
        opacity: isCurrent ? 1 : visible ? 0.3 : 0,
        transition,
        pointerEvents: visible ? 'auto' : 'none',
        filter: isCurrent ? undefined : 'saturate(0.6)',
      }}
      onClick={(e) => {
        if (isCurrent) return
        e.stopPropagation()
        p.onPick()
      }}
    >
      <ClipFrame clip={clip} width={p.width} state={state} replayKey={p.replayKey} interactive={p.interactive} onHeight={p.onHeight} />
    </div>
  )
})

function EdgeButton({ side, onClick, visible }: { side: 'left' | 'right'; onClick: () => void; visible: boolean }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <div className="absolute top-1/2 h-0 w-0" style={{ [side]: 0 }} data-chrome>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={`grid size-11 place-items-center rounded-full border border-zinc-950/10 bg-white text-zinc-800 shadow-lg transition-[opacity,scale] duration-200 hover:scale-110 active:scale-90 ${
          visible ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'
        }`}
        style={{
          transform: `scale(min(calc(1 / var(--z)), 3.4)) translate(${side === 'left' ? '-30%' : '30%'}, -50%)`,
          transformOrigin: side === 'left' ? '100% 0' : '0 0',
          position: 'absolute',
          [side === 'left' ? 'right' : 'left']: 0,
          top: 0,
        }}
        aria-label={side === 'left' ? 'Previous clip' : 'Next clip'}
      >
        <Icon size={22} strokeWidth={2.4} />
      </button>
    </div>
  )
}
