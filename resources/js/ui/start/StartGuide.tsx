import { Dropdown, type DropdownOption } from '@/ui/controls/Dropdown'
import { ColorButton } from '@/ui/color/ColorPicker'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Moon, Shuffle, Sun, X } from 'lucide-react'
import { create } from 'zustand'
import type { GuideState } from '@/core/types'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { FEEL_WORDS, type FeelWord } from '@/core/feel'
import { skinById, WIREFRAME } from '@/core/skins'
import { becauseLines, changedSection, emptyStart, startView, type StartState, type StartView } from '@/core/startFlow'
import { suggestedIndex } from '@/core/jev/themes'
import { scoreLooks } from '@/state/jevThemes'
import { rankThemes } from '@/core/themeRanking'
import { emptyGuide } from '@/core/guide'
import type { PaletteVariant } from '@/core/palette'
import type { Starter } from '@/core/starters'
import { library, starters } from '@/data/library'
import { jevOn } from '@/lib/jev'
import { listWords } from '@/core/jev/sentence'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { startsFromText, wordsCandidates, type Heard } from '@/lib/startFromText'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { GuideOption, StarterOption, useDisplayFonts, type GuideChoice } from './StartFrom'
import { Carousel, HOVER, PRESS, PRIMARY, QUIET, SkinCard, StartCard, firstPage, startHeroTitle } from './parts'
import { Chip } from './ChipRows'
import { Describe } from './Describe'
import { LivePreview } from './LivePreview'

/** Whether the guided start is showing over the board (the browser-only mix opens on it the first time). */
export const useStartFlow = create<{ open: boolean }>()(() => ({ open: false }))

/**
 * New site. One screen describes it: a sentence with blanks, rows for what it understood, and the real page beside them
 * from the first blank, which follows every change and says why. Next picks a look, then three ways to lay it out: the
 * one you open is the site, on its own. Nothing here is written for you.
 */
