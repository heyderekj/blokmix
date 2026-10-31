import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Coffee, Feather, Moon, Palette, Shuffle, Smartphone, Sun, User, X, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import type { Kind } from '@/core/types'
import { KINDS } from '@/core/types'
import { guideFor, KIND_LABEL, RECIPES, type StartInput } from '@/core/start'
import { KIND_WORDS } from '@/core/startWords'
import { TYPE_LABEL } from '@/core/content'
import { VIBES, vibeById } from '@/core/vibes'
import { resolveGuide } from '@/core/guide'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { previewHtml } from '@/lib/measure'
import { MixThumb } from '@/ui/mixes/MixThumb'

/** Whether the guided start is showing over the board (the browser-only mix opens on it the first time). */
export const useStartFlow = create<{ open: boolean }>()(() => ({ open: false }))

const INK = '#17121A'
const PINK = '#FF69B4'
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
const CARD = `rounded-[18px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08)] ${PRESS}`
const ON = 'shadow-[0_0_0_2px_#FF69B4,0_16px_32px_-20px_rgb(255_105_180/0.6)]'
const PRIMARY = `flex h-11 items-center gap-2 rounded-full bg-[#17121A] px-5 text-[14px] font-semibold text-white disabled:cursor-default disabled:opacity-40 ${PRESS}`
const QUIET = `flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`

type Step = 'what' | 'feel' | 'starts'

