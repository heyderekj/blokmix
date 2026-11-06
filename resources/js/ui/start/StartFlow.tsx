import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Coffee, Feather, FileText, Moon, Palette, Shuffle, Smartphone, Sun, User, X, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import type { Kind, SectionType } from '@/core/types'
import { KINDS } from '@/core/types'
import { guideFor, KIND_LABEL, RECIPES, type StartInput } from '@/core/start'
import { FEEL_WORDS, KIND_FEEL, themesFor, type FeelWord } from '@/core/feel'
import { skinList, skinOpen, WIREFRAME, type Skin } from '@/core/skins'
import { resolveGuide } from '@/core/guide'
import type { PageScore } from '@/core/score'
import { library } from '@/data/library'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { scoredStarts, scoreStart, type ScoredStart } from '@/lib/start'
import { startsFromText } from '@/lib/startFromText'
import type { Palette as Colors } from '@/core/palette'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { boxChoice, emptyBox, StartBox, type BoxState } from './StartBox'
import { FeelColors } from './FeelColors'

/** Whether the guided start is showing over the board (the browser-only mix opens on it the first time). */
export const useStartFlow = create<{ open: boolean }>()(() => ({ open: false }))

const INK = '#17121A'
const PINK = '#FF69B4'
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
const CARD = `rounded-[18px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08)] ${PRESS}`
const ON = 'shadow-[0_0_0_2px_#FF69B4,0_16px_32px_-20px_rgb(255_105_180/0.6)]'
// The app's lit pink button, the step's one main action.
const PRIMARY = `btn-lit flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold disabled:pointer-events-none disabled:opacity-45 ${PRESS}`
const QUIET = `flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`

type Step = 'box' | 'what' | 'starts' | 'skin'

/**
 * The guided start: one box (a sentence about the site, or the words you already have), three raw starts to pick a
 * structure from, then that page under the skins, to pick a look. Three questions stand in when Jev is off. No design
 * words; the starts are measured before you see them, so each says plainly how its first screen holds up on a laptop
 * and a phone, and the skin you pick is measured again since its fonts move things.
 */
