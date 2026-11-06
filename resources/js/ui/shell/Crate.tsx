import { useEffect, useMemo, useRef, useState } from 'react'
import { isHosted } from '@/lib/host'
import { pickFile } from '@/lib/pickFile'
import { addClipZip, onShelf, SHELF_LABEL, useUserClips, type Shelf } from '@/lib/userClips'
import { layoutOpen, pickable } from '@/core/library'
import { useAccount } from '@/lib/account'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, Lock, Plus, Scissors, Search, SlidersHorizontal, X } from 'lucide-react'
import { openSiteLibrary } from '../library/SiteLibrary'
import type { Clip, SectionType } from '@/core/types'
import { SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { useStore, currentSlots, mixClipIds } from '@/state/store'
import { frameStateFor, usePageStyle, useResolvedGuide } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'
import { DEFAULT_KEEP } from '@/core/types'
import { LayoutTag } from './Alternatives'
import { activeFacetCount, FACET_GROUPS, facetCounts, facetLabel, searchClips, type FacetFilter, type FacetGroup } from '@/core/browse'

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
  // On Free, layouts in a mix pack show too, with a lock, after the ones you can use.
  useAccount((s) => s.paid)
  const pool = (t: SectionType) => {
    const ids = pickable(library, t, { locked: true }).filter((id) => onShelf(id, shelf, mix))
    return [...ids.filter((id) => layoutOpen(library, id)), ...ids.filter((id) => !layoutOpen(library, id))]
  }
  const query = useStore((s) => s.ui.crateQuery)
  const facets = useStore((s) => s.ui.crateFacets)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersButton = useRef<HTMLButtonElement>(null)
  const shelved = effective === 'all' ? SECTION_TYPES.flatMap(pool) : pool(effective)
  // Facet counts come from what the search leaves, before facets narrow it, so every chip says what it would show.
  const searched = searchClips(library, shelved, { query })
  const ids = searchClips(library, searched, { facets })
  const narrowed = Boolean(query.trim()) || activeFacetCount(facets) > 0
  const clearSearch = () => st().setUi({ crateQuery: '', crateFacets: {} })
  const scroller = useRef<HTMLDivElement>(null)
  const chip = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1'

  return (
    <div className="pb-2 pt-3">
      <div className="mb-2 flex items-center gap-3 px-3">
        <div className="flex shrink-0 rounded-full bg-chip p-0.5" role="tablist">
          {(['mix', 'yours', 'layouts'] as const).filter((k) => k !== 'mix' || mix.size).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={shelf === k}
              onClick={() => setShelf(k)}
              className={`h-6 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition ${chip} ${
                shelf === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {SHELF_LABEL[k]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => openSiteLibrary()}
            title="Real sites matched to layouts: clip a section, several, or a whole page"
            className={`flex h-6 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold text-zinc-500 transition-[color,scale] duration-150 active:scale-[0.97] hover:text-zinc-800 ${chip}`}
          >
            Sites <ArrowUpRight size={11} />
          </button>
        </div>
        <label className="relative flex h-7 min-w-40 flex-1 items-center">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => st().setUi({ crateQuery: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && st().setUi({ crateQuery: '' })}
            placeholder="Search clips"
            aria-label="Search clips"
            className={`h-7 w-full rounded-full bg-chip pl-7 pr-2.5 text-[12px] text-zinc-800 placeholder:text-zinc-400 ${chip}`}
          />
        </label>
        <div className="relative">
          <button
            ref={filtersButton}
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-[background-color,scale] duration-150 active:scale-[0.97] ${chip} ${
              activeFacetCount(facets) ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'
            }`}
          >
            <SlidersHorizontal size={13} /> Filters
            {activeFacetCount(facets) > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{activeFacetCount(facets)}</span>}
          </button>
          {filtersOpen && filtersButton.current &&
            createPortal(<FilterPopover ids={searched} facets={facets} anchor={filtersButton.current} onClose={() => setFiltersOpen(false)} />, document.body)}
        </div>
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[11.5px] text-zinc-500 xl:flex">
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
      <div
        ref={scroller}
        className="thin-scroll fade-x flex items-start gap-3 overflow-x-auto scroll-px-3 px-3 pb-1.5 pt-1"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scroller.current) scroller.current.scrollLeft += e.deltaY
        }}
      >
        {ids.map((id) => (
          <ClipCard key={id} clip={library.clips[id]} used={used.has(id)} inMix={mix.has(id)} own={(own ?? []).includes(id)} scroller={scroller} />
        ))}
        {!ids.length && narrowed && shelved.length > 0 && (
          <div className="flex h-[60px] items-center gap-2 text-[12.5px] text-zinc-500">
            No clips match.
            <button type="button" onClick={clearSearch} className={`rounded-full px-2 py-0.5 font-semibold text-zinc-800 hover:bg-zinc-950/5 ${chip}`}>
              Clear filters
            </button>
          </div>
        )}
        {!shelved.length && (
          <div className="flex h-[60px] items-center gap-2 text-[12.5px] text-zinc-500">
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

/**
 * Narrow the crate by how sections look: layout, style, density, pictures, tone and color. A group shows only when
 * the clips on the shelf differ in it (every built-in layout is light, for instance).
 */
function FilterPopover({ ids, facets, anchor, onClose }: { ids: string[]; facets: FacetFilter; anchor: HTMLElement; onClose: () => void }) {
  const counts = facetCounts(library, ids)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose, anchor])
  const toggle = (g: FacetGroup, v: string) => {
    const on = facets[g] ?? []
    const next = on.includes(v) ? on.filter((x) => x !== v) : [...on, v]
    useStore.getState().setUi({ crateFacets: { ...facets, [g]: next.length ? next : undefined } })
  }
  // Above its button (the crate sits at the bottom of the screen), out of the dock's clipping.
  const box = anchor.getBoundingClientRect()
  const left = Math.min(box.left, window.innerWidth - 352)
  const groups = (Object.keys(FACET_GROUPS) as FacetGroup[]).filter((g) => Object.keys(counts[g]).length > 1 || facets[g]?.length)
  return (
    <div ref={ref} className="fixed z-[60] w-[340px] animate-pop rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-zinc-950/10" style={{ left, bottom: window.innerHeight - box.top + 8 }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-zinc-900">Filter clips</span>
        <div className="flex items-center gap-1">
          {activeFacetCount(facets) > 0 && (
            <button type="button" onClick={() => useStore.getState().setUi({ crateFacets: {} })} className="cursor-pointer rounded-full px-2 py-0.5 text-[11.5px] font-medium text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-800">
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close filters" className="grid size-6 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700">
            <X size={13} />
          </button>
        </div>
      </div>
      {!groups.length && <p className="text-[12px] text-zinc-500">These clips are all alike; nothing to filter by.</p>}
      <div className="grid gap-2.5">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] font-medium text-zinc-500">{FACET_GROUPS[g].label}</div>
            <div className="flex flex-wrap gap-1">
              {(FACET_GROUPS[g].values as readonly string[]).filter((v) => counts[g][v] || facets[g]?.includes(v)).map((v) => {
                const on = facets[g]?.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(g, v)}
                    className={`h-6 cursor-pointer rounded-full px-2.5 text-[11.5px] font-medium transition-[background-color,scale] duration-150 active:scale-[0.97] ${
                      on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'
                    }`}
                  >
                    {facetLabel(v)} <span className={on ? 'text-white/60' : 'text-zinc-400'}>{counts[g][v] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CARD_W = 232
const CARD_H = 140
const PAGE_W = 1280
const PAD = 10

/**
 * A clip on the canvas's dot grid, drawn as a small page in your style: the whole section fit inside the card, so its
 * shape reads at a glance (a nav is a thin strip, a hero a block).
 */
function CratePreview({ clip }: { clip: Clip }) {
  const mode = useStore((s) => s.ui.mode)
  const content = useStore((s) => s.content)
  const guide = useResolvedGuide()
  const pageStyle = usePageStyle()
  const state = useMemo(() => frameStateFor(clip, { keep: DEFAULT_KEEP }, mode, guide.tokens, content, 'desktop', pageStyle), [clip, mode, guide.tokens, content, pageStyle])
  const [h, setH] = useState(0)
  const fitW = (CARD_W - PAD * 2) / PAGE_W
  const scale = h ? Math.min(fitW, (CARD_H - PAD * 2) / h) : fitW
  const pageW = PAGE_W * scale
  const pageH = Math.min((h || 400) * scale, CARD_H - PAD * 2)
  const bg = mode === 'unified' ? guide.tokens['color.bg'] : clip.tokens['color.bg']
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: CARD_W,
        height: CARD_H,
        background: 'var(--canvas-bg)',
        backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1.35px)',
        backgroundSize: '12px 12px',
        backgroundPosition: '6px 6px',
      }}
    >
      <div
        className="absolute overflow-hidden rounded-[5px] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.25)]"
        style={{
          left: (CARD_W - pageW) / 2,
          top: (CARD_H - pageH) / 2,
          width: pageW,
          height: pageH,
          background: bg,
        }}
      >
        {/* the page shows in its color at once; the section fades in once it has measured itself */}
        <div className="pointer-events-none origin-top-left transition-opacity duration-300" style={{ width: PAGE_W, transform: `scale(${scale})`, opacity: h ? 1 : 0 }}>
          <ClipFrame clip={clip} width={PAGE_W} state={state} onHeight={setH} />
        </div>
      </div>
    </div>
  )
}

/** True once the element has come near the scroller's view: previews are live frames, so only those in reach load. */
function useNear(scroller: React.RefObject<HTMLDivElement | null>) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (near || !ref.current) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { root: scroller.current, rootMargin: '0px 480px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [near, scroller])
  return [ref, near] as const
}

/**
 * A clip in the crate: a live preview in your style (as it would look on the page), its name and how it feels.
 * Click or drag to use it. One of your clips also has a toggle to keep it in this mix's own set (a clip a section
 * uses is in the mix anyway).
 */
function ClipCard({ clip, used, inMix, own, scroller }: { clip: Clip; used: boolean; inMix: boolean; own: boolean; scroller: React.RefObject<HTMLDivElement | null> }) {
  const source = library.sources[clip.sourceId]
  const [ref, near] = useNear(scroller)
  const layout = clip.origin === 'layout'
  const locked = !layoutOpen(library, clip.id)

  // (A locked layout opens the buy sheet instead: setClip and addSlot ask.)
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
  const feel = [TYPE_LABEL[clip.type], clip.style && facetLabel(clip.style), clip.density && facetLabel(clip.density)].filter(Boolean).join(' · ')
  return (
    <div ref={ref} className="group/card relative shrink-0" style={{ width: CARD_W }}>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-blokmix-clip', clip.id)
          // Its type travels as a type of its own: a section can say whether a drop replaces it before the drop.
          e.dataTransfer.setData(`application/x-blokmix-type-${clip.type}`, '')
          e.dataTransfer.effectAllowed = 'copy'
          // Frames let the drag through, so even the section you're in can take it.
          document.documentElement.setAttribute('data-dragging-clip', '')
        }}
        onDragEnd={() => document.documentElement.removeAttribute('data-dragging-clip')}
        onClick={place}
        title={layout ? clip.title : `${source?.name}: ${clip.title}`}
        className="group block w-full cursor-pointer text-left focus-visible:outline-none active:scale-[0.97] transition-[scale] duration-150"
      >
        <div
          className={`overflow-hidden rounded-lg ring-2 transition-[box-shadow,translate] duration-200 group-focus-visible:ring-zinc-400 ${
            used ? 'ring-key' : 'ring-zinc-950/8 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:ring-zinc-950/25'
          }`}
          style={{ width: CARD_W, height: CARD_H }}
        >
          {near ? <CratePreview clip={clip} /> : <div className="size-full bg-[var(--canvas-bg)]" />}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
          <span className={`truncate text-[12px] ${used ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>{layout ? clip.title : source?.name}</span>
          {used ? <span className="size-1.5 shrink-0 rounded-full bg-key" title="On the page" /> : layout ? <LayoutTag /> : null}
        </div>
        <div className="truncate px-0.5 text-[11px] text-zinc-400">{locked ? 'In a mix pack' : inMix && !used ? `In this mix · ${feel}` : feel}</div>
      </button>
      {locked && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-950/10" title="In a mix pack">
          <Lock size={12} strokeWidth={2.25} />
        </span>
      )}
      {clip.origin === 'clip' && !used && (
        <button
          type="button"
          title={own ? 'Take out of this mix (it stays in your library)' : 'Keep in this mix'}
          aria-label={own ? `Take ${clip.title} out of this mix` : `Keep ${clip.title} in this mix`}
          onClick={() => (own ? st().removeMixClip(clip.id) : st().addMixClips([clip.id]))}
          className={`absolute right-1.5 top-1.5 grid size-6 cursor-pointer place-items-center rounded-full text-[11px] transition active:scale-[0.97] ${
            inMix ? 'bg-key-soft text-key-ink' : 'bg-white text-zinc-500 opacity-0 shadow-sm ring-1 ring-zinc-950/10 group-hover/card:opacity-100 focus-visible:opacity-100'
          }`}
        >
          {inMix ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
        </button>
      )}
    </div>
  )
}
