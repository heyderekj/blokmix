import { Dropdown, type DropdownOption } from '@/ui/controls/Dropdown'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { create } from 'zustand'
import type { GuideState } from '@/core/types'
import type { StartCandidate, StartInput } from '@/core/start'
import { WIREFRAME } from '@/core/skins'
import { becauseLines, changedSection, emptyStart, startView, type StartState, type StartView } from '@/core/startFlow'
import { rankThemes } from '@/core/themeRanking'
import { emptyGuide } from '@/core/guide'
import { skinById } from '@/core/skins'
import type { PaletteVariant } from '@/core/palette'
import type { Taste } from '@/core/taste'
import type { Starter } from '@/core/starters'
import { starters } from '@/data/library'
import { jevOn } from '@/lib/jev'
import type { Heard } from '@/lib/startFromText'
import { GuideOption, StarterOption, useDisplayFonts, type GuideChoice } from './StartFrom'
import { HOVER, PRESS, PRIMARY, QUIET } from './parts'
import { Describe } from './Describe'
import { LivePreview } from './LivePreview'
import { Versions } from './Versions'

/** Whether the guided start is showing over the board (the browser-only mix opens on it the first time). */
export const useStartFlow = create<{ open: boolean }>()(() => ({ open: false }))

/**
 * New site, in two screens. Describe it: a sentence with blanks, rows for what it understood, and the real page beside
 * them from the first blank, which follows every change and says why. Then pick a version: whole pages that differ in
 * layout and look. The one you open is the site, on its own; the rest are remembered as passed. Nothing here is
 * written for you.
 */