export function StartFlow({ onDone, onBlank, onClose, busy }: {
  /** The answers, every start (best first), and the one picked. */
  onDone: (input: StartInput, starts: ScoredStart[], chosen: string) => void
  onBlank: () => void
  onClose?: () => void
  /** Saving the new mix (hosted): the buttons wait. */
  busy?: boolean
}) {
  const [step, setStep] = useState<Step>('box')
  // Which way you came: the box, or the three questions.
  const [via, setVia] = useState<'box' | 'what'>('box')
  const [box, setBox] = useState<BoxState>(emptyBox)
  const [jevOff, setJevOff] = useState(false)
  const [palette, setPalette] = useState<Colors | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [name, setName] = useState('')
  const [oneLiner, setOneLiner] = useState('')
  const [skin, setSkin] = useState(WIREFRAME)
  const [mode, setMode] = useState<'light' | 'dark' | undefined>(undefined)
  const [picked, setPicked] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [seed, setSeed] = useState(0)
  const [starts, setStarts] = useState<ScoredStart[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // Pressed Next before naming it or picking a kind: say which.
  const [missing, setMissing] = useState(false)

  // The starts themselves are always raw; the skin goes on at the last step.
  const fromBox = boxChoice(box)
  const input: StartInput | null =
    via === 'box'
      ? fromBox.kind && box.heard
        ? { kind: fromBox.kind, name: box.name.trim() || 'Your site', seed, ...(fromBox.sections ? { sections: fromBox.sections } : {}), ...(box.button && !box.text.trim() ? { button: box.button } : {}) }
        : null
      : kind
        ? { kind, name: name.trim() || 'Your site', oneLiner, seed }
        : null
  const siteName = (via === 'box' ? box.name : name).trim() || 'Your site'
  const looks = via === 'box' ? (box.heard?.looks ?? []) : []
  const pick = starts?.find((s) => s.id === picked) ?? null
  // When all three hold the same sections, say so once instead of three times.
  const sameSections = !!starts && new Set(starts.map((x) => sectionWords(firstPage(x)))).size === 1
  useSkinFonts()

  // Lay the three starts out whenever the answers change on the last step.
  const key = JSON.stringify(input)
  useEffect(() => {
    if (step !== 'starts' || !input) return
    let live = true
    setStarts(null)
    setProblem(null)
    ;(via === 'box' && box.heard ? startsFromText(input, box.heard) : scoredStarts(input))
      .then((s) => live && setStarts(s))
      .catch((e) => live && setProblem(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, key, via])

  // Each step starts at the top.
  const scroller = useRef<HTMLElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [step])

  /** Every start under the skin you picked, so A, B and C stay comparable as versions. */
  const finish = () => {
    if (!input || !starts || !pick) return
    const guide = guideFor({ skin, brand, mode, palette })
    onDone({ ...input, skin, brand, mode, palette }, starts.map((s) => ({ ...s, guide })), pick.id)
  }

  return (
    // An expanded modal over the mixes page, like New mix but roomier: the three steps scroll inside it.
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17121A]/30 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(860px,100%)] w-full max-w-[1040px] flex-col overflow-hidden rounded-[22px] bg-[#FBF8F9] shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_40px_80px_-32px_rgb(23_18_26/0.45)]"
        style={{ color: INK }}
        role="dialog"
        aria-modal="true"
        aria-label="Start a new mix"
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/[0.06] bg-white px-4 py-2.5 sm:px-5">
          <Steps step={step} />
          <span className="flex-1" />
          <button type="button" onClick={onBlank} disabled={busy} className={`btn-quiet flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${PRESS}`}>
            <FileText size={14} /> Start blank
          </button>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <main
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7"
        style={{ backgroundImage: 'radial-gradient(#E4D9DF 1.1px, transparent 1.2px)', backgroundSize: '22px 22px' }}
      >
          {step === 'box' && (
            <StartBox
              box={box}
              onBox={setBox}
              onJevOff={setJevOff}
            />
          )}

          {step === 'what' && (
          <section>
            <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">What are you making?</h1>
            <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Name it, then pick the closest kind. It decides which sections your page starts with; you can change any of them later.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="What’s it called?" value={name} onChange={setName} placeholder="Fern & Co" />
              <Field label="In one line, what is it?" hint="Becomes your headline. Leave it empty for a placeholder." value={oneLiner} onChange={setOneLiner} placeholder="Slow coffee and good bread on Elm Street" />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`${CARD} flex flex-col gap-3 p-4 ${kind === k ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
                  <span className="flex items-center justify-between">
                    <KindTile icon={KIND_ICON[k]} on={kind === k} />
                    {kind === k && <Check size={16} style={{ color: PINK }} />}
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{KIND_LABEL[k].name}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-[#6B5F68]">{KIND_LABEL[k].words}</span>
                    <span className="mt-2 block text-[12px] leading-snug text-[#9A8E97]">Starts with {sectionWords(RECIPES[k].home, 4)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

          {step === 'starts' && input && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Pick a structure</h1>
                  <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Three raw layouts, plain on purpose: decide what goes where first, and the look comes next. Each is laid out on a laptop and a phone before you see it.</p>
                </div>
                <button type="button" onClick={() => setSeed((n) => n + 1)} disabled={!starts} className={QUIET}>
                  <Shuffle size={15} /> Shuffle
                </button>
              </div>
              {starts && sameSections && <p className="mt-3 text-[13.5px] text-[#6B5F68] [text-wrap:pretty]">Each has {sectionWords(firstPage(starts[0]))}, laid out its own way.</p>}
              {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
              <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
                {starts
                  ? starts.map((s, i) => (
                      <StartCard
                        key={s.id}
                        start={s}
                        letter={String.fromCharCode(65 + i)}
                        best={i === 0 && starts.some((o) => o.score.score < s.score.score)}
                        sections={!sameSections}
                        busy={busy}
                        onPick={() => {
                          setPicked(s.id)
                          // A real look goes on first (Jev's, else the best fit for this kind), not the grey sketch.
                          if (skin === WIREFRAME) setSkin(firstTheme(looks, input.kind))
                          setStep('skin')
                        }}
                      />
                    ))
                  : [0, 1, 2].map((i) => (
                      <div key={i} className="grid h-[330px] place-items-center rounded-[16px] bg-white/70 text-[13.5px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)] motion-safe:animate-pulse">
                        {i === 1 ? 'Laying out three starts…' : ''}
                      </div>
                    ))}
              </div>
            </section>
          )}

          {step === 'skin' && pick && (
            <SkinStep
              start={pick}
              name={siteName}
              skin={skin}
              brand={brand}
              palette={palette}
              mode={mode}
              looks={looks}
              feel={via !== 'box' ? '' : box.text.trim() ? (box.heard?.mode === 'describe' ? box.text.trim() : '') : (box.feel ?? '')}
              kind={input?.kind ?? null}
              jev={!jevOff}
              onSkin={(id) => { setSkin(id); setMode(undefined) }}
              onBrand={(b) => { setBrand(b); setPalette(null) }}
              onPalette={(p, b) => { setPalette(p); setBrand(b) }}
              onMode={(m) => { setMode(m); setPalette(null) }}
            />
          )}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-950/[0.06] bg-white px-4 py-3 sm:px-5">
          {step === 'box' ? (
            <button type="button" onClick={() => setStep('what')} className={QUIET}>
              Answer three questions instead
            </button>
          ) : (
            <button type="button" onClick={() => setStep(step === 'skin' ? 'starts' : step === 'starts' ? via : 'box')} className={QUIET}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step === 'box' && (
            <button type="button" disabled={!input} onClick={() => (setVia('box'), setPicked(null), setStep('starts'))} className={PRIMARY}>
              Show me three starts <ArrowRight size={16} />
            </button>
          )}
          {step === 'what' && (
            <span className="flex items-center gap-3">
              {missing && <span className="text-[13px] text-[#6B5F68] max-sm:hidden" aria-live="polite">{!name.trim() ? 'Give it a name first' : 'Pick the closest kind first'}</span>}
              <button type="button" onClick={() => (!kind || !name.trim() ? setMissing(true) : (setVia('what'), setPicked(null), setStep('starts')))} className={PRIMARY}>
                Show me three structures <ArrowRight size={16} />
              </button>
            </span>
          )}
          {step === 'skin' && (
            <button type="button" disabled={busy} onClick={finish} className={PRIMARY}>
              Start with {skinList().find((x) => x.id === skin)?.name ?? 'this'} <ArrowRight size={16} />
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Steps({ step }: { step: Step }) {
  const all: [Step, string][] = [
    ['what', 'What'],
    ['starts', 'Structure'],
    ['skin', 'Theme'],
  ]
  const at = step === 'box' ? 0 : all.findIndex(([s]) => s === step)
  return (
    <ol className="flex items-center gap-2 text-[12.5px] font-semibold" aria-label="Steps">
      {all.map(([s, label], i) => (
        <li key={s} className="flex items-center gap-2" aria-current={s === step ? 'step' : undefined}>
          <span className={`grid size-6 place-items-center rounded-full text-[11.5px] ${i <= at ? 'bg-[#17121A] text-white' : 'bg-white text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.1)]'}`}>{i + 1}</span>
          <span className={`max-sm:hidden ${i === at ? 'text-[#17121A]' : 'text-[#6B5F68]'}`}>{label}</span>
          {i < all.length - 1 && <span className="h-px w-5 bg-[#DDD2D9]" />}
        </li>
      ))}
    </ol>
  )
}

function Field({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="grid content-start gap-1.5">
      <span className="text-[14px] font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={160}
        className="h-12 rounded-xl bg-white px-4 text-[15px] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_2px_#FF69B4]"
      />
      {hint && <span className="text-[12.5px] text-[#6B5F68]">{hint}</span>}
    </label>
  )
}

/** The last step: the page you picked under each skin this plan opens, your brand color on top if you have one. */
function SkinStep({ start, name, skin, brand, palette, mode, looks, feel, kind, jev, onSkin, onBrand, onPalette, onMode }: {
  start: ScoredStart
  name: string
  skin: string
  brand: string | null
  palette: Colors | null
  mode: 'light' | 'dark' | undefined
  /** Jev's picks for the look, best first: shown first and marked. */
  looks: string[]
  /** The sentence you described the site in, to start colors by feel from. */
  feel: string
  kind: Kind | null
  jev: boolean
  onSkin: (id: string) => void
  onBrand: (brand: string | null) => void
  onPalette: (palette: Colors, brand: string) => void
  onMode: (mode: 'light' | 'dark') => void
}) {
  const open = skinList().filter((x) => skinOpen(library, x))
  const skins = [...looks.flatMap((id) => open.filter((x) => x.id === id)), ...open.filter((x) => !looks.includes(x.id))]
  const current = skins.find((x) => x.id === skin) ?? skins[0]
  // How it should feel, in the Look panel's words: Jev's picks first, then the three themes that fit best.
  const [words, setWords] = useState<FeelWord[]>(() => (kind ? KIND_FEEL[kind] : []))
  const fits = [...new Set([...looks.filter((id) => open.some((x) => x.id === id)), ...themesFor(words, open, { count: 3 }).map((x) => x.id)])].slice(0, 3)
  const rest = skins.filter((x) => !fits.includes(x.id))
  const [all, setAll] = useState(false)
  const showAll = all || !fits.includes(skin)
  const shownMode = mode ?? current?.mode ?? 'light'
  // Fonts move things around, so the skin you pick gets measured too.
  const [score, setScore] = useState<PageScore | null>(null)
  useEffect(() => {
    let live = true
    setScore(null)
    scoreStart({ ...start, guide: guideFor({ skin, brand, mode, palette }) }).then((s) => live && setScore(s))
    return () => {
      live = false
    }
  }, [start, skin, brand, mode, palette])
  return (
    <section>
      <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Pick a theme</h1>
      <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">The same page for {name}, in a few different looks. Pick by eye; you can change it, or any part of it, any time.</p>
      <div className="mt-5 grid gap-2">
        <span className="text-[14px] font-semibold">How should it feel?</span>
        <div className="flex flex-wrap gap-1.5">
          {FEEL_WORDS.map((w) => {
            const on = words.includes(w)
            return (
              <button key={w} type="button" aria-pressed={on} onClick={() => setWords((ws) => (on ? ws.filter((x) => x !== w) : [...ws, w]))} className={`h-9 rounded-full px-3.5 text-[13px] font-semibold capitalize ${PRESS} ${on ? 'bg-[#17121A] text-white' : `bg-white text-[#3F363D] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] ${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.22)]`}`}>
                {w}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
          <input type="color" value={brand ?? current?.tokens['color.primary'] ?? '#404040'} onChange={(e) => onBrand(e.target.value)} className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Brand color" />
          {palette ? 'Colors you found' : brand ? 'Your brand color' : 'Have a brand color? Pick it'}
        </label>
        {(brand || palette) && (
          <button type="button" onClick={() => onBrand(null)} className={QUIET}>
            Use the theme’s own
          </button>
        )}
        <div className="flex rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]" role="radiogroup" aria-label="Light or dark">
          {(['light', 'dark'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={shownMode === m} onClick={() => onMode(m)} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium capitalize ${PRESS} ${shownMode === m ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
              {m === 'light' ? <Sun size={14} /> : <Moon size={14} />} {m}
            </button>
          ))}
        </div>
      </div>
      {jev && <FeelColors feel={feel} site={kind ? `${name}, ${KIND_LABEL[kind].name.toLowerCase()}` : name} mode={mode} picked={palette} onPick={onPalette} />}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fits.map((id) => skins.find((x) => x.id === id)).filter((x): x is Skin => !!x).map((x) => (
          <SkinCard key={x.id} skin={x} on={x.id === skin} start={start} brand={brand} palette={x.id === skin ? palette : null} mode={x.id === skin ? mode : undefined} jevPick={looks.includes(x.id)} onPick={() => onSkin(x.id)} />
        ))}
      </div>
      {rest.length > 0 && fits.includes(skin) && (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={showAll} className={`mt-4 ${QUIET} -ml-4`}>
          <ChevronDown size={16} className={`transition-[rotate] duration-200 ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Fewer themes' : `See all ${skins.length} themes`}
        </button>
      )}
      {showAll && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((x) => (
            <SkinCard key={x.id} skin={x} on={x.id === skin} start={start} brand={brand} palette={x.id === skin ? palette : null} mode={x.id === skin ? mode : undefined} jevPick={looks.includes(x.id)} onPick={() => onSkin(x.id)} />
          ))}
        </div>
      )}
      <p className="mt-5 min-h-5 text-[13.5px] text-[#6B5F68]" aria-live="polite">
        {score ? (score.checks.filter((c) => !c.ok).map((c) => c.words).join(' ') || 'Its first screen holds up on a laptop and a phone.') : 'Measuring this theme on a laptop and a phone…'}
      </p>
    </section>
  )
}

