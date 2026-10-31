import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, FileText, Globe, LayoutGrid, Lock, Palette, Sparkles, X, type LucideIcon } from 'lucide-react'
import type { GuideState, SectionType, TokenSet } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { TYPE_LABEL } from '@/core/content'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { library, starters } from '@/data/library'
import { buildStarter, type Starter } from '@/core/starters'
import { starterOpen } from '@/core/library'
import { listSites, loadSite, planClip, type LibraryPage, type LibrarySite, type LibrarySiteSummary } from '@/lib/siteLibrary'

export interface GuideChoice {
  key: string
  name: string
  note: string
  guide?: GuideState
}

/** What the new mix starts from, once picked. */
export type StartChoice =
  | { kind: 'blank' }
  | { kind: 'starter'; starter: Starter }
  | { kind: 'site'; site: LibrarySite; page: LibraryPage }
  | { kind: 'guide'; guide?: GuideState; name: string }

type How = 'blank' | 'starter' | 'site' | 'guide'

const PRESS = 'cursor-pointer transition-[scale,box-shadow] duration-150 active:scale-[0.99]'
const OPTION = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgb(23_18_26/0.1)] ${PRESS} [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_1px_rgb(23_18_26/0.25)]`
const PICKED = 'shadow-[inset_0_0_0_1.5px_#17121A] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_1.5px_#17121A]'
const BUTTON = `h-9 rounded-full px-4 text-[13.5px] font-semibold ${PRESS}`

/**
 * New mix, a step at a time: how to start (blank, a starter, a real site, a style guide), then which one, then its name.
 * Blank goes straight to the name. "Help me choose" hands over to the guided start.
 */
export function StartModal({
  guides,
  onCreate,
  onGuided,
  onClose,
}: {
  guides: GuideChoice[] | null
  onCreate: (choice: StartChoice, name: string) => void
  onGuided: () => void
  onClose: () => void
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [how, setHow] = useState<How | null>(null)
  const [choice, setChoice] = useState<StartChoice | null>(null)
  const [name, setName] = useState('')
  const [sites, setSites] = useState<LibrarySiteSummary[] | null>(null)
  useEffect(() => {
    listSites().then(setSites, () => setSites([]))
  }, [])
  useDisplayFonts(guides)
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const ways: { id: How; icon: LucideIcon; title: string; note: string }[] = [
    { id: 'blank', icon: FileText, title: 'Blank', note: 'The neutral style, nothing on the page yet' },
    { id: 'starter', icon: LayoutGrid, title: 'From a starter', note: 'A ready page in a sample style' },
    ...(sites?.length ? [{ id: 'site' as const, icon: Globe, title: 'From a real site', note: 'Its sections as layouts, in its look' }] : []),
    { id: 'guide', icon: Palette, title: 'From a style guide', note: 'One you saved, or another mix’s' },
  ]
  const from = (c: StartChoice) => (c.kind === 'starter' ? c.starter.name : c.kind === 'site' ? c.site.name : c.kind === 'guide' ? c.name : '')
  const suggested = (c: StartChoice) => (c.kind === 'starter' ? c.starter.name : c.kind === 'site' ? `${c.site.name} remix` : 'Untitled mix')
  const toName = (c: StartChoice) => (setChoice(c), setName(suggested(c)), setStep(2))
  const next = () => {
    if (step === 0) {
      if (how === 'blank') toName({ kind: 'blank' })
      else if (how) setStep(1)
    } else if (step === 1 && choice) toName(choice)
    else if (step === 2 && choice) onCreate(choice, name.trim() || suggested(choice))
  }
  const back = () => setStep(step === 2 && how === 'blank' ? 0 : ((step - 1) as 0 | 1))
  const can = step === 0 ? !!how : step === 1 ? !!choice : true
  const title = step === 0 ? 'New mix' : step === 1 ? ways.find((w) => w.id === how)?.title : 'Name it'

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New mix"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_32px_64px_-28px_rgb(23_18_26/0.45)]"
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/[0.06] py-3 pl-5 pr-3">
          <h2 className="flex-1 text-[15.5px] font-semibold text-[#17121A]">{title}</h2>
          <span className="flex gap-1" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <i key={i} className={`size-1.5 rounded-full ${i <= step ? 'bg-[#17121A]' : 'bg-zinc-950/15'}`} />
            ))}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-800 ${PRESS}`}>
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="grid gap-2">
              {ways.map((w) => (
                <button key={w.id} type="button" onClick={() => (setHow(w.id), setChoice(null))} className={`${OPTION} ${how === w.id ? PICKED : ''}`}>
                  <w.icon size={19} className="shrink-0 text-zinc-500" />
                  <Label title={w.title} note={w.note} />
                </button>
              ))}
              <button type="button" onClick={onGuided} className={`mt-1 flex items-center gap-1.5 justify-self-start rounded-full px-2 py-1 text-[13px] font-medium text-[#6B5F68] hover:bg-zinc-950/5 hover:text-[#17121A] ${PRESS}`}>
                <Sparkles size={14} /> Not sure? Help me choose
              </button>
            </div>
          )}
          {step === 1 && how === 'starter' && (
            <div className="grid gap-2">
              {starters.map((s) => (
                <StarterOption key={s.id} starter={s} picked={choice?.kind === 'starter' && choice.starter.id === s.id} onPick={() => setChoice({ kind: 'starter', starter: s })} />
              ))}
            </div>
          )}
          {step === 1 && how === 'site' && <SiteOptions sites={sites ?? []} choice={choice} onPick={setChoice} />}
          {step === 1 && how === 'guide' && (
            <div className="grid gap-2">
              <GuideOption name="Neutral" note="Blokmix’s plain starting style" picked={choice?.kind === 'guide' && !choice.guide} onPick={() => setChoice({ kind: 'guide', name: 'Neutral' })} />
              {(guides ?? []).map((g) => (
                <GuideOption key={g.key} name={g.name} note={g.note} guide={g.guide} picked={choice?.kind === 'guide' && choice.guide === g.guide} onPick={() => setChoice({ kind: 'guide', guide: g.guide, name: g.name })} />
              ))}
              {guides === null && <p className="px-1 py-3 text-[13px] text-[#6B5F68]">Loading your style guides…</p>}
            </div>
          )}
          {step === 2 && choice && (
            <form onSubmit={(e) => (e.preventDefault(), next())} className="grid gap-2">
              <label htmlFor="mix-name" className="text-[13px] text-[#6B5F68]">
                {choice.kind === 'blank' ? 'A blank mix in the neutral style.' : `From ${from(choice)}.`} You can change everything after.
              </label>
              <input
                id="mix-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.target.select()}
                maxLength={120}
                className="h-11 rounded-xl px-3.5 text-[15px] text-[#17121A] shadow-[inset_0_0_0_1px_rgb(23_18_26/0.15)] outline-none focus:shadow-[inset_0_0_0_1.5px_#17121A]"
              />
            </form>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-950/[0.06] px-4 py-3">
          <button type="button" onClick={back} className={`${BUTTON} flex items-center gap-1.5 text-[#6B5F68] hover:bg-zinc-950/5 hover:text-[#17121A] ${step === 0 ? 'invisible' : ''}`}>
            <ArrowLeft size={14} /> Back
          </button>
          <button type="button" disabled={!can} onClick={next} className={`${BUTTON} bg-[#17121A] text-white disabled:cursor-not-allowed disabled:opacity-35`}>
            {step === 2 ? 'Create mix' : 'Next'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Label({ title, note }: { title: string; note: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-semibold text-[#17121A]">{title}</span>
      <span className="block truncate text-[12.5px] text-[#6B5F68]">{note}</span>
    </span>
  )
}

/** "Aa" in the guide's display type with its main color, on its own background. */
function Swatch({ tokens: t }: { tokens: TokenSet }) {
  return (
    <span className="flex h-10 w-14 shrink-0 items-center justify-center gap-1.5 rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: t['color.bg'], color: t['color.text'] }}>
      <span className="text-[17px] leading-none" style={{ fontFamily: t['font.display'], fontWeight: Number(t['type.displayWeight']) || 700 }}>
        Aa
      </span>
      <i className="size-2 rounded-full" style={{ background: t['color.primary'] }} />
    </span>
  )
}

function StarterOption({ starter, picked, onPick }: { starter: Starter; picked: boolean; onPick: () => void }) {
  const { site, guide } = useMemo(() => buildStarter(library, starter), [starter])
  const t = useMemo(() => resolveGuide(guide).tokens, [guide])
  const sections = site.pages[0].slots.map((s) => TYPE_LABEL[s.type as SectionType]).join(' · ')
  // On Free, a starter that uses layouts in a mix pack shows a lock (creating it says why).
  const locked = !starterOpen(library, starter)
  return (
    <button type="button" onClick={onPick} className={`${OPTION} ${picked ? PICKED : ''} relative`} title={locked ? 'Uses layouts in a mix pack' : undefined}>
      <Swatch tokens={t} />
      <Label title={starter.name} note={locked ? `In a mix pack · ${sections}` : sections} />
      {locked && <Lock size={13} className="absolute right-2.5 top-2.5 text-zinc-500" aria-label="In a mix pack" />}
    </button>
  )
}

function GuideOption({ name, note, guide, picked, onPick }: { name: string; note: string; guide?: GuideState; picked: boolean; onPick: () => void }) {
  const t = resolveGuide(guide ?? { base: library.sources.layout.tokens, candidates: [], choices: {} }).tokens
  return (
    <button type="button" onClick={onPick} className={`${OPTION} ${picked ? PICKED : ''}`}>
      <Swatch tokens={t} />
      <Label title={name} note={note} />
    </button>
  )
}

/** The kinds of site the library groups real sites by (a site's industry), in this order; anything else comes last. */
const KIND_HEADING: Record<string, string> = {
  product: 'Products and apps',
  studio: 'Studios and agencies',
  local: 'Local spots',
  shop: 'Shops',
  event: 'Events',
  personal: 'Personal sites',
  writing: 'Writing and newsletters',
}

/** Real sites, grouped by kind: a strip of each screenshot; a site with several pages lists them under it once picked. */
function SiteOptions({ sites, choice, onPick }: { sites: LibrarySiteSummary[]; choice: StartChoice | null; onPick: (c: StartChoice) => void }) {
  const [open, setOpen] = useState<LibrarySite | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const usable = (site: LibrarySite) => site.pages.filter((p) => planClip(library, p, 'all').slots.length)
  const order = Object.keys(KIND_HEADING)
  const groups = Object.entries(sites.reduce<Record<string, LibrarySiteSummary[]>>((g, s) => ((g[s.industry ?? 'other'] ??= []).push(s), g), {})).sort(
    ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  )
  const pick = async (s: LibrarySiteSummary) => {
    setLoading(s.slug)
    const site = await loadSite(s.slug, library).catch(() => null)
    setLoading(null)
    if (!site) return
    setOpen(site)
    const pages = usable(site)
    if (pages.length) onPick({ kind: 'site', site, page: pages[0] })
  }
  return (
    <div className="grid gap-2">
      <p className="px-1 pb-1 text-[12.5px] text-[#6B5F68]">Its sections come in as Blokmix layouts with its look as your style guide. Never its words or pictures.</p>
      {groups.map(([kind, list]) => (
        <div key={kind} className="grid gap-2">
          <h3 className="px-1 pt-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5F68]/80">{KIND_HEADING[kind] ?? 'More sites'}</h3>
          {list.map((s) => {
            const on = choice?.kind === 'site' && choice.site.slug === s.slug
            const pages = on && open?.slug === s.slug ? usable(open) : []
            return (
              <div key={s.slug} className="grid gap-1.5">
                <button type="button" onClick={() => pick(s)} className={`${OPTION} ${on ? PICKED : ''}`}>
                  <span className="h-10 w-[72px] shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: s.palette?.bg ?? '#f4f4f5' }}>
                    {s.thumb && <img src={s.thumb} alt="" loading="lazy" className="size-full object-cover object-top" />}
                  </span>
                  <Label title={s.name} note={loading === s.slug ? 'Opening…' : `${s.matched} sections matched`} />
                </button>
                {pages.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pl-3">
                    {pages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPick({ kind: 'site', site: open!, page: p })}
                        className={`h-7 rounded-full px-3 text-[12.5px] font-medium ${PRESS} ${choice?.kind === 'site' && choice.page.id === p.id ? 'bg-[#17121A] text-white' : 'text-[#6B5F68] shadow-[inset_0_0_0_1px_rgb(23_18_26/0.12)]'}`}
                      >
                        {p.title || p.path}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Load the display fonts of every starter and guide on show, so each "Aa" is set in its own type. */
function useDisplayFonts(guides: GuideChoice[] | null) {
  const hrefs = useMemo(() => {
    const out = new Set<string>()
    const add = (t: TokenSet) => {
      const tokens = { 'font.display': t['font.display'], 'font.body': t['font.display'], 'font.mono': t['font.display'] } as Parameters<typeof fontsForTokens>[0]
      for (const h of fontHrefs(fontsForTokens(tokens, []))) out.add(h)
    }
    for (const s of starters) add(resolveGuide(buildStarter(library, s).guide).tokens)
    for (const g of guides ?? []) if (g.guide) add(resolveGuide(g.guide).tokens)
    return [...out]
  }, [guides])
  useEffect(() => {
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [hrefs])
}
