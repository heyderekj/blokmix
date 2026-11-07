import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Library, Lock } from 'lucide-react'
import type { Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { layoutOpen, pickable } from '@/core/library'
import { useAccount } from '@/lib/account'
import { useStore, currentSlots, mixClipIds } from '@/state/store'
import { CARD_H, CARD_W, Preview } from './Preview'
import { suggestClip } from '@/core/suggest'
import { onShelf as isOn, SHELF_LABEL, shelfOf, useUserClips, type Shelf } from '@/lib/userClips'

/** Marks one of Blokmix's built-in layouts, as opposed to a clip you saved. */
export function LayoutTag() {
  return <span className="shrink-0 rounded-[5px] bg-zinc-950/6 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Layout</span>
}

/**
 * The focused section's alternatives, as live thumbnails in your style: the way
 * Figma shows a component's variants. One shelf at a time, your clips or the
 * built-in layouts, so each gets room for a real preview. Click one to swap it
 * onto the page.
 */
export function Alternatives({ slot }: { slot: Slot }) {
  const slots = useStore(currentSlots)
  const index = slots.findIndex((s) => s.id === slot.id)
  // Each shelf is ordered by how well its clips sit between this section's neighbours.
  const ranked = useMemo(() => suggestClip(slot.type, slots, index, library, true), [slot.type, slots, index])
  useUserClips((s) => s.ids.length)
  const site = useStore((s) => s.site)
  const own = useStore((s) => s.clips)
  const mix = useMemo(() => new Set(mixClipIds({ site, clips: own })), [site, own])
  const by: Record<Shelf, typeof ranked> = { mix: [], yours: [], layouts: [] }
  for (const r of ranked) for (const k of ['mix', 'yours', 'layouts'] as const) if (isOn(r.clipId, k, mix)) by[k].push(r)
  // On Free, the layouts in Plus follow the ones you can use, with a lock.
  useAccount((s) => s.paid)
  for (const id of pickable(library, slot.type, { locked: true })) if (!layoutOpen(library, id)) by.layouts.push({ clipId: id, score: 0, reason: 'In Plus' })
  // This mix's shelf shows once it has clips; the whole library is always there.
  const shelves = (['mix', 'yours', 'layouts'] as const).filter((k) => k !== 'mix' || by.mix.length)
  const st = useStore.getState

  // The shelf follows what's on the page: arrowing onto a layout opens Layouts, onto one of this mix's clips This mix.
  const here = shelfOf(slot.clipId)
  const onShelf: Shelf = here === 'layouts' ? 'layouts' : mix.has(slot.clipId) ? 'mix' : by.yours.length ? 'yours' : 'layouts'
  const [shelf, setShelf] = useState<Shelf>(onShelf)
  useEffect(() => setShelf(onShelf), [slot.id, onShelf])
  const list = by[shelf]
  const scroller = useRef<HTMLDivElement>(null)

  return (
    <div className="pb-2 pt-2.5">
      <div className="mb-1 flex items-center gap-2 px-3.5">
        {/* The bar above already says "Layout n of m" and has the arrows: here, just what these are. */}
        <span className="text-[13px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]} layouts</span>
        <div className="ml-2 flex rounded-full bg-chip p-0.5" role="tablist">
          {shelves.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={shelf === k}
              onClick={() => setShelf(k)}
              className={`h-6 rounded-full px-2.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                shelf === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {SHELF_LABEL[k]}
              <span className="ml-1 tabular-nums text-zinc-400">{by[k].length}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => st().setUi({ sheet: 'crate', crateFilter: 'all' })}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900"
        >
          <Library size={13} /> Open the crate
        </button>
      </div>
      <div ref={scroller} className="thin-scroll fade-x flex items-start gap-2.5 overflow-x-auto scroll-px-3 px-3 pb-1.5 pt-1">
        {list.map((r) => (
          <Thumb key={r.clipId} clipId={r.clipId} slot={slot} current={r.clipId === slot.clipId} reason={r.reason} scroller={scroller} />
        ))}
        {!list.length && (
          <div className="flex items-center gap-2 px-1 text-[13px] text-zinc-500" style={{ height: CARD_H }}>
            {shelf === 'layouts' ? (
              `No other ${TYPE_LABEL[slot.type].toLowerCase()} layouts yet.`
            ) : (
              <>
                No {TYPE_LABEL[slot.type].toLowerCase()} clips yet. Clip one from a site you like, or
                <button type="button" onClick={() => setShelf('layouts')} className="cursor-pointer rounded-full px-2 py-0.5 font-semibold text-zinc-800 transition-[background-color,scale] hover:bg-zinc-950/5 active:scale-[0.97]">
                  see the layouts
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const Thumb = memo(function Thumb({
  clipId,
  slot,
  current,
  reason,
  scroller,
}: {
  clipId: string
  slot: Slot
  current: boolean
  reason: string
  scroller: RefObject<HTMLDivElement | null>
}) {
  const clip = library.clips[clipId]
  const source = library.sources[clip.sourceId]
  const layout = clip.origin === 'layout'
  const locked = !layoutOpen(library, clipId)
  return (
    <button
      type="button"
      onClick={() => useStore.getState().setClip(slot.id, clipId)}
      className="group relative shrink-0 text-left focus-visible:outline-none"
      style={{ width: CARD_W }}
      title={`${layout ? clip.title : `${source.name}: ${clip.title}`}\n${reason}`}
      aria-pressed={current}
    >
      <div
        className={`overflow-hidden rounded-lg ring-2 transition-[box-shadow] duration-200 group-focus-visible:ring-zinc-400 ${
          current ? 'ring-key' : 'ring-zinc-950/8 [@media(hover:hover)_and_(pointer:fine)]:group-hover:ring-zinc-950/25'
        }`}
      >
        <Preview clip={clip} slot={slot} width={CARD_W} height={CARD_H} scroller={scroller} />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
        <span className={`truncate text-[12px] ${current ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{layout ? clip.title : source.name}</span>
        {current && <span className="size-1.5 shrink-0 rounded-full bg-key" />}
        {locked && <Lock size={11} strokeWidth={2.25} className="shrink-0 text-zinc-400" aria-label="In Plus" />}
      </div>
    </button>
  )
})