export function StartGuide({ onDone, onBlank, onStarter, onImport, guides, onClose, busy }: {
  /** The answers, the row shown, and the one opened (its words carry what you showed you like, `content.taste`). */
  onDone: (input: StartInput, starts: StartCandidate[], chosen: string) => void
  onBlank: (name: string) => void
  onStarter?: (starter: Starter, name: string) => void
  onImport?: () => void
  /** Saved style guides to start from (hosted); null while loading, undefined when there are none to offer. */
  guides?: GuideChoice[] | null
  onClose?: () => void
  /** Saving the new site (hosted): the buttons wait. */
  busy?: boolean
}) {
  const [s, setS] = useState<StartState>(emptyStart)
  const v = useMemo(() => startView(s), [s])
  const [reading, setReading] = useState(false)
  const [jev, setJev] = useState(false)
  const [brand, setBrand] = useState<string | null>(null)
  const [variant, setVariant] = useState<PaletteVariant>()
  const [chosenMode, setMode] = useState<'light' | 'dark' | undefined>(undefined)
  const mode = chosenMode ?? s.tone ?? undefined
  const [fixed, setFixed] = useState<{ name: string; guide?: GuideState } | null>(null)
  const [taste, setTaste] = useState<Taste>()

  useDisplayFonts(guides ?? null)

  useEffect(() => {
    let live = true
    jevOn().then((on) => live && setJev(on))
    return () => {
      live = false
    }
  }, [])

  const describing = s.step === 'describe'
  const brief = v.brief
  const name = v.name || 'Your site'
  const copy = s.copy?.mode === 'paste' ? (s.copy as Heard) : null
  // While describing, the page is drawn in the look that fits best so far.
  const theme = useMemo(() => {
    const guide = { ...emptyGuide(), mode, ...(brand ? { brand: { color: brand, variant } } : {}) }
    return rankThemes({ brief, guide, count: 1 })[0]?.skin.id ?? WIREFRAME
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([brief, brand, variant, mode])])
  const input: StartInput = {
    kind: v.kind,
    name,
    skin: theme,
    brand,
    variant,
    mode,
    brief,
    ...(copy?.plan ? {} : { sections: v.sections }),
    ...(s.pages.length ? { pages: s.pages } : {}),
  }

  // What changed and why, under the live page: the view and the look before this change against now.
  const [because, setBecause] = useState<{ lines: string[]; focus: StartView['sections'][number] | null }>({ lines: [], focus: null })
  const before = useRef<{ v: StartView; look?: string } | null>(null)
  const lookName = skinById(theme)?.name
  useEffect(() => {
    const prev = before.current
    before.current = { v, look: lookName }
    if (!prev) return
    const lines = becauseLines(prev.v, v, s.picks, { prev: prev.look, next: lookName })
    if (lines.length) setBecause({ lines, focus: changedSection(prev.v, v) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, lookName])

  const toStep = (step: StartState['step']) => setS((x) => ({ ...x, step }))
  const open = (chosen: StartCandidate, row: StartCandidate[], next: Taste) => {
    // What you showed you like rides along with the new site, so its later rows lean your way too.
    const withTaste = { ...chosen, content: { ...chosen.content, taste: next } }
    onDone({ ...input }, row.map((x) => (x.id === chosen.id ? withTaste : x)), chosen.id)
  }

  const dialog = useRef<HTMLDivElement>(null)
  // Focus comes into the window as it opens, unless a field inside it (the first blank) already has it.
  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div data-start-guide className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(880px,100%)] w-full max-w-[1200px] flex-col overflow-hidden rounded-[22px] bg-[#FBF8F9] shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_40px_80px_-32px_rgb(23_18_26/0.45)] outline-none"
        style={{ color: '#17121A' }}
        role="dialog"
        aria-modal="true"
        aria-label="New site"
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/[0.06] bg-white px-4 py-2.5 sm:px-5">
          <h1 className="text-[15.5px] font-semibold">New site</h1>
          <span className="flex-1" />
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <div className={`grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] ${describing ? 'lg:grid-cols-[540px_minmax(0,1fr)]' : ''}`}>
          <div className={describing ? 'col-start-1 row-start-1 min-h-0 overflow-y-auto overscroll-contain lg:contents' : 'contents'}>
            <main className="col-start-1 row-start-1 min-w-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
              {describing ? (
                <Describe s={s} v={v} setS={setS} jev={jev} onReading={setReading} />
              ) : (
                <>
                  <button type="button" onClick={() => toStep('describe')} className={`mb-5 flex w-full min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2 text-left shadow-[0_0_0_1px_rgb(23_18_26/0.06)] ${PRESS} active:scale-[0.99]`}>
                    <ArrowLeft size={14} className="shrink-0 text-[#6B5F68]" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{v.fill.text || name}</span>
                    <span className="shrink-0 text-[12.5px] font-medium text-[#6B5F68]">Change</span>
                  </button>
                  <Versions
                    input={input}
                    copy={copy}
                    fixed={fixed}
                    taste={taste}
                    onTaste={setTaste}
                    brand={brand}
                    onBrand={(h, va) => (setBrand(h), setVariant(va))}
                    mode={mode}
                    onMode={setMode}
                    busy={busy}
                    onOpen={open}
                  />
                </>
              )}
            </main>
            {describing && (
              <aside className="mx-5 mb-5 min-w-0 rounded-2xl border border-zinc-950/[0.06] p-4 sm:mx-7 sm:p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:m-0 lg:block lg:overflow-y-auto lg:rounded-none lg:border-0 lg:border-l lg:p-6" style={{ backgroundImage: 'radial-gradient(#E4D9DF 1.1px, transparent 1.2px)', backgroundSize: '22px 22px' }}>
                <div className="sticky top-0">
                  <LivePreview input={input} plan={copy?.plan} focus={because.focus} lines={because.lines} reading={reading} />
                </div>
              </aside>
            )}
          </div>

          {describing && (
            <StartFrom
              busy={reading}
              onNext={() => toStep('versions')}
              guides={guides}
              fixed={fixed}
              onBlank={() => onBlank(name)}
              onStarter={onStarter && ((x) => onStarter(x, name))}
              onImport={onImport}
              onGuide={(g) => (setFixed(g), setS((x) => ({ ...x, fixedGuide: !!g })))}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AskActions({ busy, onNext, onSkip, children, className = '' }: { busy?: boolean; onNext: () => void; onSkip?: () => void; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" disabled={busy} onClick={onNext} className={PRIMARY}>
        Show me versions <ArrowRight size={16} />
      </button>
      {onSkip && <button type="button" onClick={onSkip} className={QUIET}>Skip</button>}
      {children}
      {busy && <span className="text-[13px] text-[#6B5F68] motion-safe:animate-pulse">Reading…</span>}
    </div>
  )
}

type StartSource = 'starter' | 'guide' | 'blank' | 'file'

/** The first step's footer, with Next and the alternative ways to start. */
function StartFrom({ busy, onNext, guides, fixed, onBlank, onStarter, onImport, onGuide }: {
  busy?: boolean
  onNext: () => void
  guides?: GuideChoice[] | null
  fixed: { name: string; guide?: GuideState } | null
  onBlank: () => void
  onStarter?: (s: Starter) => void
  onImport?: () => void
  onGuide: (g: { name: string; guide?: GuideState } | null) => void
}) {
  const [show, setShow] = useState<'starter' | 'guide' | null>(null)
  const sources: DropdownOption<StartSource>[] = []
  if (onStarter) sources.push({ v: 'starter', label: 'A starter' })
  if (guides !== undefined) sources.push({ v: 'guide', label: 'A saved style guide' })
  sources.push({ v: 'blank', label: 'A blank page' })
  if (onImport) sources.push({ v: 'file', label: 'A site file' })

  const chooseSource = (source: StartSource) => {
    if (source === 'starter' || source === 'guide') {
      setShow((current) => current === source ? null : source)
      return
    }
    setShow(null)
    if (source === 'blank') onBlank()
    else onImport?.()
  }

  return (
    <footer className="col-start-1 row-start-2 flex min-w-0 flex-col gap-2 border-t border-zinc-950/[0.06] bg-[#FBF8F9] px-5 py-3 sm:px-7 sm:py-4">
      <AskActions busy={busy} onNext={onNext} className="flex-wrap">
        {!fixed && (
          <Dropdown label="Start from" options={sources} onChange={chooseSource} placement="above" className="btn-quiet h-11 rounded-full! px-4 text-[14px] font-semibold" />
        )}
      </AskActions>
      {fixed ? (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-[#6B5F68]">
          Starting from the style guide <span className="font-semibold text-[#17121A]">{fixed.name}</span>
          <button type="button" onClick={() => onGuide(null)} className={`rounded-full px-2 py-1 text-[13px] font-medium text-[#3F363D] underline decoration-zinc-300 underline-offset-4 ${HOVER}decoration-zinc-600 ${PRESS}`}>
            Use a theme instead
          </button>
        </p>
      ) : show && (
        <div className="order-first grid gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">{show === 'starter' ? 'Choose a starter' : 'Choose a saved style guide'}</h3>
            <button type="button" onClick={() => setShow(null)} aria-label="Close choices" className={`grid size-8 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={15} />
            </button>
          </div>
          <div className="grid max-h-[min(30dvh,16rem)] gap-2 overflow-y-auto overscroll-contain pb-1">
            {show === 'starter' && onStarter && starters.map((s) => (
              <StarterOption key={s.id} starter={s} picked={false} onPick={() => onStarter(s)} />
            ))}
            {show === 'guide' && (
              <>
                {guides === null && <p className="px-1 py-2 text-[13px] text-[#6B5F68]">Loading your style guides…</p>}
                {guides?.length === 0 && <p className="px-1 py-2 text-[13px] text-[#6B5F68]">No saved style guides yet. Save one from a site’s Style guide.</p>}
                {guides?.map((g) => (
                  <GuideOption key={g.key} name={g.name} note={g.note} guide={g.guide} picked={false} onPick={() => (onGuide({ name: g.name, guide: g.guide }), setShow(null))} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </footer>
  )
}