export function StartGuide({ onDone, onBlank, onStarter, onImport, guides, onClose, busy }: {
  /** The answers, every start (best first), and the one picked. */
  onDone: (input: StartInput, starts: ScoredStart[], chosen: string) => void
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
  const [skin, setSkin] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [variant, setVariant] = useState<PaletteVariant>()
  const [chosenMode, setMode] = useState<'light' | 'dark' | undefined>(undefined)
  const mode = chosenMode ?? s.tone ?? undefined
  const [fixed, setFixed] = useState<{ name: string; guide?: GuideState } | null>(null)
  const [seed, setSeed] = useState(0)
  const [starts, setStarts] = useState<ScoredStart[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

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
  const feel = v.feel
  const name = v.name || 'Your site'
  const copy = s.copy?.mode === 'paste' ? (s.copy as Heard) : null
  const paste = !!copy?.plan
  const [other, setOther] = useState(false)
  const rankingKey = JSON.stringify([brief, brand, variant, mode, other, name, skin])
  const shown = useMemo(() => {
    const guide = { ...emptyGuide(), mode, ...(brand ? { brand: { color: brand, variant } } : {}) }
    const best = rankThemes({ brief, guide })
    const ranked = other ? rankThemes({ brief, guide, different: true, exclude: best.map((r) => r.skin.id) }) : best
    const selected = skin && skinById(skin)
    if (!selected || ranked.some((r) => r.skin.id === skin)) return ranked
    return [...ranked.slice(0, 2), ...rankThemes({ brief, guide, pool: [selected], count: 1 })]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingKey, skin])
  const [visualPick, setVisualPick] = useState<{ key: string; id: string } | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    if (s.step === 'look' && jev && !other)
      scoreLooks(shown.map((r) => r.guide), JSON.stringify(brief), name, undefined, ctrl.signal).then((scores) => {
        const i = suggestedIndex(scores)
        if (!ctrl.signal.aborted && i >= 0) setVisualPick({ key: rankingKey, id: shown[i].skin.id })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, s.step, jev, name])
  const theme = skin ?? shown[0]?.skin.id ?? WIREFRAME
  /** The feeling the sentence gave, in your words ("cozy"), for the look step's lead. */
  const said = paste ? '' : listWords((s.picks.feel ?? []).map((p) => p.words.trim()).filter(Boolean))
  const input: StartInput = { kind: v.kind, name, seed, skin: theme, brand, variant, mode, brief, ...(paste ? {} : { sections: v.sections }) }
  const key = JSON.stringify({ input, fixed: fixed?.name })

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

  // The look step compares themes on the real page.
  const [previewHero, setPreviewHero] = useState(0)
  const previews = useMemo<StartCandidate[]>(() => {
    if (s.step !== 'look') return []
    return paste && copy?.plan ? wordsCandidates(input, copy.plan) : startCandidates(input, library)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, s.copy, s.step])
  const preview = previews[previewHero] ?? previews[0]

  // The three ways to lay it out, measured, once the look is picked.
  useEffect(() => {
    if (s.step !== 'drafts') return
    let live = true
    setStarts(null)
    setProblem(null)
    ;(paste && copy ? startsFromText(input, copy) : scoredStarts(input))
      .then((x) => live && setStarts(fixed ? x.map((y) => ({ ...y, guide: fixed.guide ?? y.guide })) : x))
      .catch((e) => live && setProblem(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.step, key, s.copy])

  const pick = (x: ScoredStart) => onDone({ ...input }, starts!, x.id)
  const toStep = (step: StartState['step']) => setS((x) => ({ ...x, step }))
  const next = () => toStep(fixed ? 'drafts' : 'look')

  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true })
  }, [])

  const wide = s.step === 'drafts'
  const summary = v.fill.text || 'Your site'

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
          {s.step !== 'drafts' && (
            <button type="button" disabled={reading} onClick={() => toStep('drafts')} className={`btn-quiet flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-45 ${PRESS}`}>
              Skip, show me pages <ArrowRight size={14} />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <div className={`grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] ${wide ? '' : 'lg:grid-cols-[540px_minmax(0,1fr)]'}`}>
          <div className={describing ? 'col-start-1 row-start-1 min-h-0 overflow-y-auto overscroll-contain lg:contents' : 'contents'}>
            <main className="col-start-1 row-start-1 min-w-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
              {!describing && (
                <button type="button" onClick={() => toStep('describe')} className={`mb-5 flex w-full min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2 text-left shadow-[0_0_0_1px_rgb(23_18_26/0.06)] ${PRESS} active:scale-[0.99]`}>
                  <ArrowLeft size={14} className="shrink-0 text-[#6B5F68]" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{summary}</span>
                  <span className="shrink-0 text-[12.5px] font-medium text-[#6B5F68]">Change</span>
                </button>
              )}
              {describing && <Describe s={s} v={v} setS={setS} jev={jev} onReading={setReading} />}

                {s.step === 'look' && preview && (
                  <Ask title="Pick a look" lead={other ? 'Try a different direction.' : said ? `Themes that feel ${said}.` : 'Choose a theme for your page.'} onNext={() => setS((x) => ({ ...x, step: 'drafts' }))}>
                    {!said && (
                      <Chips label="How should it feel?">
                        {FEEL_WORDS.map((w) => {
                          const on = feel.includes(w)
                          return (
                            <Chip key={w} on={on} onClick={() => (setSkin(null), setOther(false), setS((x) => ({ ...x, feel: on ? feel.filter((y) => y !== w) : [...feel, w as FeelWord] })))}>
                              <span className="capitalize">{w}</span>
                            </Chip>
                          )
                        })}
                      </Chips>
                    )}
                    {previews.length > 1 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#6B5F68]">
                        <span>Preview hero</span>
                        <Dropdown
                          label="Preview hero"
                          value={String(previews[previewHero] ? previewHero : 0)}
                          options={previews.map((p, i) => ({ v: String(i), label: startHeroTitle(p) ?? p.label }))}
                          onChange={(next) => setPreviewHero(Number(next))}
                          className="max-w-full"
                        />
                      </div>
                    )}
                    <Carousel label="Themes">
                      {shown.map(({ skin: x, guide, reason }) => (
                        <SkinCard key={x.id} skin={x} on={x.id === theme} start={preview} guide={guide} reason={reason} jevPick={jev && visualPick?.key === rankingKey && visualPick.id === x.id} onPick={() => setSkin(x.id)} />
                      ))}
                    </Carousel>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      <button type="button" onClick={() => (setOther((o) => !o), setSkin(null))} className={QUIET}>
                        <Shuffle size={14} /> {other ? 'Back to the best fits' : 'Show me different ones'}
                      </button>
                      <span className="flex-1" />
                      <span className="flex items-center rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">
                        <ColorButton
                          value={brand ?? skinById(theme)?.tokens['color.primary'] ?? '#404040'}
                          live={(h, v) => (setBrand(h), setVariant(v))}
                          onPick={(h, v) => (setBrand(h), setVariant(v))}
                          palette={mode ?? skinById(theme)?.mode ?? 'light'}
                          title="Brand color"
                          className={`flex h-8 items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium text-[#6B5F68] ${PRESS}`}
                        >
                          <span className="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: brand ?? skinById(theme)?.tokens['color.primary'] ?? '#404040' }} />
                          {brand ? <span className="font-mono text-[12px] uppercase">{brand}</span> : 'Brand color'}
                        </ColorButton>
                        {(brand) && (
                          <button type="button" onClick={() => (setBrand(null), setVariant(undefined))} aria-label="Use the theme’s own colors" title="Use the theme’s own colors" className={`grid size-8 place-items-center rounded-full text-[#6B5F68] hover:text-[#17121A] ${PRESS}`}>
                            <X size={14} />
                          </button>
                        )}
                        <span className="mx-1 h-5 w-px bg-zinc-950/10" aria-hidden />
                        <span className="flex" role="radiogroup" aria-label="Light or dark">
                          {(['light', 'dark'] as const).map((m) => {
                            const on = (mode ?? skinById(theme)?.mode ?? 'light') === m
                            return (
                              <button key={m} type="button" role="radio" aria-checked={on} aria-label={m === 'light' ? 'Light' : 'Dark'} title={m === 'light' ? 'Light' : 'Dark'} onClick={() => setMode(m)} className={`grid size-8 place-items-center rounded-full ${PRESS} ${on ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
                                {m === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                              </button>
                            )
                          })}
                        </span>
                      </span>
                    </div>
                  </Ask>
                )}

                {s.step === 'drafts' && (
                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Three ways to lay it out</h2>
                        <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Open the one you like. You can try another direction any time.</p>
                      </div>
                      <button type="button" onClick={() => setSeed((n) => n + 1)} disabled={!starts || paste} className={QUIET}>
                        <Shuffle size={15} /> Mix
                      </button>
                    </div>
                    {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
                    <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                      {starts
                        ? starts.map((s, i) => (
                            <StartCard key={s.id} copyLines={paste ? copy?.lines : undefined} start={s} letter={String.fromCharCode(65 + i)} best={i === 0 && starts.some((o) => o.score.score < s.score.score)} sections={new Set(starts.map((x) => firstPage(x).join())).size > 1} busy={busy} onPick={() => pick(s)} />
                          ))
                        : [0, 1, 2].map((i) => (
                            <div key={i} className="grid h-[330px] place-items-center rounded-[16px] bg-white/70 text-[13.5px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)] motion-safe:animate-pulse">
                              {i === 1 ? 'Laying out three ways…' : ''}
                            </div>
                          ))}
                    </div>
                  </section>
                )}
            </main>
            {!wide && (
              <aside className={`min-w-0 border-zinc-950/[0.06] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:overflow-y-auto lg:border-l lg:p-6 ${describing ? 'mx-5 mb-5 rounded-2xl border p-4 sm:mx-7 sm:p-5 lg:m-0 lg:rounded-none lg:border-0 lg:border-l' : 'hidden'}`} style={{ backgroundImage: 'radial-gradient(#E4D9DF 1.1px, transparent 1.2px)', backgroundSize: '22px 22px' }}>
                {describing ? (
                  <div className="sticky top-0">
                    <LivePreview input={input} plan={copy?.plan} focus={because.focus} lines={because.lines} reading={reading} />
                  </div>
                ) : (
                  preview && (
                    <>
                      <div className="group sticky top-0 overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.35)]">
                        <SkinPreview site={preview.site} guide={preview.guide} content={preview.content} title="Theme preview" height={620} peek />
                      </div>
                      <p className="mt-3 text-center text-[12.5px] text-[#6B5F68]">Theme preview. Hover to see more.</p>
                    </>
                  )
                )}
              </aside>
            )}
          </div>

          {describing && (
            <StartFrom
              busy={reading}
              onNext={next}
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

/** The question being asked and its answers. */
function Ask({ title, lead, busy, onNext, onSkip, children }: { title: string; lead?: string; busy?: boolean; onNext?: () => void; onSkip?: () => void; children: ReactNode }) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">{title}</h2>
        {lead && <p className="mt-1.5 min-h-[2lh] text-[15px] text-[#6B5F68] [text-wrap:pretty]">{lead}</p>}
      </div>
      {children}
      {onNext && <AskActions busy={busy} onNext={onNext} onSkip={onSkip} className="sticky -bottom-6 z-10 -mx-5 -mb-6 border-t border-zinc-950/[0.06] bg-[#FBF8F9] px-5 pb-6 pt-4 sm:-mx-7 sm:px-7" />}
    </section>
  )
}

function AskActions({ busy, onNext, onSkip, children, className = '' }: { busy?: boolean; onNext: () => void; onSkip?: () => void; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" disabled={busy} onClick={onNext} className={PRIMARY}>
        Next <ArrowRight size={16} />
      </button>
      {onSkip && <button type="button" onClick={onSkip} className={QUIET}>Skip</button>}
      {children}
      {busy && <span className="text-[13px] text-[#6B5F68] motion-safe:animate-pulse">Reading…</span>}
    </div>
  )
}

function Chips({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      {label && <span className="text-[13px] font-semibold text-[#6B5F68]">{label}</span>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
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

