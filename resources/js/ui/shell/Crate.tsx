import { useEffect, useMemo, useRef, useState } from 'react'
import { isHosted } from '@/lib/host'
import { pickFile } from '@/lib/pickFile'
import { addClipZip, onShelf, SHELF_LABEL, useUserClips, type Shelf } from '@/lib/userClips'
import { pickable } from '@/core/library'
import { createPortal } from 'react-dom'
import { Check, Plus, Scissors } from 'lucide-react'
import type { Clip, Density, Feel, SectionType } from '@/core/types'
import { DENSITIES, FEELS, SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore, currentSlots, mixClipIds } from '@/state/store'
import { frameStateFor } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'
import { LayoutTag } from './Alternatives'

/**
 * The crate: every clip you've collected, dug through like records. It follows
 * the section you're on, so it usually opens on just the alternatives that matter.
 */
export function Crate() {
  const filter = useStore((s) => s.ui.crateFilter)
  const focusedType = useStore((s) => currentSlots(s).find((x) => x.id === s.ui.focusedSlotId)?.type ?? null)
  const focusedId = useStore((s) => s.ui.focusedSlotId)
  const slots = useStore(currentSlots)
  const used = useMemo(() => new Set(slots.map((s) => s.clipId)), [slots])
  const st = useStore.getState
  const effective: SectionType | 'all' = filter === 'auto' ? (focusedType ?? 'all') : filter

  // Picking another section re-follows it.
  useEffect(() => {
    if (useStore.getState().ui.crateFilter !== 'auto') st().setUi({ crateFilter: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId])

  // Clips added from your account change the library; redraw when they arrive.
  const yours = useUserClips((s) => s.ids.length)
  const site = useStore((s) => s.site)
  const own = useStore((s) => s.clips)
  const mix = useMemo(() => new Set(mixClipIds({ site, clips: own })), [site, own])
  // This mix's clips first when it has some, then your whole library, then the built-in layouts.
  const [shelf, setShelf] = useState<Shelf>(mix.size ? 'mix' : yours ? 'yours' : 'layouts')
  // Browse by feel and how much is on it, like a gallery of real sites (docs/library.md).
  const [feel, setFeel] = useState<Feel | null>(null)
  const [density, setDensity] = useState<Density | null>(null)
  const fits = (c: Clip) => (!feel || !!c.feel?.includes(feel)) && (!density || c.density === density)
  const pool = (t: SectionType) => pickable(library, t).filter((id) => onShelf(id, shelf, mix) && fits(library.clips[id]))
  const ids = effective === 'all' ? SECTION_TYPES.flatMap(pool) : pool(effective)
  const scroller = useRef<HTMLDivElement>(null)
  const chip = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1'

  return (
    <div className="pb-2 pt-3">
      <div className="mb-2 flex items-center gap-3 px-3">
        <div className="flex rounded-full bg-chip p-0.5" role="tablist">
          {(['mix', 'yours', 'layouts'] as const).filter((k) => k !== 'mix' || mix.size).map((k) => (
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
              {SHELF_LABEL[k]}
            </button>
          ))}
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11.5px] text-zinc-500">
          <Scissors size={13} /> Drag onto a section, or click to drop in
        </span>
        {isHosted() && (
          <button
            type="button"
            onClick={() =>
              pickFile('.zip,application/zip', async (f) => {
                try {
                  const added = await addClipZip(f)
                  // A clip added while a mix is open joins this mix too (and stays in your library for the others).
                  st().addMixClips(added)
                  setShelf('mix')
                  st().showFlash(`Added ${added.map((id) => library.clips[id]?.title ?? id).join(', ')} to this mix and your clips`)
                } catch (e) {
                  st().showFlash(e instanceof Error ? e.message : String(e))
                }
              })
            }
            title="Add a clip the Blokmix extension saved (its .zip)"
            className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-zinc-700 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97] ${chip}`}
          >
            <Plus size={13} /> Add a captured clip
          </button>
        )}
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
              {t !== 'all' && t === focusedType && <span className={`ml-1.5 inline-block size-1.5 rounded-full align-middle ${on ? 'bg-key' : 'bg-key'}`} title="The section you’re on" />}
            </button>
          )
        })}
      </div>
      <div className="fade-x mb-2.5 flex scroll-px-3 items-center gap-1 overflow-x-auto px-3 py-0.5 no-scrollbar" aria-label="Feel">
        {([null, ...FEELS] as const).map((f) => (
          <button
            key={f ?? 'any'}
            type="button"
            aria-pressed={feel === f}
            onClick={() => setFeel(f)}
            className={`h-6 shrink-0 rounded-full px-2.5 text-[12px] font-medium capitalize transition active:scale-[0.97] ${chip} ${
              feel === f ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-chip'
            }`}
          >
            {f ?? 'Any feel'}
          </button>
        ))}
        <span className="mx-1 h-4 w-px shrink-0 bg-zinc-200" />
        {DENSITIES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={density === d}
            onClick={() => setDensity(density === d ? null : d)}
            className={`h-6 shrink-0 rounded-full px-2.5 text-[12px] font-medium capitalize transition active:scale-[0.97] ${chip} ${
              density === d ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-chip'
            }`}
          >
            {d}
          </button>
        ))}
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
          <ClipCard key={id} clip={library.clips[id]} used={used.has(id)} inMix={mix.has(id)} own={(own ?? []).includes(id)} />
        ))}
        {!ids.length && (
          <div className="col-span-full flex h-[60px] items-center gap-2 text-[12.5px] text-zinc-500">
            {feel || density ? `Nothing ${[feel, density].filter(Boolean).join(' and ')} here yet.` : `No ${effective === 'all' ? '' : `${TYPE_LABEL[effective]} `}clips yet.`}
            <button type="button" onClick={() => setShelf('layouts')} className={`rounded-full px-2 py-0.5 font-semibold text-zinc-800 hover:bg-zinc-950/5 ${chip}`}>
              Browse layouts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A clip in the crate: click or drag to use it. One of your clips also has a toggle to keep it in this mix's own set
 * (a clip a section uses is in the mix anyway).
 */
function ClipCard({ clip, used, inMix, own }: { clip: Clip; used: boolean; inMix: boolean; own: boolean }) {
  const source = library.sources[clip.sourceId]
  const [hover, setHover] = useState(false)
  const timer = useRef<number>(0)
  const ref = useRef<HTMLButtonElement>(null)
  const t = clip.tokens

  const place = () => {
    const st = useStore.getState()
    const focused = currentSlots(st).find((s) => s.id === st.ui.focusedSlotId)
    const target = focused?.type === clip.type ? focused : currentSlots(st).find((s) => s.type === clip.type)
    if (target) {
      st.setClip(target.id, clip.id)
      st.focusSlot(target.id)
    } else st.addSlot(clip.type, clip.id)
  }

  const st = useStore.getState
  return (
    <div className="group/card relative">
      <button
        ref={ref}
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-blokmix-clip', clip.id)
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
        className={`group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${used ? 'bg-key-soft/70' : 'hover:bg-zinc-950/5'}`}
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
            {used ? 'On the page' : inMix ? 'In this mix' : clip.origin === 'layout' ? TYPE_LABEL[clip.type] : clip.title}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-400">{primaryFamily(t['font.display'])}</div>
        </div>
      </button>
      {clip.origin === 'clip' && !used && (
        <button
          type="button"
          title={own ? 'Take out of this mix (it stays in your library)' : 'Keep in this mix'}
          aria-label={own ? `Take ${clip.title} out of this mix` : `Keep ${clip.title} in this mix`}
          onClick={() => (own ? st().removeMixClip(clip.id) : st().addMixClips([clip.id]))}
          className={`absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full text-[11px] transition active:scale-[0.97] ${
            inMix ? 'bg-key-soft text-key-ink' : 'bg-white text-zinc-500 opacity-0 shadow-sm ring-1 ring-zinc-950/10 group-hover/card:opacity-100 focus-visible:opacity-100'
          }`}
        >
          {inMix ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
        </button>
      )}
      {hover && ref.current && createPortal(<HoverPreview clip={clip} anchor={ref.current.getBoundingClientRect()} />, document.body)}
    </div>
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
      <div className="absolute bottom-1.5 left-1.5 rounded-md bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[10px] text-white">{clip.origin === 'layout' ? 'Blokmix layout' : new URL(clip.capture.url).host}</div>
    </div>
  )
}