/**
 * The guided start: what you're making, a feel, and three real starts to pick
 * from. No design words; the starts are measured before you see them, so each
 * says plainly how its first screen holds up on a laptop and a phone.
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
  const [vibe, setVibe] = useState('calm')
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const [brand, setBrand] = useState<string | null>(null)
  const [seed, setSeed] = useState(0)
  const [starts, setStarts] = useState<ScoredStart[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const input: StartInput | null = kind ? { kind, name: name.trim() || 'Your site', oneLiner, vibe, brand, mode, seed } : null
  useVibeFonts()

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

  const pickVibe = (id: string) => {
    setVibe(id)
    setMode(vibeById(id).mode)
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
          <button type="button" onClick={onBlank} disabled={busy} className={QUIET}>
            Start blank
          </button>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className={`grid size-11 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={18} />
            </button>
          )}
        </header>

        <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {step === 'what' && (
          <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">What are you making?</h1>
              <p className="mt-2 max-w-md text-[15px] text-[#6B5F68] [text-wrap:pretty]">Pick the closest. It decides which sections your page starts with; you can change any of them later.</p>
              <div className="mt-5 grid gap-2">
                {KINDS.map((k) => {
                  const Icon = KIND_ICON[k]
                  return (
                    <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`${CARD} flex items-center gap-3 px-3.5 py-2.5 ${kind === k ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
                      <Icon size={18} className="shrink-0" style={{ color: kind === k ? PINK : '#6B5F68' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold">{KIND_LABEL[k].name}</span>
                        <span className="block truncate text-[12.5px] text-[#6B5F68]">{KIND_LABEL[k].words}</span>
                      </span>
                      {kind === k && <Check size={16} style={{ color: PINK }} />}
                    </button>
                  )
                })}
              </div>
              <div className="mt-6 grid gap-4">
                <Field label="What’s it called?" value={name} onChange={setName} placeholder="Fern & Co" />
                <Field label="In one line, what is it?" hint="Becomes your headline. Leave it empty for a placeholder." value={oneLiner} onChange={setOneLiner} placeholder="Slow coffee and good bread on Elm Street" />
              </div>
            </div>
            <div className="lg:sticky lg:top-0">
              <FirstScreen kind={kind} name={name.trim()} line={oneLiner.trim()} />
            </div>
          </section>
        )}

        {step === 'feel' && kind && (
            <section>
              <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Pick a feel</h1>
              <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Fonts, colors, corners and spacing that go together. Pick by eye; every one can be tuned later.</p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {VIBES.map((v) => (
                  <VibeCard key={v.id} id={v.id} on={vibe === v.id} onPick={() => pickVibe(v.id)} kind={kind} name={name.trim() || 'Your site'} brand={brand} mode={vibe === v.id ? mode : v.mode} />
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <label className="flex h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
                  <input type="color" value={brand ?? vibeById(vibe).brand ?? '#404040'} onChange={(e) => setBrand(e.target.value)} className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                  {brand ? 'Your brand color' : 'Have a brand color? Pick it'}
                </label>
                {brand && (
                  <button type="button" onClick={() => setBrand(null)} className={QUIET}>
                    Use the feel’s own
                  </button>
                )}
                <div className="flex rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]" role="radiogroup" aria-label="Light or dark">
                  {(['light', 'dark'] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium capitalize ${PRESS} ${mode === m ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
                      {m === 'light' ? <Sun size={14} /> : <Moon size={14} />} {m}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 'starts' && input && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Three starts</h1>
                  <p className="mt-2 max-w-xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">Each one is laid out on a laptop and a phone before you see it. Pick one; the other two are kept as versions to come back to.</p>
                </div>
                <button type="button" onClick={() => setSeed((n) => n + 1)} disabled={!starts} className={QUIET}>
                  <Shuffle size={15} /> Shuffle
                </button>
              </div>
              {problem && <p className="mt-6 rounded-xl bg-white p-4 text-[14px] text-red-700 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">{problem}</p>}
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {starts
                  ? starts.map((s, i) => <StartCard key={s.id} start={s} letter={String.fromCharCode(65 + i)} best={i === 0} busy={busy} onPick={() => onDone(input, starts, s.id)} />)
                  : [0, 1, 2].map((i) => (
                      <div key={i} className="grid h-[420px] place-items-center rounded-[18px] bg-white/70 text-[13.5px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
                        {i === 1 ? 'Laying out three starts…' : ''}
                      </div>
                    ))}
              </div>
            </section>
          )}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-950/[0.06] bg-white px-4 py-3 sm:px-5">
          {step === 'what' ? (
            <span />
          ) : (
            <button type="button" onClick={() => setStep(step === 'starts' ? 'feel' : 'what')} className={QUIET}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step === 'what' && (
            <button type="button" disabled={!kind || !name.trim()} onClick={() => setStep('feel')} className={PRIMARY}>
              Next: pick a feel <ArrowRight size={16} />
            </button>
          )}
          {step === 'feel' && (
            <button type="button" onClick={() => setStep('starts')} className={PRIMARY}>
              Show me three starts <ArrowRight size={16} />
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
    ['feel', 'Feel'],
    ['starts', 'Starts'],
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
    <label className="grid gap-1.5">
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

/** A feel, drawn as your page would look in it: its colors, display font and your name. */
function VibeCard({ id, on, onPick, kind, name, brand, mode }: { id: string; on: boolean; onPick: () => void; kind: Kind; name: string; brand: string | null; mode: 'light' | 'dark' }) {
  const v = vibeById(id)
  const guide = useMemo(() => guideFor({ vibe: id, brand, mode }), [id, brand, mode])
  const display = guide.base['font.display']
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={`${CARD} overflow-hidden ${on ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
      <span className="block overflow-hidden border-b border-zinc-950/5" style={{ background: guide.base['color.bg'] }}>
        <MixThumb sections={RECIPES[kind].home} guide={guide} heading={name} />
      </span>
      <span className="block p-4">
        <span className="flex items-center justify-between gap-2 text-[16px] font-semibold" style={{ fontFamily: display }}>
          {v.name}
          {on && <Check size={16} style={{ color: PINK }} />}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-[#6B5F68]">{v.words}</span>
      </span>
    </button>
  )
}

/** One start: its first screen on a laptop, where it came from, and how it measured up. */
function StartCard({ start, letter, best, busy, onPick }: { start: ScoredStart; letter: string; best: boolean; busy?: boolean; onPick: () => void }) {
  const html = useMemo(() => previewHtml({ site: start.site, guide: start.guide, content: start.content }, 1280), [start])
  // The laptop-wide page, scaled to the card's width.
  const [scale, setScale] = useState(0.3)
  const frame = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    setScale(el.clientWidth / 1280)
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1280))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.3)]">
      <div ref={frame} className="relative h-[300px] overflow-hidden border-b border-zinc-950/5 bg-zinc-50">
        <iframe
          title={`Start ${letter}`}
          srcDoc={html}
          sandbox="allow-same-origin"
          tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: 1280, height: 300 / scale, transform: `scale(${scale})` }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#17121A] text-[11.5px] font-bold text-white">{letter}</span>
              {best && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgb(255 105 180 / 0.12)', color: '#C2286F' }}>Holds up best</span>}
            </div>
            <div className="mt-2 truncate text-[14.5px] font-semibold">{start.label}</div>
          </div>
          <Score value={start.score.score} />
        </div>
        <ul className="grid gap-1.5 text-[12.5px] leading-snug">
          {start.score.checks
            .filter((c) => c.weight >= 2 || !c.ok)
            .map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={c.ok ? 'text-emerald-600' : 'text-amber-600'} aria-hidden>
                  {c.ok ? '✓' : '!'}
                </span>
                <span className={c.ok ? 'text-[#6B5F68]' : 'text-[#17121A]'}>{c.words}</span>
              </li>
            ))}
          {start.score.phoneScreens !== null && <li className="pl-5 text-[#6B5F68]">About {Math.max(1, Math.round(start.score.phoneScreens))} screens long on a phone</li>}
        </ul>
        <button type="button" onClick={onPick} disabled={busy} className={`${PRIMARY} mt-auto w-full justify-center`}>
          Start with {letter}
        </button>
      </div>
    </article>
  )
}

function Score({ value }: { value: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-11 shrink-0 place-items-center" title={`${value} out of 100`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#F1E9EE" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="4" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-[12px] font-bold">{value}</span>
    </span>
  )
}

/** Every feel's fonts, so the cards draw in them. */
function useVibeFonts() {
  useEffect(() => {
    const hrefs = new Set(VIBES.flatMap((v) => fontHrefs(fontsForTokens(resolveGuide(guideFor({ vibe: v.id })).tokens, []))))
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])
}

const KIND_ICON: Record<Kind, LucideIcon> = { product: Smartphone, studio: Palette, local: Coffee, event: CalendarDays, personal: User, writing: Feather }

/**
 * The page's first screen as you answer: its nav and hero with your name and line in them, and the sections that follow
 * as soft blocks, so the kind you pick changes its shape. Plain and neutral; the feel comes next.
 */
function FirstScreen({ kind, name, line }: { kind: Kind | null; name: string; line: string }) {
  const words = KIND_WORDS[kind ?? 'product']
  const brand = name || 'Your site'
  const fill = (t: string) => t.replaceAll('{name}', brand)
  const nav = words.nav ?? {}
  const hero = words.hero ?? {}
  const next = (kind ? RECIPES[kind].home : RECIPES.product.home).filter((t) => !['nav', 'hero', 'footer'].includes(t)).slice(0, 3)
  return (
    <div className={`overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_24px_48px_-28px_rgb(23_18_26/0.35)] transition-opacity duration-200 ${kind ? '' : 'opacity-60'}`} aria-label="Preview of your page">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-950/[0.06] px-4 py-3 text-[12px]">
        <span className="truncate font-semibold">{brand}</span>
        <span className="flex shrink-0 items-center gap-3 text-[#6B5F68]">
          {[nav.link1, nav.link2, nav.link3].filter(Boolean).map((l) => (
            <span key={l} className="max-sm:hidden">
              {l}
            </span>
          ))}
          {nav.cta && <span className="rounded-full bg-[#17121A] px-2.5 py-1 text-[11px] font-semibold text-white">{nav.cta}</span>}
        </span>
      </div>
      <div className="px-6 pb-8 pt-10 text-center">
        {hero.eyebrow && <div className="text-[11.5px] font-semibold" style={{ color: PINK }}>{fill(hero.eyebrow)}</div>}
        <div className="mx-auto mt-2 max-w-md text-[26px] font-bold leading-[1.1] tracking-tight [text-wrap:balance]">{line || fill(hero.headline ?? 'Your headline')}</div>
        {hero.subhead && <div className="mx-auto mt-3 max-w-sm text-[13px] leading-snug text-[#6B5F68] [text-wrap:pretty]">{fill(hero.subhead)}</div>}
        <div className="mt-5 flex justify-center gap-2">
          {hero.ctaPrimary && <span className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white" style={{ background: PINK }}>{fill(hero.ctaPrimary)}</span>}
          {hero.ctaSecondary && <span className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgb(23_18_26/0.15)]">{fill(hero.ctaSecondary)}</span>}
        </div>
      </div>
      <div className="grid gap-2 px-4 pb-4">
        {next.map((t) => (
          <div key={t} className="flex h-12 items-center rounded-xl bg-[#F6F1F4] px-3.5 text-[12px] font-medium text-[#6B5F68]">
            {TYPE_LABEL[t]}
          </div>
        ))}
      </div>
    </div>
  )
}

