import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Coffee, Feather, FileText, Laptop, Moon, MoveHorizontal, Palette, Shuffle, Smartphone, Sun, User, X, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import type { Kind } from '@/core/types'
import { KINDS } from '@/core/types'
import { guideFor, KIND_LABEL, type StartInput } from '@/core/start'
import { skinList, skinOpen, WIREFRAME, type Skin } from '@/core/skins'
import { resolveGuide } from '@/core/guide'
import type { PageScore } from '@/core/score'
import { library } from '@/data/library'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { scoredStarts, scoreStart, type ScoredStart } from '@/lib/start'
import { SkinPreview } from '@/ui/skins/SkinPreview'

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

type Step = 'what' | 'starts' | 'skin'

/**
 * The guided start: what you're making, three raw starts to pick a structure from, then
 * that page under the skins, to pick a look. No design words; the starts are measured
 * before you see them, so each says plainly how its first screen holds up on a laptop
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
  const [step, setStep] = useState<Step>('what')
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

  // The starts themselves are always raw; the skin goes on at the last step.
  const input: StartInput | null = kind ? { kind, name: name.trim() || 'Your site', oneLiner, seed } : null
  const pick = starts?.find((s) => s.id === picked) ?? null
  useSkinFonts()

  // Lay the three starts out whenever the answers change on the last step.
  const key = JSON.stringify(input)
  useEffect(() => {
    if (step !== 'starts' || !input) return
    let live = true
    setStarts(null)
    setProblem(null)
    scoredStarts(input)
      .then((s) => live && setStarts(s))
      .catch((e) => live && setProblem(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, key])

  // Each step starts at the top.
  const scroller = useRef<HTMLElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [step])

  /** Every start under the skin you picked, so A, B and C stay comparable as versions. */
  const finish = () => {
    if (!input || !starts || !pick) return
    const guide = guideFor({ skin, brand, mode })
    onDone({ ...input, skin, brand, mode }, starts.map((s) => ({ ...s, guide })), pick.id)
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
              {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
              <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
                {starts
                  ? starts.map((s, i) => <StartCard key={s.id} start={s} letter={String.fromCharCode(65 + i)} best={i === 0} busy={busy} onPick={() => { setPicked(s.id); setStep('skin') }} />)
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
              name={name.trim() || 'Your site'}
              skin={skin}
              brand={brand}
              mode={mode}
              onSkin={(id) => { setSkin(id); setMode(undefined) }}
              onBrand={setBrand}
              onMode={setMode}
            />
          )}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-950/[0.06] bg-white px-4 py-3 sm:px-5">
          {step === 'what' ? (
            <span />
          ) : (
            <button type="button" onClick={() => setStep(step === 'skin' ? 'starts' : 'what')} className={QUIET}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step === 'what' && (
            <button type="button" disabled={!kind || !name.trim()} onClick={() => setStep('starts')} className={PRIMARY}>
              Show me three structures <ArrowRight size={16} />
            </button>
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
    ['skin', 'Skin'],
  ]
  const at = all.findIndex(([s]) => s === step)
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
function SkinStep({ start, name, skin, brand, mode, onSkin, onBrand, onMode }: {
  start: ScoredStart
  name: string
  skin: string
  brand: string | null
  mode: 'light' | 'dark' | undefined
  onSkin: (id: string) => void
  onBrand: (brand: string | null) => void
  onMode: (mode: 'light' | 'dark') => void
}) {
  const skins = skinList().filter((x) => skinOpen(library, x))
  const current = skins.find((x) => x.id === skin) ?? skins[0]
  const shownMode = mode ?? current?.mode ?? 'light'
  // Fonts move things around, so the skin you pick gets measured too.
  const [score, setScore] = useState<PageScore | null>(null)
  useEffect(() => {
    let live = true
    setScore(null)
    scoreStart({ ...start, guide: guideFor({ skin, brand, mode }) }).then((s) => live && setScore(s))
    return () => {
      live = false
    }
  }, [start, skin, brand, mode])
  return (
    <section>
      <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Pick a skin</h1>
      <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">The same page for {name}, in different clothes. Pick by eye; you can swap it, or tweak any of it, at any time.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
          <input type="color" value={brand ?? current?.tokens['color.primary'] ?? '#404040'} onChange={(e) => onBrand(e.target.value)} className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Brand color" />
          {brand ? 'Your brand color' : 'Have a brand color? Pick it'}
        </label>
        {brand && (
          <button type="button" onClick={() => onBrand(null)} className={QUIET}>
            Use the skin’s own
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
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skins.map((x) => (
          <SkinCard key={x.id} skin={x} on={x.id === skin} start={start} brand={brand} mode={x.id === skin ? mode : undefined} onPick={() => onSkin(x.id)} />
        ))}
      </div>
      <p className="mt-5 min-h-5 text-[13.5px] text-[#6B5F68]" aria-live="polite">
        {score ? (score.checks.filter((c) => !c.ok).map((c) => c.words).join(' ') || 'Its first screen holds up on a laptop and a phone.') : 'Measuring this skin on a laptop and a phone…'}
      </p>
    </section>
  )
}

/** A skin, drawn as your actual page in it. */
function SkinCard({ skin, on, start, brand, mode, onPick }: { skin: Skin; on: boolean; start: ScoredStart; brand: string | null; mode: 'light' | 'dark' | undefined; onPick: () => void }) {
  const guide = useMemo(() => guideFor({ skin: skin.id, brand, mode }), [skin.id, brand, mode])
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={`${CARD} overflow-hidden ${on ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
      <span className="block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={guide} content={start.content} title={skin.name} height={190} />
      </span>
      <span className="block p-4">
        <span className="flex items-center justify-between gap-2 text-[16px] font-semibold" style={{ fontFamily: guide.base['font.display'] }}>
          {skin.name}
          {on && <Check size={16} style={{ color: PINK }} />}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-[#6B5F68]">{skin.words}</span>
      </span>
    </button>
  )
}

/** The checks a card draws as chips, by what they measure. */
const CHIPS: { id: string; icon: LucideIcon; name: string }[] = [
  { id: 'first-laptop', icon: Laptop, name: 'Laptop' },
  { id: 'first-phone', icon: Smartphone, name: 'Phone' },
  { id: 'no-spill', icon: MoveHorizontal, name: 'Widths' },
]

/** One start: its page on a laptop (hover pans down it), where it came from, and how it measured up. The card is the pick. */
function StartCard({ start, letter, best, busy, onPick }: { start: ScoredStart; letter: string; best: boolean; busy?: boolean; onPick: () => void }) {
  const { checks, phoneScreens, score } = start.score
  const byId = new Map(checks.map((c) => [c.id, c]))
  const misses = checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight)
  const name = start.from === 'starter' ? start.label.replace(/^Starter: /, '') : start.label
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-label={`Dress start ${letter}: ${name}, ${score} out of 100`}
      className={`group flex flex-col overflow-hidden rounded-[16px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_18px_36px_-26px_rgb(23_18_26/0.35)] ${PRESS} disabled:pointer-events-none disabled:opacity-60 ${HOVER}shadow-[0_0_0_2px_#FF69B4,0_18px_36px_-22px_rgb(255_105_180/0.55)]`}
    >
      <span className="relative block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={start.guide} content={start.content} title={`Start ${letter}`} height={196} peek />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        {best && <span className="absolute bottom-2 left-3 rounded-full bg-[#FF69B4] px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_2px_6px_-2px_rgb(194_40_111/0.6)]">Holds up best</span>}
      </span>
      <span className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3.5 pt-3">
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9A8E97]">
              <span className="grid size-[18px] place-items-center rounded-full bg-[#17121A] text-[10px] tracking-normal text-white">{letter}</span>
              {start.from === 'starter' ? 'Starter' : 'Put together for you'}
            </span>
            <span className="mt-1 block truncate text-[14.5px] font-semibold leading-tight">{name}</span>
          </span>
          <Score value={score} />
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {CHIPS.map(({ id, icon: Icon, name: label }) => {
            const c = byId.get(id)
            if (!c) return null
            return (
              <span key={id} title={c.words} className={`inline-flex h-[22px] items-center gap-1 rounded-full px-1.5 text-[11px] font-medium ${c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                <Icon size={12} strokeWidth={2.2} aria-hidden />
                {label}
                <span className="sr-only">: {c.words}</span>
                {!c.ok && <span aria-hidden>!</span>}
              </span>
            )
          })}
        </span>
        {misses.length > 0 && <span className="line-clamp-2 text-[12px] leading-snug text-[#6B5F68] [text-wrap:pretty]">{misses[0].words}</span>}
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-950/[0.06] pt-2.5">
          <span className="text-[11.5px] text-[#9A8E97]">{phoneScreens !== null && `${Math.max(1, Math.round(phoneScreens))} screens on a phone`}</span>
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#17121A] opacity-75 transition-opacity duration-150 group-hover:opacity-100">
            Dress {letter} <ArrowRight size={14} className="transition-[translate] duration-150 ease-out group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </button>
  )
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


