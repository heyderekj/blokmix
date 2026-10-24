import { memo, useEffect, useMemo, useState } from 'react'
import { Library } from 'lucide-react'
import type { Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { pickable } from '@/core/library'
import { useStore, currentSlots } from '@/state/store'
import { Preview } from './Preview'
import { suggestClip } from '@/core/suggest'
import { SHELF_LABEL, shelfOf, useUserClips, type Shelf } from '@/lib/userClips'

/** Marks one of Blokmix's built-in layouts, as opposed to a clip you saved. */
export function LayoutTag() {
  return <span className="shrink-0 rounded-[5px] bg-zinc-950/6 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Layout</span>
}

const THUMB_W = 212

/**
 * The focused section's alternatives, as live thumbnails in your style: the way
 * Figma shows a component's variants. One shelf at a time, your clips or the
 * built-in layouts, so each gets room for a real preview. Click one to swap it
 * onto the page.
 */
export function Alternatives({ slot }: { slot: Slot }) {
  const ids = pickable(library, slot.type)
  const pos = ids.indexOf(slot.clipId) + 1
  const slots = useStore(currentSlots)
  const index = slots.findIndex((s) => s.id === slot.id)
  // Each shelf is ordered by how well its clips sit between this section's neighbours.
  const ranked = useMemo(() => suggestClip(slot.type, slots, index, library, true), [slot.type, slots, index])
  useUserClips((s) => s.ids.length)
  const by: Record<Shelf, typeof ranked> = { yours: [], layouts: [] }
  for (const r of ranked) by[shelfOf(r.clipId)].push(r)
  const shelves = ['yours', 'layouts'] as const
  const st = useStore.getState

  // The shelf follows what's on the page: arrowing onto a layout opens Layouts.
  const here = shelfOf(slot.clipId)
  const onShelf: Shelf = here === 'layouts' || !by.yours.length ? 'layouts' : 'yours'
  const [shelf, setShelf] = useState<Shelf>(onShelf)
  useEffect(() => setShelf(onShelf), [slot.id, onShelf])
  const list = by[shelf]

  return (
    <div className="pb-2 pt-2.5">
      <div className="mb-1 flex items-center gap-2 px-3.5">
        <span className="text-[13px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
        <span className="text-[12px] tabular-nums text-zinc-500">
          {pos} of {ids.length}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] text-zinc-400">
          <span className="kbd">←</span>
          <span className="kbd">→</span>
        </span>
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
          <Library size={13} /> All clips
        </button>
      </div>
      <div className="thin-scroll fade-x flex items-start gap-2.5 overflow-x-auto scroll-px-3 px-3 pb-1.5 pt-1">
        {list.map((r) => (
          <Thumb key={r.clipId} clipId={r.clipId} slot={slot} current={r.clipId === slot.clipId} reason={r.reason} />
        ))}
        {!list.length && (
          <div className="flex items-center gap-2 px-1 text-[13px] text-zinc-500" style={{ height: Math.round(THUMB_W * 0.56) }}>
            No {TYPE_LABEL[slot.type]} clips yet.
            <button type="button" onClick={() => setShelf('layouts')} className="rounded-full px-2 py-0.5 font-semibold text-zinc-800 hover:bg-zinc-950/5">
              Browse layouts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const Thumb = memo(function Thumb({ clipId, slot, current, reason }: { clipId: string; slot: Slot; current: boolean; reason: string }) {
  const clip = library.clips[clipId]
  const source = library.sources[clip.sourceId]
  const layout = clip.origin === 'layout'
  return (
    <button
      type="button"
      onClick={() => useStore.getState().setClip(slot.id, clipId)}
      className="group shrink-0 text-left focus-visible:outline-none"
      style={{ width: THUMB_W }}
      title={`${layout ? clip.title : `${source.name}: ${clip.title}`}\n${reason}`}
      aria-pressed={current}
    >
      <div className={`overflow-hidden rounded-lg ring-2 transition group-focus-visible:ring-zinc-400 ${current ? 'ring-key' : 'ring-zinc-950/8 group-hover:ring-zinc-950/25'}`}>
        <Preview clip={clip} slot={slot} width={THUMB_W} height={Math.round(THUMB_W * 0.56)} />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
        <span className={`truncate text-[12px] ${current ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{layout ? clip.title : source.name}</span>
        {current && <span className="size-1.5 shrink-0 rounded-full bg-key" />}
      </div>
    </button>
  )
})
