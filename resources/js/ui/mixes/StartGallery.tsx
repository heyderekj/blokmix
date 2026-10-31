import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import type { GuideState, SectionType } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { library, starters } from '@/data/library'
import { buildStarter, type Starter } from '@/core/starters'
import { listSites, loadSite, planClip, type LibraryPage, type LibrarySite, type LibrarySiteSummary } from '@/lib/siteLibrary'
import { MixThumb } from './MixThumb'

export type Shelf = 'starters' | 'sites' | 'guides'
export interface GuideChoice {
  key: string
  name: string
  note: string
  guide?: GuideState
}

const SHELF_LABEL: Record<Shelf, string> = { starters: 'Starters', sites: 'Real sites', guides: 'Style guides' }
const PRESS = 'cursor-pointer transition-[scale] duration-150 active:scale-[0.98]'
const CARD = `group/card flex flex-col gap-2.5 rounded-2xl p-2 text-left ${PRESS} [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-950/[0.035]`
const FRAME = 'block aspect-[4/3] w-full overflow-hidden rounded-xl shadow-[0_0_0_1px_rgb(23_18_26/0.08)] transition-[box-shadow] duration-150 group-hover/card:shadow-[0_0_0_1px_rgb(23_18_26/0.14),0_10px_24px_-14px_rgb(23_18_26/0.35)]'

/**
 * New mix, from something: a wide sheet with three shelves (starter mixes, real sites from the library, style guides),
 * each a grid of big previews drawn in their own style, names in the app's own type. A blank mix stays one click.
 */
