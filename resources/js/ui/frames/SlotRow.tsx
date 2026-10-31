import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import type { Slot, TokenSet } from '@/core/types'
import { library, slotClip } from '@/data/library'
import { pickable } from '@/core/library'
import { editList as applyListEdit, listContext, listOrder, sectionClip, tileNeighbor, type TileDir } from '@/core/lists'
import { useTiles } from './tiles'
import { applyBindings, emptyTargets } from '@/core/collections'
import { entryPathFor, templateEntry, useCollections } from '@/state/collections'
import { createPortal } from 'react-dom'
import { onSection } from '@/core/notes'
import { useStore, currentSlots } from '@/state/store'
import { useLayout } from '@/state/layout'
import { frameStateFor, usePageStyle, withoutShaders } from '@/state/derived'
import { postState, type BlockEvent, type FrameRect } from '@/frame/bridge'
import { useBlockPreview, withPreview } from '../blocks/preview'
import { BlockBar } from '../blocks/BlockBar'
import { SectionMarks, draftForBlock, useMarkDraft, type MarkDraft } from '../notes/Marks'
import { resolveFields, TYPE_LABEL } from '@/core/content'
import { useAssets } from '@/lib/assets'
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
export const SlotRow = memo(function SlotRow({ slot: own, index, count, guide, focused }: Props) {
  // A section bound to your collections shows their entries: everything below draws (and selects in) that.
  const collections = useCollections((s) => s.bySlug)
  const pages = useStore((s) => s.site.pages)
  const picked = useStore((s) => s.ui.previewEntry)
  const { slot, targets } = useMemo(() => {
    if (!own.bind || !library.clips[own.clipId]) return { slot: own, targets: null }
    const targets = emptyTargets()
    // On a collection's template page, fields bound to "the entry" show the one it previews.
    const entry = templateEntry(pages.find((p) => p.slots.some((s) => s.id === own.id)), picked, collections)
    return { slot: applyBindings(own, library.clips[own.clipId], { collections, entryPath: entryPathFor({ pages }), entry }, targets), targets }
  }, [own, collections, pages, picked])
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
  const pWords = useBlockPreview((s) => s.words)
  const pBackdrop = useBlockPreview((s) => s.backdrop)
  const editText = useBlockPreview((s) => s.editText)
  const replays = useBlockPreview((s) => s.replays)
  // The slot as shown: with any look you're hovering in a picker applied, uncommitted.
  // While an item is dragged, the section shows the list as it would be with the item dropped where it is now.
  const [sorting, setSorting] = useState<{ itemId: string; from: number; to: number } | null>(null)
  const live = useMemo(() => {
    let s = withPreview(slot, { slotId: pSlot, blockId: pBlock, patch: pPatch, words: pWords, backdrop: pBackdrop })
    if (sorting && sorting.to !== sorting.from)
      try {
        s = applyListEdit(s, slotClip(s), content, { op: 'move', itemId: sorting.itemId, to: sorting.to })
      } catch {
        /* not movable after all: show it as it is */
      }
    return s
  }, [slot, pSlot, pBlock, pPatch, pWords, pBackdrop, sorting, content])
  const ids = pickable(library, slot.type)
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

  // ---- blocks: hover, select and edit inside the current clip; or mark them with the Note tool ----
  const current = !previewing && !spinning && shown === slot.clipId
  const canEdit = focused && mode === 'unified' && tool === 'select' && current
  const noting = tool === 'note' && current
  const [hover, setHover] = useState<{ id: string; rect: FrameRect } | null>(null)
  const [selRect, setSelRect] = useState<FrameRect | null>(null)
  // While a look is previewed on the selected block, the bar stays where it was: a preview that changes the block's
  // size would otherwise move the menu under the pointer, which previews another look, and so on (jitter).
  const barRef = useRef<FrameRect | null>(null)
  const previewingHere = pSlot === slot.id && !!pPatch
  if (selRect && (!previewingHere || !barRef.current)) barRef.current = selRect
  const barAt = selRect ? barRef.current : null
  const [typing, setTyping] = useState(false)
  const [rects, setRects] = useState<Record<string, FrameRect>>({})
  const [drawing, setDrawing] = useState<FrameRect | null>(null)
  useEffect(() => {
    if (!canEdit && !noting) setHover(null)
  }, [canEdit, noting])
  useEffect(() => {
    if (!selectedBlock) setSelRect(null)
  }, [selectedBlock])
  const sectioned = library.clips[shown] ? sectionClip(library.clips[shown], slot.lists, { banner: slot.banner }) : null
  const blocks = sectioned?.blocks ?? []
  const block = selectedBlock ? blocks.find((b) => b.id === selectedBlock) : undefined
  // List items can be dragged among their siblings. Pointing at (or selecting) anything inside an item shows its grip;
  // it stays on that item while the pointer travels to it. The frame reports where every movable item is.
  const itemOf = useCallback(
    (id: string | null | undefined) => {
      for (let b = blocks.find((x) => x.id === id); b; b = blocks.find((x) => x.id === b!.parent)) if (b.kind === 'item') return b
      return undefined
    },
    [blocks],
  )
  const movable = useMemo(
    () => (canEdit && sectioned ? blocks.filter((b) => b.kind === 'item' && listContext(sectioned, slot, b.id)?.count! > 1) : []),
    [canEdit, sectioned, slot, blocks],
  )
  const [pointed, setPointed] = useState<string | null>(null)
  useEffect(() => {
    if (!hover) return // the pointer left the frame (maybe for the grip): keep the last item
    setPointed(itemOf(hover.id)?.id ?? null)
  }, [hover, itemOf])
  useEffect(() => {
    if (!canEdit) setPointed(null)
  }, [canEdit])
  const grabbed = sorting?.itemId ?? itemOf(selectedBlock)?.id ?? pointed
  const items = useMemo(() => {
    const ctx = sectioned && grabbed && canEdit ? listContext(sectioned, slot, grabbed) : null
    if (!ctx?.item || ctx.count < 2 || !sectioned) return null
    const order = listOrder(sectioned, ctx.list.id)
    const siblings = blocks.filter((b) => b.parent === ctx.list.id && b.kind === 'item' && b.n != null).sort((a, b) => order.indexOf(a.n!) - order.indexOf(b.n!))
    return { item: ctx.item, index: ctx.index, siblings }
  }, [sectioned, grabbed, canEdit, slot, blocks])
  // Blocks with a pin on them: the frame reports where they are.
  const notes = useStore((s) => s.notes)
  const track = useMemo(
    () => [
      ...new Set(
        notes.flatMap((n) => (n.kind && (n.anchor.kind === 'block' || n.anchor.kind === 'words') && n.anchor.slotId === slot.id && n.anchor.clipId === shown && n.anchor.blockId ? [n.anchor.blockId] : [])),
      ),
    ],
    [notes, slot.id, shown],
  )
  // The sliding-tile arrows and ⌥ + arrow keys look for neighbours among the active item's siblings.
  useEffect(() => {
    if (!items) return
    const ids = items.siblings.map((b) => b.id)
    useTiles.getState().set(slot.id, ids, Object.fromEntries(ids.flatMap((id) => (rects[id] ? [[id, rects[id]]] : []))))
  }, [items, rects, slot.id])
  useEffect(() => {
    if (!items && useTiles.getState().slotId === slot.id) useTiles.getState().set(null, [], {})
  }, [items, slot.id])
  const trackAll = useMemo(() => (movable.length ? [...new Set([...track, ...movable.map((b) => b.id)])] : track), [track, movable])
  const frameH = heights[shown] ?? 520
  const drafting = useMarkDraft((s) => s.draft?.slotId === slot.id)
  // When a note on selected words closes, let go of the text selection in the page.
  useEffect(() => {
    if (drafting) return
    rowRef.current?.querySelectorAll('iframe').forEach((f) => postState(f.contentWindow, { clearSelection: true }))
  }, [drafting])
  const openNote = useStore((s) => s.ui.openNoteId)
  const noteOpen = drafting || (!!openNote && notes.some((n) => n.id === openNote && onSection(n.anchor) === slot.id))
  const edit = useMemo(
    () => ({
      active: canEdit || noting,
      noteMode: noting,
      selected: canEdit ? selectedBlock : null,
      editText: canEdit && editText && blocks.some((b) => b.id === editText.id) ? editText : null,
      track: trackAll,
      onEvent: (e: BlockEvent) => {
        if ('hover' in e) setHover(e.hover ?? null)
        if ('pick' in e) st().selectBlock(e.pick ?? null)
        if ('selRect' in e) setSelRect(e.selRect ?? null)
        // Words typed into a field that shows a collection go to its entry.
        const bound = e.word ? targets?.fields.get(e.word.field) : undefined
        if (e.word && bound) {
          useCollections.getState().updateEntry(bound.collection, bound.entry, { data: { [bound.field]: e.word.value } })
        } else if (e.word) {
          st().setWord(slot.id, e.word.field, e.word.value)
          // "Another way to say it": what you just wrote is kept as an option too.
          const k = useBlockPreview.getState().keepNext
          if (k && k.slotId === slot.id && k.field === e.word.field) {
            st().keepWords(slot.id, e.word.field, e.word.value)
            useBlockPreview.getState().setKeepNext(null)
          }
        }
        if ('editing' in e) setTyping(!!e.editing)
        if (e.rects) setRects((r) => ({ ...r, ...e.rects }))
        if ('drag' in e) setDrawing(e.drag ?? null)
        if (e.words) {
          const w = e.words
          const live = currentSlots(useStore.getState()).find((x) => x.id === slot.id)!
          const b = slotClip(live).blocks.find((x) => x.id === w.block)
          st().setUi({ openNoteId: null })
          useMarkDraft.getState().open({
            slotId: live.id,
            rect: w.rect,
            anchor: { kind: 'words', slotId: live.id, clipId: live.clipId, blockId: b?.id ?? '', label: b?.label ?? TYPE_LABEL[live.type], field: w.field, quote: w.quote },
          })
        } else if ('notePick' in e || e.area) {
          const live = currentSlots(useStore.getState()).find((x) => x.id === slot.id)!
          // Marking doesn't focus the section: the dock stays small and the page stays in view.
          st().setUi({ openNoteId: null })
          const clip = slotClip(live)
          const words = resolveFields(clip.type, clip.fields, useStore.getState().content, live.keep.content, live.words).fields
          let draft: MarkDraft | null = null
          if (e.notePick && e.rect) draft = draftForBlock(live, e.notePick, e.rect, words)
          else {
            // An area, or a click on something that isn't a block: mark a small area around the point.
            const r = e.area ?? (e.at ? { x: e.at.x - 24, y: e.at.y - 24, w: 48, h: 48 } : null)
            if (r) draft = { slotId: live.id, rect: r, anchor: { kind: 'area', slotId: live.id, clipId: live.clipId, rect: { x: r.x / W, y: r.y / frameH, w: r.w / W, h: r.h / frameH } } }
          }
          if (draft) useMarkDraft.getState().open(draft)
        }
        if (e.key) {
          const k = e.key
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, metaKey: k.meta, ctrlKey: k.ctrl, shiftKey: k.shift, altKey: k.alt, bubbles: true }))
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, noting, selectedBlock, editText, shown, slot.id, trackAll, focused, W, frameH, targets],
  )

  return (
    <div
      ref={rowRef}
      // A section you aren't in yet takes the click to focus it (its frame ignores the pointer until then): say so.
      className={`group/row relative ${!canEdit && tool === 'select' ? 'cursor-pointer' : ''}`}
      style={{
        height,
        transition: `height ${SWAP}`,
        // Above its neighbours while it's focused or has a note open, so cards and menus aren't covered.
        zIndex: focused || noteOpen ? 20 : 1,
      }}
      onPointerDown={() => st().focusSlot(slot.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-blokmix-clip')) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        const clipId = e.dataTransfer.getData('application/x-blokmix-clip')
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
              replayKey={isCurrent ? landed + (focused ? replays : 0) : 0}
              interactive={isCurrent && previewing}
              onHeight={(h) => setHeights((m) => (m[clipId] === h ? m : { ...m, [clipId]: h }))}
              onPick={() => st().setClip(slot.id, clipId)}
              edge={`${index === 0 ? 'frame-r-top' : ''} ${index === count - 1 ? 'frame-r-bottom' : ''}`}
            />
          )
        })}
      </div>

      {dropping && <div className="pointer-events-none absolute inset-0 z-10 bg-key/15" style={{ boxShadow: 'inset 0 0 0 calc(4px / var(--z)) var(--color-key)' }} />}

      {/* focus ring */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${index === 0 ? 'frame-r-top' : ''} ${index === count - 1 ? 'frame-r-bottom' : ''}`}
        style={{
          boxShadow: `inset 0 0 0 calc(3px / var(--z)) var(--color-key)`,
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
      {/* Koati's picker: one outline that glides to whatever's under the pointer, with a chip naming it */}
      <PickOutline rect={canEdit && !sorting && hover && hover.id !== selectedBlock ? hover.rect : null} label={hover ? partLabel(blocks.find((b) => b.id === hover.id)?.label) : ''} />
      {/* Note mode snaps to the block under the pointer; a drag lets go and draws an area instead */}
      {noting && hover && !drawing && (
        <div
          className="pointer-events-none absolute z-10 rounded-[3px] bg-problem/5"
          style={{ left: hover.rect.x, top: hover.rect.y, width: hover.rect.w, height: hover.rect.h, boxShadow: '0 0 0 calc(1.5px / var(--z)) var(--color-problem)' }}
        >
          <span
            className="absolute bottom-full left-0 mb-1 origin-bottom-left whitespace-nowrap rounded-md bg-problem px-1.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }}
          >
            {blocks.find((b) => b.id === hover.id)?.label.split(' · ').slice(1).join(' · ') || 'Block'}
          </span>
        </div>
      )}
      {canEdit && block && selRect && !sorting && (
        <>
          <PickOutline rect={selRect} picked />
          {!typing && (
            // Below the block, menus opening downwards, so the block stays in view while you preview looks on it.
            <div className="absolute z-30" style={{ left: barAt!.x, top: barAt!.y + barAt!.h, width: 0, height: 0 }}>
              <div className="absolute left-0 top-0 w-max origin-top-left pt-3.5" style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }}>
                <BlockBar slot={slot} block={block} rect={selRect} />
              </div>
            </div>
          )}
        </>
      )}

      {items && rects[items.item.id] && !typing && (
        <ItemDrag slotId={slot.id} items={items} rect={rects[items.item.id]} rects={rects} row={rowRef} pageW={W} sorting={sorting} onSort={setSorting} />
      )}

      <SectionMarks slot={slot} width={W} height={frameH} rects={rects} drawing={drawing} />

      <SectionRail slot={slot} index={index} focused={focused} />
      {focused && !block && <SectionPill slot={slot} index={index} count={count} focused={focused} pos={shownIndex + 1} total={ids.length} />}
    </div>
  )
})

/** "Features · Feature 2 · Heading" → "Feature 2 · Heading": the section is already on screen. */
const partLabel = (label: string | undefined) => label?.split(' · ').slice(1).join(' · ') || 'Block'

/**
 * The outline Koati's picker draws (after Claude's artifact feedback tool): a tinted
 * border with a faint fill and a soft halo, thicker once picked. It stays mounted and
 * glides between blocks instead of blinking from one to the next.
 */
/**
 * Drag a list item among its siblings, like a sortable list: grab the grip, and as the pointer passes over another
 * item the list reflows live in the section (the others make room); letting go keeps that order (one undo step, like
 * ⌥←/→). Escape puts it back. A screen-wide layer takes the pointer while dragging, so the section's frame can't
 * swallow it.
 */
function ItemDrag({
  slotId,
  items,
  rect,
  rects,
  row,
  pageW,
  sorting,
  onSort,
}: {
  slotId: string
  items: { item: { id: string }; index: number; siblings: { id: string }[] }
  rect: FrameRect
  rects: Record<string, FrameRect>
  row: React.RefObject<HTMLDivElement | null>
  pageW: number
  sorting: { itemId: string; from: number; to: number } | null
  onSort: (s: { itemId: string; from: number; to: number } | null) => void
}) {
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const state = useRef({ to: items.index, at: 0, grab: { x: 0, y: 0 }, rects, order: items.siblings.map((b) => b.id) })
  state.current.rects = rects
  // The pointer in page pixels (the row is drawn at the canvas zoom).
  const at = (e: { clientX: number; clientY: number }) => {
    const box = row.current!.getBoundingClientRect()
    const k = box.width / pageW
    return { x: (e.clientX - box.left) / k, y: (e.clientY - box.top) / k }
  }
  const start = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const st = state.current
    // The committed order, and where in the item the pointer took hold.
    st.order = items.siblings.map((b) => b.id)
    st.to = items.index
    // A wide item travels as a compact card, held at the same spot.
    const p0 = at(e)
    const k = Math.min(1, 360 / rect.w)
    st.grab = { x: (p0.x - rect.x) * k, y: (p0.y - rect.y) * k }
    setGhost({ x: p0.x - st.grab.x, y: p0.y - st.grab.y, w: rect.w * k, h: rect.h * k })
    onSort({ itemId: items.item.id, from: items.index, to: items.index })
  }
  const move = (e: React.PointerEvent) => {
    const st = state.current
    const p = at(e)
    setGhost((g) => (g ? { ...g, x: p.x - st.grab.x, y: p.y - st.grab.y } : g))
    // Wait for the last reflow to land before reading where things are now.
    if (performance.now() - st.at < 140) return
    // The order on screen right now: the committed one with the dragged item at its preview place.
    const shown = st.order.filter((id) => id !== items.item.id)
    shown.splice(st.to, 0, items.item.id)
    const over = shown.find((id) => {
      if (id === items.item.id) return false
      const r = st.rects[id]
      return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
    })
    if (!over) return
    const to = shown.indexOf(over)
    if (to === st.to) return
    st.to = to
    st.at = performance.now()
    onSort({ itemId: items.item.id, from: items.index, to })
  }
  const end = (commit: boolean) => {
    const to = state.current.to
    setGhost(null)
    if (commit && to !== items.index) useStore.getState().editList(slotId, { op: 'move', itemId: items.item.id, to })
    onSort(null)
  }
  useEffect(() => {
    if (!sorting) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && end(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const dragging = !!ghost
  return (
    <>
      {/* The item's place: a dashed outline (and while dragging, the gap it will drop into). */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-10"
        style={{
          width: rect.w,
          height: rect.h,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), width 160ms cubic-bezier(0.23, 1, 0.32, 1), height 160ms cubic-bezier(0.23, 1, 0.32, 1)',
          borderRadius: 'calc(6px / var(--z))',
          outline: `calc(${dragging ? 2 : 1.5}px / var(--z)) dashed color-mix(in oklab, var(--color-key) ${dragging ? 100 : 70}%, transparent)`,
          outlineOffset: 'calc(3px / var(--z))',
          background: dragging ? 'color-mix(in oklab, var(--color-key) 8%, transparent)' : undefined,
        }}
      />
      {ghost && (
        // What you're carrying, under the pointer.
        <div
          className="pointer-events-none absolute left-0 top-0 z-40"
          style={{
            width: ghost.w,
            height: ghost.h,
            transform: `translate(${ghost.x}px, ${ghost.y}px) rotate(-1deg)`,
            borderRadius: 'calc(8px / var(--z))',
            background: 'color-mix(in oklab, var(--color-key) 16%, transparent)',
            boxShadow: '0 0 0 calc(2px / var(--z)) var(--color-key), 0 calc(24px / var(--z)) calc(48px / var(--z)) calc(-16px / var(--z)) rgb(0 0 0 / 0.45)',
          }}
        />
      )}
      <div className="absolute z-30" style={{ left: rect.x, top: rect.y, width: 0, height: 0 }} data-chrome>
        <button
          type="button"
          title="Drag to move this item among the others (or ⌥← ⌥→)"
          aria-label="Drag to move this item"
          onPointerDown={start}
          className={`absolute left-[calc(8px/var(--z))] top-[calc(8px/var(--z))] grid origin-top-left place-items-center rounded-full bg-key text-white shadow-[0_4px_12px_-4px_rgb(0_0_0/0.4)] transition-transform ${dragging ? 'cursor-grabbing' : 'cursor-grab hover:scale-110'}`}
          style={{ width: 26, height: 26, scale: 'min(calc(1 / var(--z)), 3.4)', touchAction: 'none' }}
        >
          <GripVertical size={14} />
        </button>
      </div>
      {!dragging && <TileArrows slotId={slotId} itemId={items.item.id} rect={rect} rects={rects} ids={items.siblings.map((b) => b.id)} />}
      {dragging &&
        createPortal(
          // Takes the pointer for the whole drag, above the canvas frames.
          <div
            className="fixed inset-0 z-[100] cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerMove={move}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
            onContextMenu={(e) => e.preventDefault()}
          />,
          document.body,
        )}
    </>
  )
}

const TILE_ARROW = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight } as const

/**
 * Sliding-tile arrows on an item's edges: one for each side that has a neighbour on screen. A click swaps the two
 * (the item below in a grid, the next question in a stack), one undo step; ⌥ + arrow keys do the same.
 */
function TileArrows({ slotId, itemId, rect, rects, ids }: { slotId: string; itemId: string; rect: FrameRect; rects: Record<string, FrameRect>; ids: string[] }) {
  const dirs = (['up', 'down', 'left', 'right'] as TileDir[]).flatMap((d) => {
    const other = tileNeighbor(rects, ids, itemId, d)
    return other ? [{ d, other }] : []
  })
  const place: Record<TileDir, { left: number; top: number }> = {
    up: { left: rect.x + rect.w / 2, top: rect.y },
    down: { left: rect.x + rect.w / 2, top: rect.y + rect.h },
    left: { left: rect.x, top: rect.y + rect.h / 2 },
    right: { left: rect.x + rect.w, top: rect.y + rect.h / 2 },
  }
  const keys: Record<TileDir, string> = { up: '↑', down: '↓', left: '←', right: '→' }
  return (
    <>
      {dirs.map(({ d, other }) => {
        const Icon = TILE_ARROW[d]
        return (
          <div key={d} className="absolute z-30" style={{ ...place[d], width: 0, height: 0 }} data-chrome>
            <button
              type="button"
              title={`Swap with the item ${d === 'up' ? 'above' : d === 'down' ? 'below' : `to the ${d}`} (⌥${keys[d]})`}
              aria-label={`Swap with the item ${d === 'up' ? 'above' : d === 'down' ? 'below' : `to the ${d}`}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                useStore.getState().editList(slotId, { op: 'swap', itemId, withId: other })
              }}
              className="absolute grid -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white text-key-ink shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.35)] transition-[scale,background-color] duration-150 hover:bg-key hover:text-white active:scale-[0.92]"
              style={{ width: 28, height: 28, scale: 'min(calc(1 / var(--z)), 3.4)' }}
            >
              <Icon size={14} strokeWidth={2.4} />
            </button>
          </div>
        )
      })}
    </>
  )
}

