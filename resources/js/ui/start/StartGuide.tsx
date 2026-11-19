import { Dropdown, type DropdownOption } from '@/ui/controls/Dropdown'
import { ColorButton } from '@/ui/color/ColorPicker'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, FileUp, Moon, Plus, Shuffle, Sun, X } from 'lucide-react'
import { create } from 'zustand'
import type { GuideState, SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { startCandidates, type StartCandidate, type StartInput } from '@/core/start'
import { FEEL_WORDS, type FeelWord } from '@/core/feel'
import { skinById, WIREFRAME } from '@/core/skins'
import { actionChoices, FORMAT_LABEL, FORMATS, GOAL_LABEL, GOALS, INDUSTRIES, INDUSTRY_LABEL, patchBrief, type Brief, type Goal } from '@/core/brief'
import { OPTIONAL, placeSection } from '@/core/jev/describe'
import { answer, answersFromSentence, briefFrom, emptyAnswers, heardFromSentence, feelFrom, folded, kindFrom, nextQuestion, QUESTIONS, reopen, sectionsFrom, skipToPages, type Answers, type Question } from '@/core/startFlow'
import { suggestedIndex } from '@/core/jev/themes'
import { scoreLooks } from '@/state/jevThemes'
import { rankThemes } from '@/core/themeRanking'
import { emptyGuide } from '@/core/guide'
import type { PaletteVariant } from '@/core/palette'
import type { Starter } from '@/core/starters'
import { library, starters } from '@/data/library'
import { askJev, askLatest, jevOn } from '@/lib/jev'
import { noteWants } from '@/lib/jevWants'
import { fillStart, listWords, matchRequest, openBlanks, rankRequest, readMatch, readRank, sentenceText, startSentence, type Blank, type Picks } from '@/core/jev/sentence'
import { Sentence } from '@/ui/jev/Sentence'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { COPY_LIMIT, readCopyDocument } from '@/lib/copyDocument'
import { hearStart, startsFromText, wordsCandidates, type Heard } from '@/lib/startFromText'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { GuideOption, StarterOption, useDisplayFonts, type GuideChoice } from './StartFrom'
import { Carousel, HOVER, INK, PINK, PRESS, PRIMARY, QUIET, SkinCard, StartCard, StartOutline, firstPage, startHeroTitle, sectionWords } from './parts'

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
 * New mix, a question at a time. The sentence describes the site and the next step takes optional website copy.
 * Then confirm the kind of site and its industry, what it should do, the main button, the sections
 * and the look. The sidebar shows a neutral outline until the look step; anything the first sentence already settled folds
 * away, and "Skip, show me pages" takes every suggestion. Last come three ways to lay it out: the one you open is the
 * mix, on its own. Jev only ranks the answers on offer; nothing here is written for you.
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
  const [description, setDescription] = useState<Heard | null>(null)
  const [copyRead, setCopyRead] = useState<Heard | null>(null)
  const heard = a.done.includes('copy') && copyRead ? copyRead : description
  const [hearing, setHearing] = useState(false)
  const [jev, setJev] = useState(false)
  const [skin, setSkin] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [variant, setVariant] = useState<PaletteVariant>()
  const [mode, setMode] = useState<'light' | 'dark' | undefined>(undefined)
  const [fixed, setFixed] = useState<{ name: string; guide?: GuideState } | null>(null)
  const [seed, setSeed] = useState(0)
  const [starts, setStarts] = useState<ScoredStart[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useDisplayFonts(guides ?? null)

  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setJev(v))
    return () => {
      live = false
    }
  }, [])

  const [picks, setPicks] = useState<Picks>({})
  const [pasted, setPasted] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileNote, setFileNote] = useState('')
  const [copyError, setCopyError] = useState('')
  const overLimit = pasted.length > COPY_LIMIT
  const wordCount = useMemo(() => pasted.match(/[\p{L}\p{N}]+(?:['’–-][\p{L}\p{N}]+)*/gu)?.length ?? 0, [pasted])
  const importFile = async (file?: File) => {
    if (!file) return
    setLoadingFile(true)
    setCopyError('')
    try {
      const text = await readCopyDocument(file)
      const combined = pasted.trim() ? `${pasted.trimEnd()}\n\n${text}` : text
      if (combined.length > COPY_LIMIT) throw new Error('This would exceed 100,000 characters. Paste an excerpt or import a shorter document.')
      setPasted(combined)
      setFileNote(`Imported ${file.name}`)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Couldn’t read the file. Paste your copy below.')
    } finally {
      setLoadingFile(false)
    }
  }
  const [order, setOrder] = useState<Record<string, string[]>>({})
  const segments = useMemo(() => startSentence(picks), [picks])
  const fill = useMemo(() => fillStart(picks), [picks])
  const q = nextQuestion(a, heard)
  const starting = q === 'what'
  const copying = q === 'copy'
  const hasCopy = !!pasted.trim()
  const skip = folded(a, heard)
  // While the sentence is being filled in, the page on the right already follows it.
  const sh = starting ? heardFromSentence(fill, picks) : null
  const va: Answers = starting ? answersFromSentence(a, fill, picks) : a
  const vh: Heard | null = starting ? (sh ? { ...sh, kinds: sh.kind ? [sh.kind] : [] } : null) : heard
  const brief = briefFrom(va, vh)
  const kind = kindFrom(va, vh)
  const sections = sectionsFrom(va, vh)
  const feel = feelFrom(va, vh)
  const name = va.name.trim() || 'Your site'
  const [other, setOther] = useState(false)
  const rankingKey = JSON.stringify([brief, brand, variant, mode, other, name, skin])
  const shown = useMemo(() => {
    const guide = { ...emptyGuide(), mode, ...(brand ? { brand: { color: brand, variant } } : {}) }
    const best = rankThemes({ brief, guide })
    const ranked = other ? rankThemes({ brief, guide, different: true, exclude: best.map((r) => r.skin.id) }) : best
    const selected = skin && skinById(skin)
    if (!selected || ranked.some((r) => r.skin.id === skin)) return ranked
    return [...ranked.slice(0,2), ...rankThemes({brief,guide,pool:[selected],count:1})]
  }, [rankingKey, skin])
  const [visualPick, setVisualPick] = useState<{ key:string; id:string } | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    if (q === 'look' && jev && !other) scoreLooks(shown.map((r) => r.guide), JSON.stringify(brief), name, undefined, ctrl.signal).then((scores) => {
      const i = suggestedIndex(scores)
      if (!ctrl.signal.aborted && i >= 0) setVisualPick({key:rankingKey, id:shown[i].skin.id})
    })
    return () => ctrl.abort()
  }, [shown, q, jev, name])
  const shownThemes = shown.map((r) => r.skin)
  const theme = skin ?? shownThemes[0]?.id ?? WIREFRAME
  const paste = heard?.mode === 'paste' && !!heard.plan
  /** The feeling the sentence gave, in your words ("cozy"), for the look step's lead. */
  const said = paste ? '' : listWords((picks.feel ?? []).map((p) => p.words.trim()).filter(Boolean))
  const input: StartInput = { kind, name, seed, skin: theme, brand, variant, mode, brief, ...(paste ? {} : { sections }) }
  const key = JSON.stringify({ input, fixed: fixed?.name })

  // Real page previews are only needed while comparing themes. The questions render a neutral outline.
  const [previewHero, setPreviewHero] = useState(0)
  const previews = useMemo<StartCandidate[]>(() => {
    if (q !== 'look') return []
    return paste && heard?.plan ? wordsCandidates(input, heard.plan) : startCandidates(input, library)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, heard, q])
  const preview = previews[previewHero] ?? previews[0]

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
  }, [q, key, heard])

  const go = (question: Question, patch: Partial<Answers> = {}) => setA((x) => answer(x, question, patch))

  // The open blanks' options, in the order that fits what's filled so far.
  useEffect(() => {
    if (!jev || !fill.text) return
    const open = openBlanks(segments, picks)
    if (!open.some((b) => !b.ownOnly)) return
    let live = true
    const timer = window.setTimeout(() => {
      askLatest('start-sentence', rankRequest(sentenceText(segments, picks), open)).then((res) => live && res && setOrder((o) => ({ ...o, ...readRank(res, open) })))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill.text, jev])
  const match = async (b: Blank, words: string) => readMatch(await askJev(matchRequest(b, words, fill.text)))
  /** The sentence fills the brief before we ask for copy. */
  const startNext = async (skipQuestions = false) => {
    if (hearing) return
    const next = answersFromSentence(a, fill, picks)
    const sure = heardFromSentence(fill, picks)
    let reading: Heard | null = sure ? { ...sure, kinds: sure.kind ? [sure.kind] : [] } : null
    setHearing(true)
    try {
      if (fill.wants.length && jev) void noteWants(fill.wants, 'start', undefined, fill.kind ?? undefined)
      const business = picks.business?.[0]
      if (jev && business?.words.trim() && !business.id) {
        reading = (await hearStart(fill.text, fill.kind ?? 'studio', 'describe').catch(() => null)) ?? reading
      }
    } finally {
      setDescription(reading)
      setCopyRead(null)
      setA(skipQuestions && !hasCopy ? skipToPages(next, reading) : next)
      setHearing(false)
    }
  }

  const finishCopy = async (skipQuestions = false) => {
    if (loadingFile || hearing || overLimit) return
    setHearing(true)
    setCopyError('')
    try {
      let reading: Heard | null = null
      let next = answer(a, 'copy')
      if (hasCopy) {
        const document = await hearStart(pasted, kind, 'paste')
        if (!document?.plan?.lines.length) throw new Error('Add some readable text before continuing.')
        // Use the document to lay out the page and fill any gaps in the brief.
        reading = description ? {
          ...document,
          kind: description.kind ?? document.kind,
          format: description.format ?? document.format,
          industry: description.industry ?? document.industry,
          goals: description.goals.length ? description.goals : document.goals,
        } : document
        next = { ...next, sections: null }
      }
      setCopyRead(reading)
      setA(skipQuestions ? skipToPages(next, reading ?? description) : next)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Couldn’t prepare the page. Your copy is still here.')
    } finally {
      setHearing(false)
    }
  }
  const setBrief = (patch: Partial<Brief>) => setA((x) => ({ ...x, brief: patchBrief(x.brief, patch) }))
  const pick = (s: ScoredStart) => onDone({ ...input }, starts!, s.id)

  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true })
  }, [])

  // Each new question scrolls into view.
  const asking = useRef<HTMLDivElement>(null)
  useEffect(() => {
    asking.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (copying) asking.current?.focus({ preventScroll: true })
  }, [q])

  const summary: Partial<Record<Question, string>> = {
    what: a.text.trim() || 'Skipped',
    copy: paste ? `${heard?.lines ?? 0} lines added` : 'Skipped',
    confirm: brief.format || brief.industry ? [brief.format && FORMAT_LABEL[brief.format], brief.industry && INDUSTRY_LABEL[brief.industry]].filter(Boolean).join(' · ') : 'Skipped',
    goals: [...(brief.goals ?? []).map((g) => GOAL_LABEL[g]), ...(brief.goalsOther ? [brief.goalsOther] : [])].join(', ') || 'Skipped',
    action: brief.mainAction ?? 'Skipped',
    sections: paste && !a.sections ? 'Your words decide the sections' : cap(sectionWords(sections, 6)),
    look: fixed ? fixed.name : `${skinById(theme)?.name ?? 'A theme'}${brand ? ', your colors' : ''}`,
  }

  const answered = starting || copying ? [] : QUESTIONS.filter((x) => x !== 'drafts' && x !== q && (a.done.includes(x) || skip[x]))
  const wide = q === 'drafts'
  const fullWidth = wide || copying
  const answerRows = answered.map((x) => (
    <Answered key={x} label={LABEL[x]} value={skip[x] && !a.done.includes(x) ? skip[x]! : (summary[x] ?? '')} onChange={() => setA((y) => reopen(y, x))} />
  ))

  return (
    <div data-start-guide className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(880px,100%)] w-full max-w-[1200px] flex-col overflow-hidden rounded-[22px] bg-[#FBF8F9] shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_40px_80px_-32px_rgb(23_18_26/0.45)] outline-none"
        style={{ color: INK }}
        role="dialog"
        aria-modal="true"
        aria-label="New mix"
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/[0.06] bg-white px-4 py-2.5 sm:px-5">
          <h1 className="text-[15.5px] font-semibold">New mix</h1>
          <span className="flex-1" />
          {q !== 'drafts' && (
            <button type="button" disabled={hearing || (copying && (loadingFile || overLimit))} onClick={() => {
              if (starting) void startNext(true)
              else if (copying) void finishCopy(true)
              else setA((x) => skipToPages(x, heard))
            }} className={`btn-quiet flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-45 ${PRESS}`}>
              {copying && hasCopy ? 'Show layouts' : 'Skip, show me pages'} <ArrowRight size={14} />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <div className={`grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] ${fullWidth ? '' : 'lg:grid-cols-[540px_minmax(0,1fr)]'}`}>
          <div className={starting ? 'col-start-1 row-start-1 min-h-0 overflow-y-auto overscroll-contain lg:contents' : 'contents'}>
            <main className="col-start-1 row-start-1 min-w-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
              {wide && answered.length ? (
                <details className="mb-4 rounded-xl border border-zinc-950/[0.06] bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-[#6B5F68]">Site details</summary>
                  <div className="grid gap-2 px-2 pb-2">
                    {answerRows}
                  </div>
                </details>
              ) : answered.length > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  {answerRows}
                </div>
              )}

              <div ref={asking} tabIndex={copying ? -1 : undefined} className={`scroll-mt-6 ${copying ? 'flex min-h-full flex-col outline-none' : answered.length && !wide ? 'mt-5' : ''}`}>
                {starting && (
                  <Ask
                    title="What are you making?"
                    lead="Fill in the blanks to describe your site. You can add website copy in the next step."
                  >
                    <div className="min-w-0">
                      <Sentence segments={segments} picks={picks} onPicks={setPicks} order={order} kind={fill.kind} match={jev ? match : undefined} />
                    </div>
                  </Ask>
                )}

                {copying && (
                  <section aria-labelledby="start-copy-title" className="flex min-w-0 flex-1 flex-col gap-5">
                    <div>
                      <h2 id="start-copy-title" className="text-[22px] font-bold tracking-tight sm:text-[26px]">Add your website copy</h2>
                      <p className="mt-1.5 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Paste what you have or import a document. We’ll lay out your first page with your words and keep extra lines in Content.</p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-950/10 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-950/[0.07] px-4 py-2.5">
                        <label htmlFor="start-copy" className="text-sm font-semibold">Website copy</label>
                        <button type="button" disabled={loadingFile || hearing} onClick={() => upload.current?.click()}
                          className="btn-quiet inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold disabled:opacity-45">
                          <FileUp size={14} /> {loadingFile ? 'Reading file…' : hasCopy ? 'Append file' : 'Import file'}
                        </button>
                        <input ref={upload} type="file" hidden accept=".md,.markdown,.txt,.docx" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
                      </div>
                      <textarea id="start-copy" value={pasted} disabled={loadingFile || hearing}
                        onChange={(e) => { setPasted(e.target.value); setFileNote(''); setCopyError('') }}
                        placeholder="Paste a page, an outline, or your whole document…"
                        aria-describedby="start-copy-note" aria-invalid={overLimit || undefined}
                        className="thin-scroll min-h-[min(34dvh,18rem)] w-full flex-1 resize-none bg-white p-4 text-[15px] leading-relaxed outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF69B4]" />
                      <div id="start-copy-note" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-zinc-950/[0.07] bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600">
                        <span className="min-w-0 [overflow-wrap:anywhere]" role="status">{fileNote || 'Markdown, plain text, or Word (.docx)'}</span>
                        {wordCount > 0 && <span className="whitespace-nowrap tabular-nums">{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span>}
                      </div>
                    </div>
                    {(overLimit || copyError) && <p role="alert" className="text-xs text-problem-ink">{overLimit ? 'Use up to 100,000 characters. You can shorten your paste here.' : copyError}</p>}
                  </section>
                )}

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
                  <Ask title="Pick a look" lead={other ? 'Try a different direction.' : said ? `Themes that feel ${said}.` : 'Choose a theme for your page.'} onNext={() => go('look')}>
                    {!said && (
                      <Chips label="How should it feel?">
                        {FEEL_WORDS.map((w) => {
                          const on = feel.includes(w)
                          return (
                            <Chip key={w} on={on} onClick={() => (setSkin(null), setOther(false), setA((x) => ({ ...x, feel: on ? feel.filter((y) => y !== w) : [...feel, w as FeelWord] })))}>
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

                {q === 'drafts' && (
                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Three ways to lay it out</h2>
                        <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Open the one you like. You can try another direction any time.</p>
                      </div>
                      <button type="button" onClick={() => setSeed((n) => n + 1)} disabled={!starts || paste} className={QUIET}>
                        <Shuffle size={15} /> Shuffle
                      </button>
                    </div>
                    {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
                    <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                      {starts
                        ? starts.map((s, i) => (
                            <StartCard key={s.id} copyLines={paste ? heard?.lines : undefined} start={s} letter={String.fromCharCode(65 + i)} best={i === 0 && starts.some((o) => o.score.score < s.score.score)} sections={new Set(starts.map((x) => firstPage(x).join())).size > 1} busy={busy} onPick={() => pick(s)} />
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
            {!fullWidth && (
              <aside className={`min-w-0 border-zinc-950/[0.06] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:overflow-y-auto lg:border-l lg:p-6 ${starting ? 'mx-5 mb-5 rounded-2xl border p-4 sm:mx-7 sm:p-5 lg:m-0 lg:rounded-none lg:border-0 lg:border-l' : 'hidden'}`} style={{ backgroundImage: 'radial-gradient(#E4D9DF 1.1px, transparent 1.2px)', backgroundSize: '22px 22px' }}>
                {preview ? (
                  <>
                    <div className="group sticky top-0 overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.35)]">
                      <SkinPreview site={preview.site} guide={preview.guide} content={preview.content} title="Theme preview" height={620} peek />
                    </div>
                    <p className="mt-3 text-center text-[12.5px] text-[#6B5F68]">Theme preview. Hover to see more.</p>
                  </>
                ) : (
                  <StartOutline
                    name={va.name.trim()}
                    action={va.brief.mainAction}
                    sections={a.sections && (q === 'sections' || !picks.show?.length)
                      ? a.sections.filter((type) => !FIXED.includes(type)).map((type) => TYPE_LABEL[type])
                      : (picks.show ?? []).map((pick) => pick.words.trim()).filter(Boolean)}
                  />
                )}
                {hearing && <p role="status" className="mt-3 text-center text-[12.5px] text-[#6B5F68]">Reading what you wrote…</p>}
              </aside>
            )}
          </div>

          {starting && (
            <StartFrom
              busy={hearing}
              onNext={() => void startNext()}
              guides={guides}
              fixed={fixed}
              onBlank={() => onBlank(name)}
              onStarter={onStarter && ((s) => onStarter(s, name))}
              onImport={onImport}
              onGuide={(g) => (setFixed(g), setA((x) => ({ ...x, fixedGuide: !!g })))}
            />
          )}

          {copying && (
            <footer className="col-start-1 row-start-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-950/[0.06] bg-[#FBF8F9] px-5 py-3 sm:px-7 sm:py-4">
              <button type="button" disabled={loadingFile || hearing} onClick={() => setA((current) => reopen(current, 'what'))} className={`${QUIET} px-2 disabled:opacity-45`}>
                <ArrowLeft size={16} /> Back
              </button>
              <span role="status" className="sr-only">{hearing ? 'Reading your copy…' : ''}</span>
              <button type="button" disabled={loadingFile || hearing || overLimit} onClick={() => void finishCopy()} className={PRIMARY}>
                {hearing ? 'Reading your copy…' : hasCopy ? 'Use this copy' : 'Continue without copy'}
                {!hearing && <ArrowRight size={16} />}
              </button>
            </footer>
          )}
        </div>
      </div>
    </div>
  )
}

const LABEL: Record<Question, string> = {
  what: 'Site description',
  copy: 'Website copy',
  confirm: 'Kind of site',
  goals: 'It should',
  action: 'Main button',
  sections: 'On the page',
  look: 'Design',
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
  if (onImport) sources.push({ v: 'file', label: 'A mix file' })

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
                {guides?.length === 0 && <p className="px-1 py-2 text-[13px] text-[#6B5F68]">No saved style guides yet. Save one from a mix’s Style guide.</p>}
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