export function StartGallery({
  guides,
  onBlank,
  onStarter,
  onSite,
  onGuide,
  onClose,
}: {
  guides: GuideChoice[] | null
  onBlank: () => void
  onStarter: (s: Starter) => void
  onSite: (site: LibrarySite, page: LibraryPage) => void
  onGuide: (g?: GuideState) => void
  onClose: () => void
}) {
  const [shelf, setShelf] = useState<Shelf>('starters')
  const [sites, setSites] = useState<LibrarySiteSummary[] | null>(null)
  useEffect(() => {
    listSites().then(setSites, () => setSites([]))
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  // Real sites only once the library has some.
  const shelves = (['starters', 'sites', 'guides'] as Shelf[]).filter((s) => s !== 'sites' || sites?.length)

  // Into the body: the tile it opens from animates with a transform, which would hold a fixed sheet inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New mix"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(780px,100%)] w-full max-w-[1080px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_40px_80px_-32px_rgb(23_18_26/0.45)]"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-zinc-950/[0.06] px-5 py-4 sm:px-6">
          <h2 className="text-[17px] font-semibold text-[#17121A]">New mix</h2>
          {/* On phones the shelves take their own row under the title, Blank mix and close. */}
          <div className="order-last flex w-max rounded-full bg-zinc-950/[0.05] p-0.5 sm:order-none" role="tablist">
            {shelves.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={shelf === s}
                onClick={() => setShelf(s)}
                className={`h-8 rounded-full px-3.5 text-[13px] font-medium ${PRESS} ${shelf === s ? 'bg-white text-[#17121A] shadow-sm' : 'text-[#6B5F68] hover:text-[#17121A]'}`}
              >
                {SHELF_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={onBlank} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[#17121A] shadow-[inset_0_0_0_1px_rgb(23_18_26/0.12)] hover:bg-zinc-950/[0.04] ${PRESS}`}>
              <Plus size={14} strokeWidth={2.4} /> Blank mix
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-800 ${PRESS}`}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          {shelf === 'starters' && (
            <Grid>
              {starters.map((s) => (
                <StarterCard key={s.id} starter={s} onPick={() => onStarter(s)} />
              ))}
            </Grid>
          )}
          {shelf === 'sites' && <Sites sites={sites ?? []} onPick={onSite} />}
          {shelf === 'guides' && (
            <Grid>
              <GuideCard name="Neutral" note="Blokmix’s plain starting style" onPick={() => onGuide()} />
              {(guides ?? []).map((g) => (
                <GuideCard key={g.key} name={g.name} note={g.note} guide={g.guide} onPick={() => onGuide(g.guide)} />
              ))}
              {guides === null && <p className="col-span-full px-2 py-6 text-[13px] text-[#6B5F68]">Loading your style guides…</p>}
            </Grid>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
}

function Caption({ name, note }: { name: string; note: string }) {
  return (
    <span className="grid gap-0.5 px-1">
      <span className="truncate text-[14px] font-semibold text-[#17121A]">{name}</span>
      <span className="line-clamp-2 text-[12.5px] leading-snug text-[#6B5F68]">{note}</span>
    </span>
  )
}

/** A starter mix: its first page in its own style guide. */
function StarterCard({ starter, onPick }: { starter: Starter; onPick: () => void }) {
  const { site, guide } = useMemo(() => buildStarter(library, starter), [starter])
  const sections = useMemo(
    () => [site.shared.nav?.type, ...site.pages[0].slots.map((s) => s.type), site.shared.footer?.type].filter(Boolean) as SectionType[],
    [site],
  )
  return (
    <li>
      <button type="button" onClick={onPick} className={`${CARD} w-full`}>
        <span className={FRAME}>
          <MixThumb sections={sections} guide={guide} />
        </span>
        <Caption name={starter.name} note={starter.description} />
      </button>
    </li>
  )
}

/** A style guide: its colors as a page, a line of type in its display font. */
function GuideCard({ name, note, guide, onPick }: { name: string; note: string; guide?: GuideState; onPick: () => void }) {
  const t = resolveGuide(guide ?? { base: library.sources.layout.tokens, candidates: [], choices: {} }).tokens
  return (
    <li>
      <button type="button" onClick={onPick} className={`${CARD} w-full`}>
        <span className={`${FRAME} flex flex-col justify-between p-4`} style={{ background: t['color.bg'], color: t['color.text'] }}>
          <span className="text-[34px] leading-none" style={{ fontFamily: t['font.display'], fontWeight: Number(t['type.displayWeight']) || 700 }}>
            Aa
          </span>
          <span className="flex gap-1.5">
            {[t['color.text'], t['color.primary'], t['color.accent'], t['color.surface']].map((c, i) => (
              <i key={i} className="size-5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: c }} />
            ))}
          </span>
        </span>
        <Caption name={name} note={note} />
      </button>
    </li>
  )
}

/** Real sites from the library: a screenshot each; a site with several pages asks which one. */
function Sites({ sites, onPick }: { sites: LibrarySiteSummary[]; onPick: (site: LibrarySite, page: LibraryPage) => void }) {
  const [open, setOpen] = useState<LibrarySite | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const choose = async (s: LibrarySiteSummary) => {
    setLoading(s.slug)
    const site = await loadSite(s.slug, library).catch(() => null)
    setLoading(null)
    if (!site) return
    const pages = site.pages.filter((p) => planClip(library, p, 'all').slots.length)
    if (pages.length === 1) onPick(site, pages[0])
    else setOpen(site)
  }
  if (open)
    return (
      <div className="px-1">
        <button type="button" onClick={() => setOpen(null)} className={`mb-3 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#6B5F68] hover:bg-zinc-950/5 hover:text-[#17121A] ${PRESS}`}>
          <ArrowLeft size={14} /> {open.name}: which page?
        </button>
        <Grid>
          {[...open.pages]
            .sort((a, b) => a.order - b.order)
            .map((p) => {
              const n = planClip(library, p, 'all').slots.length
              return (
                <li key={p.id}>
                  <button type="button" disabled={!n} onClick={() => onPick(open, p)} className={`${CARD} w-full disabled:cursor-not-allowed disabled:opacity-50`}>
                    <span className={`${FRAME} bg-zinc-100`}>{p.screenshot && <img src={p.screenshot} alt="" loading="lazy" className="size-full object-cover object-top" />}</span>
                    <Caption name={p.title || p.path} note={n ? `${n} sections, as Blokmix layouts in its style` : 'No layouts matched yet'} />
                  </button>
                </li>
              )
            })}
        </Grid>
      </div>
    )
  return (
    <>
      <p className="mb-3 px-3 text-[13px] text-[#6B5F68]">Its sections come in as Blokmix layouts with its look as your style guide. Never its words or pictures.</p>
      <Grid>
        {sites.map((s) => (
          <li key={s.slug}>
            <button type="button" onClick={() => choose(s)} className={`${CARD} w-full`}>
              <span className={FRAME} style={{ background: s.palette?.bg ?? '#f4f4f5' }}>
                {s.thumb && <img src={s.thumb} alt="" loading="lazy" className="size-full object-cover object-top" />}
              </span>
              <Caption name={s.name} note={loading === s.slug ? 'Opening…' : [s.industry, `${s.matched} sections matched`].filter(Boolean).join(' · ')} />
            </button>
          </li>
        ))}
      </Grid>
    </>
  )
}
