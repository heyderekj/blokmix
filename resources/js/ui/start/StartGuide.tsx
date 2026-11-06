import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, FileText, Moon, Plus, Shuffle, Sun, Upload, X } from 'lucide-react'
import { create } from 'zustand'
import type { GuideState, SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { FEEL_WORDS, themesFor, type FeelWord } from '@/core/feel'
import { skinById, skinList, skinOpen, WIREFRAME, type Skin } from '@/core/skins'
import { actionChoices, FORMAT_LABEL, FORMATS, GOAL_LABEL, GOALS, INDUSTRIES, INDUSTRY_LABEL, patchBrief, type Brief, type Goal } from '@/core/brief'
import { OPTIONAL, placeSection, textMode } from '@/core/jev/describe'
import { answer, briefFrom, emptyAnswers, feelFrom, folded, kindFrom, nextQuestion, QUESTIONS, reopen, sectionsFrom, skipToPages, type Answers, type Question } from '@/core/startFlow'
import type { Palette as Colors } from '@/core/palette'
import type { Starter } from '@/core/starters'
import { library, starters } from '@/data/library'
import { jevOn } from '@/lib/jev'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { guessHeard, hearStart, startsFromText, wordsCandidates, type Heard } from '@/lib/startFromText'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { FeelColors } from './FeelColors'
import { GuideOption, StarterOption, useDisplayFonts, type GuideChoice } from './StartFrom'
import { HOVER, INK, PINK, PRESS, PRIMARY, QUIET, SkinCard, StartCard, firstPage, sectionWords, useSkinFonts } from './parts'

/** Whether the guided start is showing over the board (the browser-only mix opens on it the first time). */
export const useStartFlow = create<{ open: boolean }>()(() => ({ open: false }))

const CHIP = `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${PRESS}`
const CHIP_ON = 'bg-[#17121A] text-white'
const CHIP_OFF = `bg-white text-[#3F363D] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] ${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.22)]`
const INPUT =
  'w-full rounded-xl bg-white px-4 text-[15px] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4]'
/** Sections a start always has: the chips can't drop them. */
const FIXED: SectionType[] = ['nav', 'hero', 'footer']

/**
 * New mix, a question at a time. What it's called, what it is (a sentence, or the words you already have), then what
 * was read from that, to confirm: the kind of site and its industry, what it should do, the main button, the sections
 * and the look. Each answer shows at once in the page on the right; anything the first sentence already settled folds
 * away, and "Skip, show me pages" takes every suggestion. Last come three ways to lay it out: the one you open is the
 * mix, the other two come along. Jev only ranks the answers on offer; nothing here is written for you.
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
  /** Saving the new mix (hosted): the buttons wait. */
  busy?: boolean
}) {
  const [a, setA] = useState<Answers>(emptyAnswers)
  const [heard, setHeard] = useState<Heard | null>(null)
  const [hearing, setHearing] = useState(false)
  const [jev, setJev] = useState(false)
  const [skin, setSkin] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [palette, setPalette] = useState<Colors | null>(null)
  const [mode, setMode] = useState<'light' | 'dark' | undefined>(undefined)
  const [fixed, setFixed] = useState<{ name: string; guide?: GuideState } | null>(null)
  const [seed, setSeed] = useState(0)
  const [starts, setStarts] = useState<ScoredStart[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useSkinFonts()
  useDisplayFonts(guides ?? null)

  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setJev(v))
    return () => {
      live = false
    }
  }, [])

  const q = nextQuestion(a, heard)
  const skip = folded(a, heard)
  const brief = briefFrom(a, heard)
  const kind = kindFrom(a, heard)
  const sections = sectionsFrom(a, heard)
  const feel = feelFrom(a, heard)
  const name = a.name.trim() || 'Your site'
  const open = useMemo(() => skinList().filter((x) => skinOpen(library, x) && x.id !== WIREFRAME), [])
  // The look on show: yours, else the best fit (the read's, then the feel's), never the grey sketch.
  const themes = useMemo(() => {
    const read = (heard?.looks ?? []).flatMap((id) => open.filter((x) => x.id === id))
    return [...new Set([...read, ...themesFor(feel, open, { count: 3 })])].slice(0, 3)
  }, [heard?.looks, feel, open])
  const theme = skin ?? themes[0]?.id ?? WIREFRAME
  const paste = heard?.mode === 'paste' && !!heard.plan
  const input: StartInput = { kind, name, seed, skin: theme, brand, palette, mode, brief, ...(paste ? {} : { sections }) }
  const key = JSON.stringify({ input, fixed: fixed?.name })

  // The page on the right: the first start for the answers so far, drawn at once (measuring waits for the end).
  const preview = useMemo<StartCandidate | null>(() => {
    const c = paste && heard?.plan ? wordsCandidates(input, heard.plan)[0] : startCandidates(input, library, 1)[0]
    return c && fixed ? { ...c, guide: fixed.guide ?? c.guide } : (c ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, heard])

  // The three ways to lay it out, measured, once every question is answered.
  useEffect(() => {
    if (q !== 'drafts') return
    let live = true
    setStarts(null)
    setProblem(null)
    ;(paste && heard ? startsFromText(input, heard) : scoredStarts(input))
      .then((s) => live && setStarts(fixed ? s.map((x) => ({ ...x, guide: fixed.guide ?? x.guide })) : s))
      .catch((e) => live && setProblem(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, key])

  /** What it is: a guess at once, then the read when it comes (unless you've moved on past what it changes). */
  const hear = (text: string) => {
    const t = text.trim()
    if (t.length < 3) return setHeard(null)
    setHeard(guessHeard(t))
    if (!jev) return
    setHearing(true)
    hearStart(t).then((h) => {
      setHearing(false)
      if (h) setHeard(h)
    })
  }

  const go = (question: Question, patch: Partial<Answers> = {}) => setA((x) => answer(x, question, patch))
  const setBrief = (patch: Partial<Brief>) => setA((x) => ({ ...x, brief: patchBrief(x.brief, patch) }))
  const pick = (s: ScoredStart) => onDone({ ...input }, starts!, s.id)

  // Each new question scrolls into view.
  const asking = useRef<HTMLDivElement>(null)
  useEffect(() => {
    asking.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [q])

  const summary: Partial<Record<Question, string>> = {
    name,
    what: paste ? `Your words: ${heard?.lines ?? 0} lines` : a.text.trim() || 'Skipped',
    confirm: brief.format || brief.industry ? [brief.format && FORMAT_LABEL[brief.format], brief.industry && INDUSTRY_LABEL[brief.industry]].filter(Boolean).join(' · ') : 'Skipped',
    goals: [...(brief.goals ?? []).map((g) => GOAL_LABEL[g]), ...(brief.goalsOther ? [brief.goalsOther] : [])].join(', ') || 'Skipped',
    action: brief.mainAction ?? 'Skipped',
    sections: paste && !a.sections ? 'Your words decide the sections' : cap(sectionWords(sections, 6)),
    look: fixed ? fixed.name : `${skinById(theme)?.name ?? 'A theme'}${brand || palette ? ', your colors' : ''}`,
  }

  const answered = QUESTIONS.filter((x) => x !== 'drafts' && x !== q && (a.done.includes(x) || skip[x] || (x === 'name' && a.name.trim())))
  const wide = q === 'drafts'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(880px,100%)] w-full max-w-[1200px] flex-col overflow-hidden rounded-[22px] bg-[#FBF8F9] shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_40px_80px_-32px_rgb(23_18_26/0.45)]"
        style={{ color: INK }}
        role="dialog"
        aria-modal="true"
        aria-label="New mix"
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/[0.06] bg-white px-4 py-2.5 sm:px-5">
          <h1 className="text-[15.5px] font-semibold">New mix</h1>
          <span className="flex-1" />
          {q !== 'drafts' && (
            <button type="button" onClick={() => setA((x) => skipToPages(x, heard))} className={`btn-quiet flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${PRESS}`}>
              Skip, show me pages <ArrowRight size={14} />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <main className={`min-h-0 overflow-y-auto px-5 py-6 sm:px-7 ${wide ? 'flex-1' : 'w-full lg:w-[540px] lg:shrink-0'}`}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {answered.map((x) => (
                <Answered key={x} label={LABEL[x]} value={skip[x] && !a.done.includes(x) ? skip[x]! : (summary[x] ?? '')} onChange={() => setA((y) => reopen(y, x))} />
              ))}
            </div>

            <div ref={asking} className={answered.length ? 'mt-5' : ''}>
              {q === 'name' && (
                <Ask title="What’s it called?" onNext={() => go('name', { name: a.name.trim() || 'Your site' })}>
                  <input autoFocus value={a.name} onChange={(e) => setA((x) => ({ ...x, name: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && go('name')} placeholder="Fern & Co" maxLength={80} className={`${INPUT} h-12`} />
                </Ask>
              )}

              {q === 'what' && (
                <Ask
                  title="What is it?"
                  lead="Say it in a sentence, or paste what you already have: an About page, a menu, your old site. Your words are never rewritten."
                  onNext={() => (hear(a.text), go('what'))}
                  onSkip={() => go('what', { text: '' })}
                >
                  <textarea
                    autoFocus
                    value={a.text}
                    onChange={(e) => setA((x) => ({ ...x, text: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && textMode(a.text) === 'describe' && (e.preventDefault(), hear(a.text), go('what'))}
                    placeholder="A bakery on Elm Street that takes pre-orders"
                    rows={a.text.split('\n').length > 2 ? 8 : 3}
                    className={`${INPUT} resize-none py-3 leading-relaxed`}
                  />
                  {a.text.trim() && textMode(a.text) === 'paste' && <p className="text-[13px] text-[#6B5F68]">Your words go on the page as written. Lines that don’t fit wait for you to place.</p>}
                </Ask>
              )}

              {(q === 'name' || q === 'what') && <StartFrom guides={guides} fixed={fixed} onBlank={() => onBlank(name)} onStarter={onStarter && ((s) => onStarter(s, name))} onImport={onImport} onGuide={(g) => (setFixed(g), setA((x) => ({ ...x, fixedGuide: !!g })))} />}

              {q === 'confirm' && (
                <Ask
                  title="What kind of site is it?"
                  lead={brief.format || brief.industry ? `Sounds like ${lower(brief.format ? FORMAT_LABEL[brief.format] : 'a site')}${brief.industry && brief.industry !== 'other' ? ` for ${lower(INDUSTRY_LABEL[brief.industry])}` : ''}. Change either one if not.` : 'Pick the closest. It decides which sections your page starts with.'}
                  busy={hearing}
                  onNext={() => go('confirm', { brief: patchBrief(a.brief, { format: brief.format, industry: brief.industry }) })}
                >
                  <Chips label="Kind of site">
                    {FORMATS.map((f) => (
                      <Chip key={f} on={brief.format === f} onClick={() => setBrief({ format: f })}>
                        {FORMAT_LABEL[f]}
                      </Chip>
                    ))}
                  </Chips>
                  <Chips label="Industry">
                    {[...new Set([...(heard?.industries ?? []).slice(0, 4), ...INDUSTRIES])].map((i) => (
                      <Chip key={i} on={brief.industry === i} onClick={() => setBrief({ industry: i })}>
                        {INDUSTRY_LABEL[i]}
                      </Chip>
                    ))}
                  </Chips>
                </Ask>
              )}

              {q === 'goals' && (
                <Ask title="What should it do for you?" lead="Pick a few. They decide what goes on the page first, and your agent hears them too." onNext={() => go('goals', { brief: patchBrief(a.brief, { goals: brief.goals ?? [] }) })} onSkip={() => go('goals')}>
                  <Chips>
                    {GOALS.map((g) => {
                      const on = !!brief.goals?.includes(g)
                      return (
                        <Chip key={g} on={on} onClick={() => setBrief({ goals: on ? (brief.goals ?? []).filter((x) => x !== g) : [...(brief.goals ?? []), g as Goal].slice(-4) })}>
                          {GOAL_LABEL[g]}
                        </Chip>
                      )
                    })}
                  </Chips>
                  <input value={a.brief.goalsOther ?? ''} onChange={(e) => setBrief({ goalsOther: e.target.value })} placeholder="Something else, in your words" maxLength={120} className={`${INPUT} h-11 text-[14px]`} />
                  <input value={a.brief.who ?? ''} onChange={(e) => setBrief({ who: e.target.value })} placeholder="Who’s it for? (optional)" maxLength={200} className={`${INPUT} h-11 text-[14px]`} />
                </Ask>
              )}

              {q === 'action' && <ActionStep brief={brief} onPick={(w, typed) => go('action', { brief: patchBrief(a.brief, { mainAction: w, mainActionTyped: typed }) })} onSkip={() => go('action')} />}

              {q === 'sections' && (
                <Ask title="What goes on the page?" lead="Take out what you don’t need. You can add, remove or move any of them later." onNext={() => go('sections', { sections })}>
                  <SectionChips sections={sections} onChange={(s) => setA((x) => ({ ...x, sections: s }))} />
                </Ask>
              )}

              {q === 'look' && preview && (
                <Ask title="How should it feel?" lead="Pick a few words, then the look you like. Everything can change later." onNext={() => go('look', { feel })}>
                  <Chips>
                    {FEEL_WORDS.map((w) => {
                      const on = feel.includes(w)
                      return (
                        <Chip key={w} on={on} onClick={() => (setSkin(null), setA((x) => ({ ...x, feel: on ? feel.filter((y) => y !== w) : [...feel, w as FeelWord] })))}>
                          <span className="capitalize">{w}</span>
                        </Chip>
                      )
                    })}
                  </Chips>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {themes.map((x: Skin) => (
                      <SkinCard key={x.id} skin={x} on={x.id === theme} start={preview} brand={brand} palette={x.id === theme ? palette : null} mode={x.id === theme ? mode : undefined} jevPick={!!heard?.looks.includes(x.id)} onPick={() => (setSkin(x.id), setMode(undefined))} />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <label className="flex h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
                      <input type="color" value={brand ?? skinById(theme)?.tokens['color.primary'] ?? '#404040'} onChange={(e) => (setBrand(e.target.value), setPalette(null))} className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Brand color" />
                      {palette ? 'Colors by feel' : brand ? 'Your brand color' : 'Have a brand color? Pick it'}
                    </label>
                    {(brand || palette) && (
                      <button type="button" onClick={() => (setBrand(null), setPalette(null))} className={QUIET}>
                        Use the theme’s own
                      </button>
                    )}
                    <div className="flex rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]" role="radiogroup" aria-label="Light or dark">
                      {(['light', 'dark'] as const).map((m) => {
                        const on = (mode ?? skinById(theme)?.mode ?? 'light') === m
                        return (
                          <button key={m} type="button" role="radio" aria-checked={on} onClick={() => (setMode(m), setPalette(null))} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium capitalize ${PRESS} ${on ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
                            {m === 'light' ? <Sun size={14} /> : <Moon size={14} />} {m}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {jev && <FeelColors feel={brief.what ?? feel.join(', ')} site={name} mode={mode} picked={palette} onPick={(p, b) => (setPalette(p), setBrand(b))} />}
                </Ask>
              )}

              {q === 'drafts' && (
                <section>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Three ways to lay it out</h2>
                      <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Open the one you like. The other two come along, so you can go back to them any time.</p>
                    </div>
                    <button type="button" onClick={() => setSeed((n) => n + 1)} disabled={!starts || paste} className={QUIET}>
                      <Shuffle size={15} /> Shuffle
                    </button>
                  </div>
                  {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
                  <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                    {starts
                      ? starts.map((s, i) => (
                          <StartCard key={s.id} start={s} letter={String.fromCharCode(65 + i)} best={i === 0 && starts.some((o) => o.score.score < s.score.score)} sections={new Set(starts.map((x) => firstPage(x).join())).size > 1} busy={busy} onPick={() => pick(s)} />
                        ))
                      : [0, 1, 2].map((i) => (
                          <div key={i} className="grid h-[330px] place-items-center rounded-[16px] bg-white/70 text-[13.5px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)] motion-safe:animate-pulse">
                            {i === 1 ? 'Laying out three ways…' : ''}
                          </div>
                        ))}
                  </div>
                </section>
              )}
            </div>
          </main>

          {!wide && (
            <aside className="hidden min-w-0 flex-1 border-l border-zinc-950/[0.06] p-6 lg:block" style={{ backgroundImage: 'radial-gradient(#E4D9DF 1.1px, transparent 1.2px)', backgroundSize: '22px 22px' }}>
              <div className="sticky top-0 overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.35)]">
                {preview ? (
                  <SkinPreview site={preview.site} guide={fixed?.guide ?? preview.guide} content={preview.content} title="Your page so far" height={620} peek />
                ) : (
                  <div className="grid h-[620px] place-items-center text-[13.5px] text-[#6B5F68]">Your page shows here as you answer.</div>
                )}
              </div>
              <p className="mt-3 text-center text-[12.5px] text-[#6B5F68]">{hearing ? 'Reading what you wrote…' : 'Your page so far. Hover to scroll it.'}</p>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

const LABEL: Record<Question, string> = {
  name: 'Called',
  what: 'What it is',
  confirm: 'Kind of site',
  goals: 'It should',
  action: 'Main button',
  sections: 'On the page',
  look: 'Look',
  drafts: 'Layouts',
}

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const lower = (s: string) => s.replace(/^./, (c) => c.toLowerCase())

/** An answered question, folded to one line; Change asks it again. */
function Answered({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/80 px-3.5 py-2 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
      <Check size={14} className="shrink-0" style={{ color: PINK }} />
      <span className="w-[88px] shrink-0 text-[12.5px] text-[#6B5F68]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{value}</span>
      <button type="button" onClick={onChange} className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
        Change
      </button>
    </div>
  )
}

/** The question being asked: a heading, a line under it, the answers, and Next. */
function Ask({ title, lead, busy, onNext, onSkip, children }: { title: string; lead?: string; busy?: boolean; onNext: () => void; onSkip?: () => void; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">{title}</h2>
        {lead && <p className="mt-1.5 min-h-[2lh] text-[15px] text-[#6B5F68] [text-wrap:pretty]">{lead}</p>}
      </div>
      {children}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onNext} className={PRIMARY}>
          Next <ArrowRight size={16} />
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className={QUIET}>
            Skip
          </button>
        )}
        {busy && <span className="text-[13px] text-[#6B5F68] motion-safe:animate-pulse">Reading…</span>}
      </div>
    </section>
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
      {children}
    </button>
  )
}

/** The main button's words: the ones that fit the goals, or your own. */
function ActionStep({ brief, onPick, onSkip }: { brief: Brief; onPick: (words: string, typed: boolean) => void; onSkip: () => void }) {
  const choices = actionChoices(brief)
  const [picked, setPicked] = useState(brief.mainAction && choices.includes(brief.mainAction) ? brief.mainAction : choices[0])
  const [own, setOwn] = useState(brief.mainAction && !choices.includes(brief.mainAction) ? brief.mainAction : '')
  return (
    <Ask title="What should the main button say?" lead="The one thing you most want people to do. It goes on the page’s main buttons." onNext={() => (own.trim() ? onPick(own.trim(), true) : onPick(picked, false))} onSkip={onSkip}>
      <Chips>
        {choices.map((w) => (
          <Chip key={w} on={!own.trim() && picked === w} onClick={() => (setPicked(w), setOwn(''))}>
            {w}
          </Chip>
        ))}
      </Chips>
      <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Or your own words" maxLength={40} className={`${INPUT} h-11 text-[14px]`} />
    </Ask>
  )
}

/** The page's sections as chips: ✕ takes one out (the nav, opener and footer stay), + adds one where it belongs. */
function SectionChips({ sections, onChange }: { sections: SectionType[]; onChange: (s: SectionType[]) => void }) {
  const [adding, setAdding] = useState(false)
  const more = OPTIONAL.filter((t) => !sections.includes(t))
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {sections.map((t) => (
          <span key={t} className={`${CHIP} ${CHIP_OFF} cursor-default`}>
            {TYPE_LABEL[t]}
            {!FIXED.includes(t) && (
              <button type="button" onClick={() => onChange(sections.filter((x) => x !== t))} aria-label={`Take out ${TYPE_LABEL[t]}`} className={`-mr-1.5 grid size-6 place-items-center rounded-full text-zinc-500 ${HOVER}bg-zinc-950/5 ${PRESS}`}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {more.length > 0 && (
          <button type="button" onClick={() => setAdding((x) => !x)} aria-expanded={adding} className={`${CHIP} ${CHIP_OFF}`}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      {adding && (
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-white/70 p-2 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
          {more.map((t) => (
            <button key={t} type="button" onClick={() => (onChange(placeSection(sections, t)), setAdding(false))} className={`${CHIP} ${CHIP_OFF}`}>
              <Plus size={13} /> {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The quiet ways in: a starter, a saved style guide, a blank page, a mix file. */
function StartFrom({ guides, fixed, onBlank, onStarter, onImport, onGuide }: {
  guides?: GuideChoice[] | null
  fixed: { name: string; guide?: GuideState } | null
  onBlank: () => void
  onStarter?: (s: Starter) => void
  onImport?: () => void
  onGuide: (g: { name: string; guide?: GuideState } | null) => void
}) {
  const [show, setShow] = useState<'starter' | 'guide' | null>(null)
  const LINK = `rounded-full px-2 py-1 text-[13px] font-medium text-[#3F363D] underline decoration-zinc-300 underline-offset-4 ${HOVER}decoration-zinc-600 ${PRESS}`
  return (
    <div className="mt-8 border-t border-zinc-950/[0.06] pt-4">
      {fixed ? (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-[#6B5F68]">
          Starting from the style guide <span className="font-semibold text-[#17121A]">{fixed.name}</span>
          <button type="button" onClick={() => onGuide(null)} className={LINK}>
            Use a theme instead
          </button>
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px] text-[#6B5F68]">
          Or start from:
          {onStarter && (
            <button type="button" aria-expanded={show === 'starter'} onClick={() => setShow(show === 'starter' ? null : 'starter')} className={LINK}>
              a starter
            </button>
          )}
          {guides !== undefined && (
            <button type="button" aria-expanded={show === 'guide'} onClick={() => setShow(show === 'guide' ? null : 'guide')} className={LINK}>
              a saved style guide
            </button>
          )}
          <button type="button" onClick={onBlank} className={`${LINK} inline-flex items-center gap-1`}>
            <FileText size={13} /> a blank page
          </button>
          {onImport && (
            <button type="button" onClick={onImport} className={`${LINK} inline-flex items-center gap-1`}>
              <Upload size={13} /> a mix file
            </button>
          )}
        </p>
      )}
      {show === 'starter' && onStarter && (
        <div className="mt-3 grid gap-2">
          {starters.map((s) => (
            <StarterOption key={s.id} starter={s} picked={false} onPick={() => onStarter(s)} />
          ))}
        </div>
      )}
      {show === 'guide' && (
        <div className="mt-3 grid gap-2">
          {guides === null && <p className="px-1 py-2 text-[13px] text-[#6B5F68]">Loading your style guides…</p>}
          {guides?.length === 0 && <p className="px-1 py-2 text-[13px] text-[#6B5F68]">No saved style guides yet. Save one from a mix’s Style guide.</p>}
          {guides?.map((g) => (
            <GuideOption key={g.key} name={g.name} note={g.note} guide={g.guide} picked={false} onPick={() => (onGuide({ name: g.name, guide: g.guide }), setShow(null))} />
          ))}
        </div>
      )}
    </div>
  )
}