/** A skin, drawn as your actual page in it. */
function SkinCard({ skin, on, start, brand, palette, mode, jevPick, onPick }: { skin: Skin; on: boolean; start: ScoredStart; brand: string | null; palette: Colors | null; mode: 'light' | 'dark' | undefined; jevPick: boolean; onPick: () => void }) {
  const guide = useMemo(() => guideFor({ skin: skin.id, brand, mode, palette }), [skin.id, brand, mode, palette])
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={`${CARD} overflow-hidden ${on ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
      <span className="block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={guide} content={start.content} title={skin.name} height={190} />
      </span>
      <span className="block p-4">
        <span className="flex items-center justify-between gap-2 text-[16px] font-semibold" style={{ fontFamily: guide.base['font.display'] }}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{skin.name}</span>
            {jevPick && <span className="shrink-0 rounded-full bg-[#FFE4F2] px-2 py-0.5 font-sans text-[10.5px] font-semibold text-[#B0186A]">Suggested</span>}
          </span>
          {on && <Check size={16} style={{ color: PINK }} />}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-[#6B5F68]">{skin.words}</span>
      </span>
    </button>
  )
}

/** One start: its page on a laptop (hover pans down it), what's in it, and only what needs a look. The card is the pick. */
function StartCard({ start, letter, best, busy, sections, onPick }: { start: ScoredStart; letter: string; best: boolean; busy?: boolean; sections: boolean; onPick: () => void }) {
  const { checks, phoneScreens, score } = start.score
  const misses = checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight)
  const name = start.from === 'starter' ? start.label.replace(/^Starter: /, '') : start.label
  const types = firstPage(start)
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-label={`Use start ${letter}: ${name}${misses.length ? `. ${misses[0].words}` : ''}`}
      className={`group flex flex-col overflow-hidden rounded-[16px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_18px_36px_-26px_rgb(23_18_26/0.35)] ${PRESS} disabled:pointer-events-none disabled:opacity-60 ${HOVER}shadow-[0_0_0_2px_#FF69B4,0_18px_36px_-22px_rgb(255_105_180/0.55)]`}
    >
      <span className="relative block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={start.guide} content={start.content} title={`Start ${letter}`} height={196} peek />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        {best && <span className="absolute bottom-2 left-3 rounded-full bg-[#FF69B4] px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_2px_6px_-2px_rgb(194_40_111/0.6)]">Holds up best</span>}
      </span>
      <span className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <span className="flex items-center gap-2">
          <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-[#17121A] text-[10.5px] font-semibold text-white">{letter}</span>
          <span className="min-w-0 truncate text-[14.5px] font-semibold leading-tight">{name}</span>
          {misses.length > 0 && <Score value={score} />}
        </span>
        {sections && <span className="text-[12.5px] leading-snug text-[#6B5F68] [text-wrap:pretty]">{sectionWords(types).replace(/^./, (c) => c.toUpperCase())}</span>}
        {misses.length > 0 && <span className="line-clamp-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[12px] leading-snug text-amber-900 [text-wrap:pretty]">{misses[0].words}</span>}
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-950/[0.06] pt-2.5">
          <span className="text-[11.5px] text-[#9A8E97]">{phoneScreens !== null && `${Math.max(1, Math.round(phoneScreens))} screens on a phone`}</span>
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#17121A] opacity-75 transition-opacity duration-150 group-hover:opacity-100">
            Use {letter} <ArrowRight size={14} className="transition-[translate] duration-150 ease-out group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </button>
  )
}

/** A page's sections in plain words, nav and footer left out: "a big opener, what you offer, questions". */
const SECTION_WORDS: Record<SectionType, string> = {
  nav: 'a menu',
  header: 'a page title',
  hero: 'a big opener',
  logos: 'who uses it',
  features: 'what you offer',
  stats: 'numbers',
  content: 'your story',
  gallery: 'pictures',
  team: 'the team',
  testimonials: 'what people say',
  blog: 'posts',
  faq: 'questions',
  contact: 'how to reach you',
  cta: 'a last nudge',
  pricing: 'prices',
  footer: 'a footer',
}
function sectionWords(types: SectionType[], max = 5): string {
  const all = [...new Set(types.filter((t) => t !== 'nav' && t !== 'footer').map((t) => SECTION_WORDS[t]))]
  const said = all.length > max ? [...all.slice(0, max - 1), 'more'] : all
  return said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}` : (said[0] ?? 'a blank page')
}

const firstPage = (start: ScoredStart): SectionType[] => (start.site.pages[0]?.slots ?? []).map((x) => x.type)

/** The look a new start opens in: Jev's pick, else the theme that fits this kind best, never the grey sketch. */
function firstTheme(looks: string[], kind: Kind): string {
  const open = skinList().filter((x) => skinOpen(library, x))
  return looks.find((id) => open.some((x) => x.id === id)) ?? themesFor(KIND_FEEL[kind], open, { count: 1 })[0]?.id ?? WIREFRAME
}

function Score({ value }: { value: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-9 shrink-0 place-items-center" title={`${value} out of 100`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#F1E9EE" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="4" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-[11px] font-bold tabular-nums">{value}</span>
    </span>
  )
}

/** Every skin's fonts, so the cards draw in them. */
function useSkinFonts() {
  useEffect(() => {
    const hrefs = new Set(skinList().flatMap((v) => fontHrefs(fontsForTokens(resolveGuide(guideFor({ skin: v.id })).tokens, []))))
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])
}

/** A kind's icon in a slot carved into the paper; picked, it lifts out as the pink block, tilted, the icon in white. */
export function KindTile({ icon: Icon, on }: { icon: LucideIcon; on: boolean }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <span className="absolute inset-0 rounded-[30%] bg-zinc-100 shadow-[inset_0_2px_4px_rgb(0_0_0/0.1),inset_0_0_0_1px_rgb(0_0_0/0.05)]" />
      <span
        className={`absolute inset-0 grid place-items-center rounded-[30%] bg-[#FF5CB0] text-white shadow-[0_3px_0_#C2185B,0_8px_14px_-6px_rgb(194_24_91/0.6),inset_0_2px_0_rgb(255_255_255/0.35)] transition-[opacity,transform] duration-200 ease-out ${on ? '-translate-y-1 rotate-[-8deg] opacity-100' : 'translate-y-0 rotate-0 opacity-0'}`}
      >
        <Icon size={17} strokeWidth={2.2} />
      </span>
      {!on && <Icon size={17} className="relative text-zinc-500" />}
    </span>
  )
}

const KIND_ICON: Record<Kind, LucideIcon> = { product: Smartphone, studio: Palette, local: Coffee, event: CalendarDays, personal: User, writing: Feather }