function PickOutline({ rect, picked, label }: { rect: FrameRect | null; picked?: boolean; label?: string }) {
  const last = useRef<FrameRect | null>(null)
  if (rect) last.current = rect
  const r = rect ?? last.current
  if (!r) return null
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10"
      style={{
        // A little breathing room outside the element, the same on screen at any zoom.
        width: `calc(${r.w}px + 10px / var(--z))`,
        height: `calc(${r.h}px + 10px / var(--z))`,
        transform: `translate(calc(${r.x}px - 5px / var(--z)), calc(${r.y}px - 5px / var(--z)))`,
        opacity: rect ? 1 : 0,
        borderRadius: 'calc(8px / var(--z))',
        background: `color-mix(in oklab, var(--color-key) ${picked ? 7 : 10}%, transparent)`,
        boxShadow: `0 0 0 calc(${picked ? 2.5 : 2}px / var(--z)) var(--color-key), 0 0 0 calc(${picked ? 6 : 5.5}px / var(--z)) color-mix(in oklab, var(--color-key) 18%, transparent)`,
        transition: 'opacity 140ms cubic-bezier(0.2, 0, 0, 1), transform 90ms cubic-bezier(0.2, 0, 0, 1), width 90ms cubic-bezier(0.2, 0, 0, 1), height 90ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {label && (
        <span
          className="absolute bottom-full left-0 mb-[calc(8px/var(--z))] origin-bottom-left whitespace-nowrap rounded-md bg-key px-2 py-0.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_-4px_rgb(0_0_0/0.35)]"
          style={{ transform: 'scale(min(calc(1 / var(--z)), 3.4))' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

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
  // Uploads load from the browser's store after start-up; redraw when they arrive.
  const assets = useAssets((s) => s.assets)
  const isCurrent = p.rel === 0
  const state = useMemo(
    () => {
      const s = frameStateFor(clip, p.slot, p.mode, p.guide, p.content, p.viewport, p.page)
      // Live shaders run only in the clip on show: each one holds a WebGL context, and browsers allow a handful.
      return isCurrent ? s : withoutShaders(s)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip, p.slot, p.mode, p.guide, p.content, p.viewport, p.page, assets, isCurrent],
  )
  // Alternatives waiting under the current clip are invisible anyway: once measured and faded out,
  // hide them for real so the browser stops painting them (and their animations) on every frame.
  const [measured, setMeasured] = useState(false)
  const asleep = !isCurrent && measured
  const parentOnHeight = p.onHeight
  const onHeight = useCallback(
    (h: number) => {
      setMeasured(true)
      parentOnHeight(h)
    },
    [parentOnHeight],
  )
  const transition = `${
    p.jump ? 'opacity 200ms' : p.spinning ? `transform ${SPIN_STEP - 10}ms linear, opacity 120ms` : `transform ${SWAP}, opacity 160ms ease-out`
  }, visibility 0s linear ${asleep ? 280 : 0}ms`
  return (
    <div
      className={`absolute left-0 top-0 overflow-hidden ${p.edge}`}
      style={{
        // the outgoing clip shifts a little and fades while the next one shifts in from that side
        transform: `translateX(${Math.sign(p.rel) * p.width * NUDGE}px)`,
        opacity: isCurrent ? 1 : 0,
        visibility: asleep ? 'hidden' : 'visible',
        transition,
        pointerEvents: isCurrent ? 'auto' : 'none',
      }}
      onClick={(e) => {
        if (isCurrent) return
        e.stopPropagation()
        p.onPick()
      }}
    >
      <ClipFrame
        clip={clip}
        width={p.width}
        state={state}
        replayKey={p.replayKey}
        interactive={p.interactive}
        onHeight={onHeight}
        edit={p.edit}
      />
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
