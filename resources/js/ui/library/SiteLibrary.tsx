import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowUpRight, Check, FilePlus2, Globe, Palette, Plus, Search, X } from 'lucide-react'
import { library } from '@/data/library'
import { TYPE_LABEL } from '@/core/content'
import { hueOf, toneOf, facetLabel } from '@/core/browse'
import type { SectionType } from '@/core/types'
import { runCommand } from '@/state/commands'
import { useStore, currentSlots } from '@/state/store'
import {
  filterSites,
  layoutName,
  listSites,
  loadSite,
  sectionClipState,
  siteLibraryAvailable,
  usingFixture,
  type LibraryPage,
  type LibrarySection,
  type LibrarySite,
  type LibrarySiteSummary,
} from '@/lib/siteLibrary'

/**
 * The site library: real sites, each page split into sections matched to Blokmix's built-in layouts. Pick one
 * section, several or the whole page; what lands in the mix is the matched layout, never the site's words or
 * pictures. Its look can join the style guide. Everything goes through the commands an agent uses.
 */
export const useSiteLibrary = create<{ open: boolean; slug: string | null }>()(() => ({ open: false, slug: null }))
export const openSiteLibrary = (slug: string | null = null) => useSiteLibrary.setState({ open: true, slug })
const close = () => useSiteLibrary.setState({ open: false })

const EASE = [0.23, 1, 0.32, 1] as const
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1'
const PRESS = 'cursor-pointer transition-[background-color,color,scale,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]'

