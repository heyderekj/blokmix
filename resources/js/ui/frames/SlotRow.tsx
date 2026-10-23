import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Slot, TokenSet } from '@/core/types'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { frameStateFor, usePageStyle } from '@/state/derived'
import type { BlockEvent, FrameRect } from '@/frame/bridge'
import { useBlockPreview, withPreview } from '../blocks/preview'
import { BlockBar } from '../blocks/BlockBar'
import { ClipFrame } from '@/frame/ClipFrame'
import { VIEW_W } from '../canvas/geometry'
import { SectionPill, SectionRail } from './SectionPill'

const SPIN_STEP = 90
/** Clip swaps: short, firm and settled, like flipping a card, not spinning a reel. */
const SWAP = '240ms cubic-bezier(0.2, 0.9, 0.25, 1)'
/** How far a clip travels as it swaps, as a share of the page width. */
const NUDGE = 0.08

interface Props {
  slot: Slot
  index: number
  count: number
  guide: TokenSet
  focused: boolean
}

/**
 * One section of the working mix: every clip of this section type sits side by side, and
 * the row slides between them. Neighbors peek out beside the page so it reads
 * like a sliding-tile puzzle.
 */
export const SlotRow = memo(function SlotRow({ slot, index, count, guide, focused }: Props) {
  const mode = useStore((s) => s.ui.mode)
  const viewport = useStore((s) => s.ui.viewport)
  const content = useStore((s) => s.content)
  const shuffleSeq = useStore((s) => s.shuffleSeq)
  const previewing = useStore((s) => s.ui.previewFrameId === 'mix')
  const tool = useStore((s) => s.ui.tool)
  const selectedBlock = useStore((s) => (focused ? s.ui.selectedBlockId : null))
  const page = usePageStyle()
  const pSlot = useBlockPreview((s) => s.slotId)
  const pBlock = useBlockPreview((s) => s.blockId)
  const pPatch = useBlockPreview((s) => s.patch)
  const editText = useBlockPreview((s) => s.editText)
  // The slot as shown: with any look you're hovering in a picker applied, uncommitted.
  const live = useMemo(() => withPreview(slot, { slotId: pSlot, blockId: pBlock, patch: pPatch }), [slot, pSlot, pBlock, pPatch])
  const ids = library.byType[slot.type]
  const W = VIEW_W[viewport]

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

  // ---- blocks: hover, select and edit inside the current clip ----
  const canEdit = focused && mode === 'unified' && tool === 'select' && !previewing && !spinning && shown === slot.clipId
  const [hover, setHover] = useState<{ id: string; rect: FrameRect } | null>(null)
  const [selRect, setSelRect] = useState<FrameRect | null>(null)
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    if (!canEdit) setHover(null)
  }, [canEdit])
  useEffect(() => {
    if (!selectedBlock) setSelRect(null)
  }, [selectedBlock])
  const blocks = library.clips[shown]?.blocks ?? []
  const block = selectedBlock ? blocks.find((b) => b.id === selectedBlock) : undefined
  const edit = useMemo(
    () =>
      canEdit
        ? {
            selected: selectedBlock,
            editText: editText && blocks.some((b) => b.id === editText.id) ? editText : null,
            onEvent: (e: BlockEvent) => {
              if ('hover' in e) setHover(e.hover ?? null)
              if ('pick' in e) st().selectBlock(e.pick ?? null)
              if ('selRect' in e) setSelRect(e.selRect ?? null)
              if (e.word) st().setWord(slot.id, e.word.field, e.word.value)
              if ('editing' in e) setTyping(!!e.editing)
              if (e.key) {
                const k = e.key
                window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, metaKey: k.meta, ctrlKey: k.ctrl, shiftKey: k.shift, altKey: k.alt, bubbles: true }))
              }
            },
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, selectedBlock, editText, shown, slot.id],
  )

  return (
    <div
      ref={rowRef}
      className="group/row relative"
      style={{
        height,
        transition: `height ${SWAP}`,
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
      {/* the clips side by side, clipped to the current clip's height */}
      {/* slides happen inside the page: only the current clip is ever visible */}
      <div className={`absolute inset-0 overflow-hidden ${index === 0 ? 'frame-r-top' : ''} ${index === count - 1 ? 'frame-r-bottom' : ''}`}>
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
              slot={live}
              page={page}
              edit={isCurrent ? edit : null}
              rel={rel}
              jump={jump}
              spinning={spinning}
              width={W}
              mode={mode}
              guide={guide}
              content={content}
              viewport={viewport}
              replayKey={isCurrent ? landed : 0}
              interactive={isCurrent && previewing}
              onHeight={(h) => setHeights((m) => (m[clipId] === h ? m : { ...m, [clipId]: h }))}
              onPick={() => st().setClip(slot.id, clipId)}
              edge={`${index === 0 ? 'frame-r-top' : ''} ${index === count - 1 ? 'frame-r-bottom' : ''}`}
            />
          )
        })}
      </div>

      {dropping && <div className="pointer-events-none absolute inset-0 z-10 bg-tape/15" style={{ boxShadow: 'inset 0 0 0 calc(4px / var(--z)) var(--color-tape)' }} />}

      {/* focus ring */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${index === 0 ? 'frame-r-top' : ''} ${index === count - 1 ? 'frame-r-bottom' : ''}`}
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

      {/* block outlines, in page pixels: the current frame sits at 0,0 at 1:1 */}
      {canEdit && hover && hover.id !== selectedBlock && (
        <div
          className="pointer-events-none absolute z-10 rounded-[2px]"
          style={{ left: hover.rect.x, top: hover.rect.y, width: hover.rect.w, height: hover.rect.h, boxShadow: '0 0 0 calc(1.5px / var(--z)) color-mix(in oklab, var(--color-tape) 70%, transparent)' }}
        />
      )}
      {canEdit && block && selRect && (
        <>
          <div
            className="pointer-events-none absolute z-10 rounded-[2px]"
            style={{ left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h, boxShadow: '0 0 0 calc(2px / var(--z)) var(--color-tape)' }}
          />
          {!typing && (
            // Below the block, menus opening downwards, so the block stays in view while you preview looks on it.
            <div className="absolute z-30" style={{ left: selRect.x, top: selRect.y + selRect.h, width: 0, height: 0 }}>
              <div className="absolute left-0 top-0 origin-top-left pt-2" style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }}>
                <BlockBar slot={slot} block={block} rect={selRect} />
              </div>
            </div>
          )}
        </>
      )}

      <SectionRail slot={slot} index={index} focused={focused} />
      {focused && !block && <SectionPill slot={slot} index={index} count={count} focused={focused} pos={shownIndex + 1} total={ids.length} />}
    </div>
  )
})

const Tile = memo(function Tile(p: {
  clipId: string
  slot: Slot
  page: ReturnType<typeof usePageStyle>
  edit: Parameters<typeof ClipFrame>[0]['edit']
  rel: number
  jump: boolean
  spinning: boolean
  width: number
  mode: 'captured' | 'unified'
  guide: TokenSet
  content: ReturnType<typeof useStore.getState>['content']
  viewport: 'desktop' | 'mobile'
  replayKey: number
  interactive: boolean
  onHeight: (h: number) => void
  onPick: () => void
  edge: string
}) {
  const clip = library.clips[p.clipId]
  const state = useMemo(
    () => frameStateFor(clip, p.slot, p.mode, p.guide, p.content, p.viewport, p.page),
    [clip, p.slot, p.mode, p.guide, p.content, p.viewport, p.page],
  )
  const isCurrent = p.rel === 0
  const transition = p.jump
    ? 'opacity 200ms'
    : p.spinning
      ? `transform ${SPIN_STEP - 10}ms linear, opacity 120ms`
      : `transform ${SWAP}, opacity 160ms ease-out`
  return (
    <div
      className={`absolute left-0 top-0 overflow-hidden ${p.edge}`}
      style={{
        // the outgoing clip shifts a little and fades while the next one shifts in from that side
        transform: `translateX(${Math.sign(p.rel) * p.width * NUDGE}px)`,
        opacity: isCurrent ? 1 : 0,
        transition,
        pointerEvents: isCurrent ? 'auto' : 'none',
      }}
      onClick={(e) => {
        if (isCurrent) return
        e.stopPropagation()
        p.onPick()
      }}
    >
      <ClipFrame clip={clip} width={p.width} state={state} replayKey={p.replayKey} interactive={p.interactive} onHeight={p.onHeight} edit={p.edit} />
    </div>
  )
})

function EdgeButton({ side, onClick, visible }: { side: 'left' | 'right'; onClick: () => void; visible: boolean }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <div className="absolute top-1/2 z-30 h-0 w-0" style={{ [side]: 0 }} data-chrome>
      {/* a generous, invisible hit area around the visible button, clear of the gutter rail */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={`group/edge grid size-16 place-items-center rounded-full transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}
        style={{
          transform: `scale(min(calc(1 / var(--z)), 3.4)) translate(${side === 'left' ? '-34px' : '34px'}, -50%)`,
          transformOrigin: side === 'left' ? '100% 0' : '0 0',
          position: 'absolute',
          [side === 'left' ? 'right' : 'left']: 0,
          top: 0,
        }}
        aria-label={side === 'left' ? 'Previous clip' : 'Next clip'}
      >
        <span className="grid size-11 place-items-center rounded-full border border-zinc-950/10 bg-white text-zinc-800 shadow-lg transition-[scale] duration-150 group-hover/edge:scale-110 group-active/edge:scale-90">
          <Icon size={22} strokeWidth={2.4} />
        </span>
      </button>
    </div>
  )
}