export function SiteLibrary() {
  const { open, slug } = useSiteLibrary()
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sites"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.14, ease: EASE } }}
          className="fixed inset-0 z-[80] bg-zinc-950/25 p-2 backdrop-blur-sm sm:p-4"
          onClick={close}
          data-chrome
        >
          <motion.div
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0, transition: { duration: 0.24, ease: EASE } }}
            exit={{ scale: 0.99, y: 4, transition: { duration: 0.14, ease: EASE } }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Site library"
            className="glass-panel flex h-full w-full flex-col overflow-hidden rounded-3xl"
          >
            {!siteLibraryAvailable() ? <Unavailable /> : slug ? <SiteView slug={slug} /> : <Gallery />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CloseButton() {
  return (
    <button type="button" onClick={close} aria-label="Close the site library (Esc)" title="Close (Esc)" className={`grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 ${PRESS} ${RING} ${HOVER}bg-zinc-950/5 ${HOVER}text-zinc-900`}>
      <X size={16} />
    </button>
  )
}

function Unavailable() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end p-3">
        <CloseButton />
      </div>
      <div className="grid flex-1 place-items-center px-6 pb-16 text-center">
        <div className="max-w-sm">
          <Globe size={28} className="mx-auto mb-3 text-zinc-400" />
          <h2 className="text-[17px] font-semibold text-zinc-900">The site library lives in your Blokmix account</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 [text-wrap:pretty]">
            Real sites, split into sections and matched to Blokmix layouts. Sign in at blokmix.com to browse them and clip sections into your mixes.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Gallery

type Facet = 'industry' | 'tone' | 'color'
const facetOf = (s: LibrarySiteSummary, f: Facet): string | null =>
  f === 'industry' ? s.industry || null : f === 'tone' ? (s.palette?.bg ? toneOf(s.palette.bg) : null) : s.palette?.primary ? hueOf(s.palette.primary) : null

function Gallery() {
  const [sites, setSites] = useState<LibrarySiteSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Partial<Record<Facet, string>>>({})
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    listSites().then(setSites, (e) => setError(e instanceof Error ? e.message : String(e)))
    search.current?.focus()
  }, [])

  const searched = useMemo(() => filterSites(sites ?? [], { query }), [sites, query])
  const shown = searched.filter((s) => (Object.entries(chosen) as [Facet, string | undefined][]).every(([f, v]) => !v || facetOf(s, f) === v))
  // A facet shows only when the sites differ in it.
  const groups = (['industry', 'tone', 'color'] as Facet[])
    .map((f) => ({ f, values: [...new Set((sites ?? []).map((s) => facetOf(s, f)).filter(Boolean) as string[])].sort() }))
    .filter((g) => g.values.length > 1)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-950/6 px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-900">Sites</h2>
          <p className="text-[12px] text-zinc-500">Real sites, matched to Blokmix layouts. You add the layout, never their words or pictures.</p>
        </div>
        <label className="relative order-last flex h-8 w-full items-center sm:order-none sm:w-64">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-zinc-400" />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites"
            aria-label="Search sites"
            className={`h-8 w-full rounded-full bg-chip pl-7 pr-3 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 ${RING}`}
          />
        </label>
        <CloseButton />
      </header>
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-950/6 px-4 py-2">
          {groups.map(({ f, values }) => (
            <div key={f} className="flex flex-wrap items-center gap-1" role="group" aria-label={f}>
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">{f === 'industry' ? 'Industry' : f === 'tone' ? 'Tone' : 'Color'}</span>
              {values.map((v) => {
                const on = chosen[f] === v
                const n = searched.filter((s) => facetOf(s, f) === v).length
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen((c) => ({ ...c, [f]: on ? undefined : v }))}
                    className={`h-7 rounded-full px-2.5 text-[12px] font-medium ${PRESS} ${RING} ${on ? 'bg-zinc-900 text-white' : `bg-chip text-zinc-600 ${HOVER}text-zinc-900`}`}
                  >
                    {facetLabel(v)} <span className={on ? 'text-white/60' : 'text-zinc-400'}>{n}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <p className="py-16 text-center text-[13px] text-zinc-500">{error}</p>
        ) : !sites ? (
          <p className="py-16 text-center text-[13px] text-zinc-400">Loading the site library…</p>
        ) : !shown.length ? (
          <p className="py-16 text-center text-[13px] text-zinc-500">{sites.length ? 'No sites match. Try fewer words or filters.' : 'No sites in the library yet.'}</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {shown.map((s) => (
              <li key={s.slug}>
                <SiteCard site={s} />
              </li>
            ))}
          </ul>
        )}
        {usingFixture() && <p className="mt-6 text-center text-[11.5px] text-zinc-400">Made-up sites for development. Your account’s library has the real ones.</p>}
      </div>
    </div>
  )
}

function SiteCard({ site: s }: { site: LibrarySiteSummary }) {
  const dots = ['bg', 'text', 'primary', 'accent'].map((k) => s.palette?.[k]).filter(Boolean) as string[]
  return (
    <button
      type="button"
      onClick={() => useSiteLibrary.setState({ slug: s.slug })}
      className={`group/site flex w-full flex-col overflow-hidden rounded-2xl bg-[var(--lift)] text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)] ${RING} cursor-pointer transition-[translate,box-shadow,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${HOVER}-translate-y-0.5 ${HOVER}shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_14px_26px_-12px_rgb(0_0_0/0.3)]`}
    >
      <span className="relative block aspect-[16/10] overflow-hidden" style={{ background: s.palette?.bg ?? '#f4f4f5' }}>
        {s.thumb ? <img src={s.thumb} alt="" loading="lazy" className="size-full object-cover object-top" /> : <PaletteArt palette={s.palette} />}
      </span>
      <span className="flex flex-col gap-1 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-zinc-900">{s.name}</span>
          <span className="flex shrink-0 -space-x-1">
            {dots.map((c, i) => (
              <i key={i} className="size-3.5 rounded-full ring-2 ring-[var(--lift)]" style={{ background: c }} />
            ))}
          </span>
        </span>
        <span className="truncate text-[11.5px] text-zinc-500">
          {[s.industry, `${s.pages} ${s.pages === 1 ? 'page' : 'pages'}`, `${s.matched} of ${s.sections} sections matched`].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  )
}

/** No screenshot: the site's palette, drawn as a page. */
function PaletteArt({ palette }: { palette: Record<string, string> }) {
  const text = palette?.text ?? '#18181b'
  const primary = palette?.primary ?? text
  return (
    <span className="absolute inset-0 flex flex-col gap-[6%] p-[9%]">
      <span className="h-[7%] w-[34%] rounded-full opacity-80" style={{ background: text }} />
      <span className="h-[12%] w-[72%] rounded-[3px]" style={{ background: text }} />
      <span className="h-[6%] w-[54%] rounded-full opacity-40" style={{ background: text }} />
      <span className="mt-auto flex gap-[4%]">
        <span className="h-3 w-[26%] rounded-full" style={{ background: primary }} />
        <span className="h-3 w-[20%] rounded-full opacity-30" style={{ background: palette?.accent ?? text }} />
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// A site: its pages, a page's screenshot with its sections, and what to add.

function SiteView({ slug }: { slug: string }) {
  const [site, setSite] = useState<LibrarySite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageId, setPageId] = useState<string | number | null>(null)
  useEffect(() => {
    setSite(null)
    loadSite(slug, library).then(
      (s) => (s ? setSite(s) : setError('This site isn’t in the library any more.')),
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [slug])
  const pages = useMemo(() => [...(site?.pages ?? [])].sort((a, b) => a.order - b.order), [site])
  const page = pages.find((p) => p.id === pageId) ?? pages[0]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-950/6 px-3 py-2.5">
        <button
          type="button"
          onClick={() => useSiteLibrary.setState({ slug: null })}
          aria-label="All sites"
          title="All sites"
          className={`grid size-8 shrink-0 place-items-center rounded-full text-zinc-600 ${PRESS} ${RING} ${HOVER}bg-zinc-950/5`}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-zinc-900">{site?.name ?? 'Loading…'}</h2>
          {site && <p className="truncate text-[12px] text-zinc-500">{[site.industry, site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')].filter(Boolean).join(' · ')}</p>}
        </div>
        {site && (
          <>
            <UseStyleButton site={site} />
            <a
              href={page ? new URL(page.path, site.url).href : site.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-zinc-700 ${PRESS} ${RING} ${HOVER}bg-zinc-950/5`}
            >
              Visit site <ArrowUpRight size={13} />
            </a>
          </>
        )}
        <CloseButton />
      </header>
      {error ? (
        <p className="py-16 text-center text-[13px] text-zinc-500">{error}</p>
      ) : !site || !page ? (
        <p className="py-16 text-center text-[13px] text-zinc-400">{site ? 'This site has no pages yet.' : 'Loading…'}</p>
      ) : (
        <>
          {pages.length > 1 && (
            <div className="flex gap-1 overflow-x-auto border-b border-zinc-950/6 px-4 py-2" role="tablist" aria-label="Pages">
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={p.id === page.id}
                  onClick={() => setPageId(p.id)}
                  className={`h-7 shrink-0 rounded-full px-3 text-[12px] font-semibold ${PRESS} ${RING} ${p.id === page.id ? 'bg-zinc-900 text-white' : `text-zinc-500 ${HOVER}text-zinc-900`}`}
                >
                  {p.title} <span className={p.id === page.id ? 'font-normal text-white/60' : 'font-normal text-zinc-400'}>{p.path}</span>
                </button>
              ))}
            </div>
          )}
          <PageViewer key={`${site.slug}:${page.id}`} site={site} page={page} />
        </>
      )}
    </div>
  )
}

function UseStyleButton({ site }: { site: LibrarySite }) {
  const added = useStore((s) => s.guide.candidates.some((c) => c.clipId === `src:site:${site.slug}`))
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await runCommand('use_site_style', { site: site.slug }, 'you')
          useStore.getState().showFlash(`${site.name}’s look is a style guide candidate`, { undo: true })
        } catch (e) {
          useStore.getState().showFlash(e instanceof Error ? e.message : String(e))
        }
      }}
      title="Add its colors, type, shape, spacing and motion to your style guide as candidates"
      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-zinc-700 ${PRESS} ${RING} ${HOVER}bg-zinc-950/5`}
    >
      {added ? <Check size={14} className="text-green-600" /> : <Palette size={14} />} {added ? 'Style added' : 'Use its style'}
    </button>
  )
}

function PageViewer({ site, page }: { site: LibrarySite; page: LibraryPage }) {
  const sections = useMemo(() => [...page.sections].filter((s) => s.status !== 'hidden').sort((a, b) => a.order - b.order), [page])
  const clippable = sections.filter((s) => sectionClipState(library, s).clippable).map((s) => s.order)
  const [picked, setPicked] = useState<number[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const focusedLabel = useStore((s) => {
    const f = currentSlots(s).find((x) => x.id === s.ui.focusedSlotId)
    return f ? TYPE_LABEL[f.type] : null
  })
  const shot = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = shot.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const scale = width / (page.width || 1440)
  const height = Math.max(page.height, ...sections.map((s) => s.box.y + s.box.h))

  const pick = (order: number, many: boolean) => {
    if (!clippable.includes(order)) return
    setPicked((p) => (many ? (p.includes(order) ? p.filter((x) => x !== order) : [...p, order]) : p.length === 1 && p[0] === order ? [] : [order]))
  }
  const all = picked.length === clippable.length && clippable.length > 0

  const add = async (newPage: boolean) => {
    if (!picked.length || busy) return
    setBusy(true)
    try {
      const whole = all && clippable.length === sections.filter((s) => s.status === 'matched').length
      const r = (await runCommand('clip_from_site', { site: site.slug, page: page.path, ...(whole ? { all: true } : { sections: [...picked].sort((a, b) => a - b) }), newPage }, 'you')) as {
        added: unknown[]
        skipped: { reason: string }[]
        page: string
      }
      const n = r.added.length
      useStore.getState().showFlash(`Added ${n} ${n === 1 ? 'layout' : 'layouts'} inspired by ${site.name}${newPage ? ` on ${r.page}` : ''}${r.skipped.length ? ` (${r.skipped.length} skipped)` : ''}`, { undo: true })
      close()
    } catch (e) {
      useStore.getState().showFlash(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-950/[0.03] p-4">
        <div ref={shot} className="relative mx-auto w-full max-w-[880px] overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-16px_rgb(0_0_0/0.3)]" style={{ height: width ? height * scale : undefined }}>
          {page.screenshot ? (
            <img src={page.screenshot} alt={`${site.name} ${page.title}, for reference`} className="absolute inset-x-0 top-0 w-full select-none" draggable={false} />
          ) : (
            <Placeholder site={site} sections={sections} scale={scale} />
          )}
          {width > 0 &&
            sections.map((s) => (
              <SectionBox key={s.id} s={s} scale={scale} picked={picked.includes(s.order)} hovered={hover === s.order} onHover={setHover} onPick={pick} />
            ))}
        </div>
      </div>
      <aside className="flex max-h-[45%] min-h-0 w-full shrink-0 flex-col border-t border-zinc-950/6 md:max-h-none md:w-[300px] md:border-l md:border-t-0">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">Sections</span>
          <button
            type="button"
            onClick={() => setPicked(all ? [] : clippable)}
            disabled={!clippable.length}
            className={`h-7 rounded-full px-2.5 text-[12px] font-semibold text-zinc-700 disabled:opacity-40 ${PRESS} ${RING} ${HOVER}bg-zinc-950/5`}
          >
            {all ? 'Clear' : 'Select all'}
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {sections.map((s) => {
            const state = sectionClipState(library, s)
            const on = picked.includes(s.order)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!state.clippable}
                  aria-pressed={on}
                  onMouseEnter={() => setHover(s.order)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => pick(s.order, e.shiftKey || e.metaKey || e.ctrlKey || picked.length > 0)}
                  title={state.clippable ? undefined : state.note}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${RING} ${state.clippable ? PRESS : 'cursor-not-allowed'} ${on ? 'bg-key-soft' : hover === s.order && state.clippable ? 'bg-zinc-950/[0.04]' : ''}`}
                >
                  <span className={`grid size-5 shrink-0 place-items-center rounded-md text-[10.5px] font-semibold ${on ? 'bg-key text-white' : state.clippable ? 'bg-chip text-zinc-500' : 'bg-transparent text-zinc-300'}`}>
                    {on ? <Check size={12} strokeWidth={3} /> : s.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[12.5px] font-medium ${state.clippable ? 'text-zinc-900' : 'text-zinc-400'}`}>{TYPE_LABEL[s.type as SectionType] ?? s.type}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{state.clippable ? layoutName(library, state.clipId) : state.note}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="grid gap-1.5 border-t border-zinc-950/6 p-3">
          <p className="text-[11.5px] text-zinc-500">
            {picked.length ? `${picked.length} selected · ` : 'Click a section; ⇧ or ⌘ for more · '}
            {focusedLabel ? `goes after your ${focusedLabel.toLowerCase()}` : 'goes at the end of the page'}
          </p>
          <button type="button" disabled={!picked.length || busy} onClick={() => add(false)} className={`btn-lit flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold disabled:opacity-50 ${PRESS} ${RING}`}>
            <Plus size={15} /> Add to mix
          </button>
          <button type="button" disabled={!picked.length || busy} onClick={() => add(true)} className={`btn-quiet flex h-9 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-50 ${PRESS} ${RING}`}>
            <FilePlus2 size={14} /> On a new page
          </button>
        </div>
      </aside>
    </div>
  )
}

function SectionBox({ s, scale, picked, hovered, onHover, onPick }: { s: LibrarySection; scale: number; picked: boolean; hovered: boolean; onHover: (n: number | null) => void; onPick: (n: number, many: boolean) => void }) {
  const state = sectionClipState(library, s)
  const label = `${TYPE_LABEL[s.type as SectionType] ?? s.type} · ${state.clippable ? layoutName(library, state.clipId) : state.note}`
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={picked}
      disabled={!state.clippable}
      onMouseEnter={() => onHover(s.order)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onPick(s.order, e.shiftKey || e.metaKey || e.ctrlKey)}
      className={`group/box absolute inset-x-0 block text-left ${RING} ${state.clippable ? 'cursor-pointer' : 'cursor-not-allowed'} transition-[background-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        picked
          ? 'bg-[color-mix(in_srgb,var(--key)_14%,transparent)] shadow-[inset_0_0_0_2px_var(--key)]'
          : hovered
            ? state.clippable
              ? 'bg-zinc-950/[0.05] shadow-[inset_0_0_0_2px_rgb(24_24_27/0.55)]'
              : 'bg-[repeating-linear-gradient(135deg,rgb(0_0_0/0.06)_0_6px,transparent_6px_12px)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]'
            : ''
      }`}
      style={{ top: s.box.y * scale, height: Math.max(8, s.box.h * scale) }}
    >
      {(hovered || picked || !state.clippable) && (
        <span
          className={`absolute left-2 top-2 max-w-[calc(100%-16px)] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
            picked ? 'bg-key text-white' : state.clippable ? 'bg-zinc-900 text-white' : 'bg-white/90 text-zinc-500'
          }`}
        >
          {label}
        </span>
      )}
    </button>
  )
}

/** No screenshot (the dev fixture, or one still being captured): a box per section in the site's own colors. */
function Placeholder({ site, sections, scale }: { site: LibrarySite; sections: LibrarySection[]; scale: number }) {
  const t = site.tokens
  const bg = t['color.bg'] ?? '#ffffff'
  const text = t['color.text'] ?? '#18181b'
  const surface = t['color.surface'] ?? bg
  return (
    <div className="absolute inset-0" style={{ background: bg }} aria-hidden>
      {sections.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-x-0 flex flex-col items-center justify-center gap-1 border-b border-dashed"
          style={{ top: s.box.y * scale, height: s.box.h * scale, background: i % 2 ? surface : bg, borderColor: `color-mix(in srgb, ${text} 14%, transparent)`, color: text }}
        >
          <span className="text-[12px] font-semibold opacity-70" style={{ fontFamily: t['font.display'] }}>
            {TYPE_LABEL[s.type as SectionType] ?? s.type}
          </span>
          {s.hint && <span className="max-w-[70%] truncate text-center text-[11px] opacity-50">{s.hint}</span>}
        </div>
      ))}
    </div>
  )
}
