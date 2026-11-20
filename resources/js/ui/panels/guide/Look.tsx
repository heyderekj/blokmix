import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Dices, Pin, Shuffle } from 'lucide-react'
import type { FeelWord } from '@/core/feel'
import { openGroups, resolveGuide } from '@/core/guide'
import { applySkin, refId, skinById, themeList, WIREFRAME } from '@/core/skins'
import { emptyContract, isKept, type StyleArea } from '@/core/contract'
import { DIALS, readDials, toneOfGuide, type DialName } from '@/core/dials'
import { rankThemes } from '@/core/themeRanking'
import type { TokenKey } from '@/core/types'
import { useResolvedGuide, useTokenPreview } from '@/state/derived'
import { useJevTools } from '@/state/jevSay'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { ColorsByFeel } from '../../jev/ColorsByFeel'
import { BrandColor } from './Dials'
import { DotMatrix, type Point } from './DotMatrix'
import { PartPicker } from './PartPicker'
import { Compare, putSkin } from './Skins'
import { FontLinks } from './shared'
import { SkinPreview } from '../../skins/SkinPreview'
import { pageOf } from '@/core/site'

const TILE = 'rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]'
const LINK = 'flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold text-zinc-500 transition-[color] [@media(hover:hover)_and_(pointer:fine)]:hover:text-zinc-900'
const PRESS = 'cursor-pointer transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#ff69b4)]'
const STEP = 'grid gap-2 animate-[rise_220ms_cubic-bezier(0.23,1,0.32,1)]'

/**
 * Look: how your site looks, for people who aren't designers, broad to specific. Three short steps that fold into one
 * line each once answered, like the start's questions: how it should feel, a theme that fits, then fine-tune. Your
 * color (and light or dark) sits under it; every value lives one tap away, in the style guide.
 */
export function Look() {
  return (
    <div className="grid gap-2 p-3">
      <Steps />
      <Color />
      <GuideDoor />
    </div>
  )
}

/** Four broad feels, each a few of the feel words themes are ranked by (`core/feel.ts`). Dark lives with color. */
const FEELS: { id: string; name: string; line: string; words: FeelWord[] }[] = [
  { id: 'calm', name: 'Calm', line: 'Quiet, classic, easy', words: ['calm', 'classic'] },
  { id: 'warm', name: 'Warm', line: 'Friendly, made by hand', words: ['warm'] },
  { id: 'bold', name: 'Bold', line: 'Big, playful, sure', words: ['bold', 'playful'] },
  { id: 'sharp', name: 'Sharp', line: 'Precise, modern, clean', words: ['modern', 'serious'] },
]
/** The broad feel that fits some feel words best, or null when none do. */
const feelOf = (words: readonly string[]) => {
  let best: (typeof FEELS)[number] | null = null
  let most = 0
  for (const f of FEELS) {
    const n = f.words.filter((w) => words.includes(w)).length
    if (n > most) [best, most] = [f, n]
  }
  return best
}

type Open = 'feel' | 'theme' | 'tune'

function Steps() {
  const brief = useStore((s) => s.content.brief)
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const asked = useJevTools((s) => s.open === 'restyle')
  const skin = guide.skin && guide.skin.id !== WIREFRAME ? guide.skin : null
  // Only the theme that's on: a look of every theme on each change is what made the page lag.
  const on = useMemo(() => (skin ? skinById(refId(skin)!) : undefined), [skin])
  // What you said, else what the theme on says about itself.
  const feel = feelOf(brief?.feel ?? []) ?? (on ? feelOf(on.feel) : null)
  const [open, setOpen] = useState<Open>(() => (!feel ? 'feel' : !skin ? 'theme' : 'tune'))
  // The feel your site's kind and industry suggest, read off the theme that fits it best with no words said. Ranking
  // dresses every theme, so it runs only while the feel step is open, and not again for a change of colors or type.
  const suggested = useMemo(
    () => (open === 'feel' ? feelOf(rankThemes({ brief: { ...brief, feel: [] }, words: [], guide: useStore.getState().guide, contract, count: 1 })[0]?.skin.feel ?? [])?.id : undefined),
    [open, brief, contract],
  )
  useEffect(() => { if (asked) setOpen('tune') }, [asked])
  const pickFeel = (f: (typeof FEELS)[number]) => {
    const keep = (brief?.feel ?? []).filter((w) => w === 'dark')
    runCommand('set_brief', { feel: [...f.words, ...keep] }, 'you')
    setOpen('theme')
  }
  return (
    <div className={`${TILE} grid gap-2.5`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-zinc-900">Look</span>
        <span className="min-w-0 truncate text-[11.5px] font-medium text-zinc-500">{[feel?.name, on?.name ?? (guide.skin?.id === 'remix' ? 'Mixed theme' : guide.skin?.id === 'site' ? `${guide.skin.name}’s look` : null)].filter(Boolean).join(' › ') || 'Three quick steps'}</span>
      </div>
      {open === 'feel' ? (
        <div className={STEP}>
          <span className="text-[11.5px] font-medium text-zinc-500">How should it feel?</span>
          <div className="grid grid-cols-2 gap-1.5">
            {FEELS.map((f) => {
              const here = f.id === feel?.id
              return (
                <button key={f.id} type="button" aria-pressed={here} onClick={() => pickFeel(f)} className={`grid gap-0.5 rounded-xl px-3 py-2.5 text-left ${PRESS} ${here ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-900 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-chip-hover'}`}>
                  {f.id === suggested && <span className={`text-[9.5px] font-bold uppercase tracking-[0.04em] ${here ? 'text-white/70' : 'text-[var(--color-accent,#ff69b4)]'}`}>Suggested</span>}
                  <span className="text-[13px] font-semibold">{f.name}</span>
                  <span className={`text-[11px] ${here ? 'text-white/65' : 'text-zinc-500'}`}>{f.line}</span>
                </button>
              )
            })}
          </div>
          <OwnWords onDone={() => setOpen('tune')} />
        </div>
      ) : (
        <Folded label="Feel" value={brief?.feelWords?.[0] && !feel ? brief.feelWords[0] : (feel?.name ?? 'Any')} onChange={() => setOpen('feel')} />
      )}
      {open === 'theme' ? (
        <Themes words={feel?.words ?? []} onPicked={() => setOpen('tune')} />
      ) : (
        (skin || open === 'tune') && <Folded label="Theme" value={on?.name ?? (guide.skin?.id === 'remix' ? 'Mixed theme' : guide.skin?.id === 'site' ? `${guide.skin.name}’s look` : 'Wireframe')} onChange={() => setOpen('theme')} />
      )}
      {open === 'tune' && <FineTune />}
      {open === 'tune' && <MixRest />}
    </div>
  )
}

/**
 * How it should feel, in your own words: "warm and handmade, roomier, not corporate". The best theme for those feelings
 * goes on, nudges turn its dials and light or dark sets the tone, as one undo step (`look_from_words`).
 */
function OwnWords({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const go = () => {
    if (!text.trim()) return
    try {
      const out = runCommand('look_from_words', { text }, 'you') as { theme: string | null; nudged: string[]; tone: string }
      const said = [out.theme, ...out.nudged].filter(Boolean).join(', ')
      useStore.getState().showFlash(said ? `From your words: ${said}` : 'From your words', { undo: true })
      setText('')
      onDone()
    } catch (e) {
      setNote((e as Error).message)
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        go()
      }}
      className="grid gap-1"
    >
      <label className="flex h-9 items-center gap-1.5 rounded-xl bg-chip pl-3 pr-1 text-[12.5px] focus-within:shadow-[0_0_0_2px_rgb(24_24_27)]">
        <span className="shrink-0 font-medium text-zinc-500">Or in your words</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setNote(null)
          }}
          placeholder="warm, handmade, roomier"
          aria-label="How should it feel, in your words"
          className="min-w-0 flex-1 bg-transparent font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Use these words" className={`grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white disabled:opacity-25 ${PRESS}`}>
          <ChevronRight size={14} />
        </button>
      </label>
      {note && <p className="px-1 text-[11.5px] leading-snug text-zinc-500">{note}</p>}
    </form>
  )
}

const NO_PINS: StyleArea[] = []

/** The parts you can pin; the rest (spacing, motion, block looks, section bands) mix along. */
const PINS: { area: StyleArea; label: string }[] = [
  { area: 'color', label: 'Color' },
  { area: 'type', label: 'Type' },
  { area: 'shape', label: 'Shape' },
  { area: 'pictures', label: 'Pictures' },
]

/**
 * Keep what you like, Mix the rest: pin the parts of this look you want to hold on to, and Mix brings the others from
 * other themes (a mixed theme), as one undo step. Pins are this device's and apart from Rules for your agent.
 */
function MixRest() {
  // One empty list, never a new one per read (a new one each time would re-render forever).
  const keep = useStore((s) => s.ui.lookKeep) ?? NO_PINS
  const kept = useStore((s) => s.contract)
  const toggle = (a: StyleArea) => useStore.getState().setUi({ lookKeep: keep.includes(a) ? keep.filter((x) => x !== a) : [...keep, a] })
  const mixRest = () => {
    try {
      const out = runCommand('surprise_me', { seed: Math.floor(Math.random() * 1e9), keep }, 'you') as { words: string }
      useStore.getState().showFlash(out.words, { undo: true })
    } catch (e) {
      useStore.getState().showFlash((e as Error).message)
    }
  }
  return (
    <div className="grid gap-1.5 border-t border-zinc-950/6 pt-2.5">
      <span className="text-[11.5px] font-medium text-zinc-500">Keep what you like, mix the rest</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {PINS.map(({ area, label }) => {
          const ruled = isKept(kept ?? undefined, area)
          const on = ruled || keep.includes(area)
          return (
            <button
              key={area}
              type="button"
              aria-pressed={on}
              disabled={ruled}
              title={ruled ? `${label} stays: Rules for your agent keep it` : on ? `${label} stays when you mix` : `Keep this ${label.toLowerCase()} when you mix`}
              onClick={() => toggle(area)}
              className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold disabled:cursor-default ${PRESS} ${on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-chip-hover'}`}
            >
              {on ? <Pin size={11} className="fill-current" /> : <Pin size={11} />} {label}
            </button>
          )
        })}
        <button type="button" onClick={mixRest} className={`ml-auto flex h-7 items-center gap-1.5 rounded-full bg-[var(--color-accent,#ff69b4)] px-3 text-[12px] font-semibold text-white ${PRESS}`}>
          <Dices size={13} /> Mix the rest
        </button>
      </div>
    </div>
  )
}

/** A step that's been answered: its name, the answer, and a way back. */
function Folded({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-chip px-3 py-2">
      <span className="w-12 shrink-0 text-[11px] font-semibold text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-900">{value}</span>
      <button type="button" onClick={onChange} className={LINK}>Change</button>
    </div>
  )
}

/**
 * The themes that fit the feel best, as your own page in each: the open page drawn in that look, four at a time. Pointing
 * at one previews it on the page itself; a click puts it on. Others rolls four more, never one shown this round; every
 * theme side by side is a link away.
 */
function Themes({ words, onPicked }: { words: FeelWord[]; onPicked: () => void }) {
  const brief = useStore((s) => s.content.brief)
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const content = useStore((s) => s.content)
  const site = useStore((s) => s.site)
  const pageId = useStore((s) => s.ui.pageId)
  const on = useStore((s) => s.guide.skin)
  const preview = useTokenPreview((s) => s.setPatch)
  const [comparing, setComparing] = useState(false)
  // Themes already shown this round, so Others always brings new ones (and starts over once they run out).
  const [seen, setSeen] = useState<string[]>([])
  useEffect(() => () => preview(null), [preview])
  // Only the open page, as the previews draw a site's first page.
  const page = useMemo(() => ({ ...site, pages: [pageOf(site, pageId)] }), [site, pageId])
  const shown = useMemo(() => {
    // A theme and its variants count as one: a row never shows two of them, and Others leaves out every one already seen.
    const base = (id: string) => id.split('/')[0]
    const exclude = themeList().filter((t) => seen.includes(base(t.id))).map((t) => t.id)
    const ranked = rankThemes({ brief: { ...brief, feel: words }, words, guide, contract, count: 10, exclude })
    const row = ranked.filter((r, i) => ranked.findIndex((x) => base(x.skin.id) === base(r.skin.id)) === i).slice(0, 4)
    return row.map((r) => ({ skin: r.skin, reason: r.reason, guide: r.guide, tokens: resolveGuide(r.guide).tokens }))
    // A change of the look you picked shouldn't reshuffle the row under your pointer: it's ranked per round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, words, contract, seen])
  const others = () => {
    preview(null)
    const ids = shown.map((l) => l.skin.id.split('/')[0])
    setSeen((s) => (shown.length < 4 ? [] : [...s, ...ids]))
  }
  return (
    <div className={STEP}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-zinc-500">Pick a theme</span>
        <button type="button" onClick={others} className={LINK}>
          <Shuffle size={12} /> Others
        </button>
      </div>
      <FontLinks tokens={shown.map((l) => l.tokens)} />
      <div className="grid grid-cols-2 gap-2" onMouseLeave={() => preview(null)}>
        {shown.map(({ skin, reason, guide: g, tokens }) => {
          const here = refId(on) === skin.id
          return (
            <button
              key={skin.id}
              type="button"
              aria-pressed={here}
              title={reason}
              onMouseEnter={() => preview(tokens)}
              onFocus={() => preview(tokens)}
              onBlur={() => preview(null)}
              onClick={() => {
                preview(null)
                if (!here) putSkin(skin)
                onPicked()
              }}
              className={`group/sw grid min-w-0 gap-1 rounded-[12px] text-left ${PRESS}`}
            >
              <span className={`block overflow-hidden rounded-[11px] transition-[box-shadow] duration-150 ${here ? 'shadow-[0_0_0_2px_rgb(24_24_27)]' : 'shadow-[0_0_0_1px_rgb(0_0_0/0.08)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/sw:shadow-[0_0_0_1px_rgb(0_0_0/0.25)]'}`}>
                <SkinPreview site={page} guide={g} content={content} title={`This page in ${skin.name}`} height={112} viewportWidth={1100} />
              </span>
              <span className="truncate px-0.5 text-[11.5px] font-semibold text-zinc-700">{skin.name}</span>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={() => setComparing(true)} className={`justify-self-start ${LINK}`}>
        Every theme on this page <ChevronRight size={13} />
      </button>
      {comparing && <Compare onClose={() => setComparing(false)} onPick={(s) => { putSkin(s); setComparing(false); onPicked() }} />}
    </div>
  )
}

/** Your color, and whether the page is light or dark: both are about color, so they sit together. */
function Color() {
  const tokens = useResolvedGuide().tokens
  const dark = toneOfGuide(tokens) === 'dark'
  const tone = (to: 'light' | 'dark') => {
    if ((to === 'dark') === dark) return
    runCommand('set_tone', { tone: to }, 'you')
    useStore.getState().showFlash(to === 'dark' ? 'Dark page' : 'Light page', { undo: true })
  }
  return (
    <div className={TILE}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-zinc-900">Your color</span>
        <div role="radiogroup" aria-label="Page" className="flex rounded-full bg-chip p-0.5">
          {(['light', 'dark'] as const).map((t) => {
            const on = (t === 'dark') === dark
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                data-round-control
                onClick={() => tone(t)}
                className={`h-6 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.97] ${on ? 'bg-[var(--lift)] text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.1)]' : 'text-zinc-500 [@media(hover:hover)_and_(pointer:fine)]:hover:text-zinc-800'}`}
              >
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            )
          })}
        </div>
      </div>
      <BrandColor fallback={tokens['color.primary']} />
      <ColorsByFeel />
    </div>
  )
}

const clamp = (n: number) => Math.min(100, Math.max(0, n))
const avg = (a: number, b: number) => (a + b) / 2
const MIDDLE: Record<DialName, number> = { spacing: 50, type: 50, roundness: 50, weight: 50, width: 50 }
/** Across: quiet to loud (type size and weight). Up: crisp to soft (rounder corners, more room). */
const AXES: Record<'x' | 'y', [DialName, DialName]> = { x: ['type', 'weight'], y: ['roundness', 'spacing'] }

function tuneWords({ x, y }: Point): string {
  const a = Math.abs(x - 50) < 6 ? '' : x > 50 ? 'louder' : 'quieter'
  const b = Math.abs(y - 50) < 8 ? '' : y > 50 ? 'softer' : 'crisper'
  const out = [a, b].filter(Boolean).join(', ')
  return out ? out[0].toUpperCase() + out.slice(1) : 'As the theme made it'
}

/**
 * Fine-tune on a field of dots: one point sets louder or quieter and crisper or softer, each from where the theme put
 * its dials (the ring in the middle). It previews on the page while you drag and lands as one undo step. Each dial on
 * its own stays in the style guide; Change one part folds away under it, and opens when Say it asks to restyle.
 */
function FineTune() {
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const preview = useTokenPreview((s) => s.setPatch)
  const asked = useJevTools((s) => s.open === 'restyle')
  const [parts, setParts] = useState(false)
  useEffect(() => () => preview(null), [preview])
  useEffect(() => { if (asked) setParts(true) }, [asked])
  const now = useMemo(() => readDials(resolveGuide(guide).tokens), [guide])
  // The theme's own dials: the one theme that's on, put on afresh (your brand color and kept areas stay).
  const theirs = useMemo(() => {
    const skin = guide.skin && skinById(refId(guide.skin)!)
    return skin ? readDials(resolveGuide(applySkin(guide, skin, contract ?? emptyContract())).tokens) : MIDDLE
  }, [guide, contract])
  const at = (axis: 'x' | 'y') => Math.round(clamp(50 + avg(...(AXES[axis].map((d) => now[d] - theirs[d]) as [number, number]))))
  const value = { x: at('x'), y: at('y') }
  const patch = (p: Point): Partial<Record<TokenKey, string>> =>
    Object.assign({}, ...(['x', 'y'] as const).flatMap((a) => AXES[a].map((d) => DIALS[d].write(clamp(theirs[d] + p[a] - 50)))))
  return (
    <div className={STEP}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-zinc-500">Fine-tune</span>
        <span className="text-[11px] text-zinc-400">{tuneWords(value)}</span>
      </div>
      <DotMatrix
        label="Quiet to loud, crisp to soft"
        value={value}
        ends={{ left: 'Quiet', right: 'Loud', bottom: 'Crisp', top: 'Soft' }}
        describe={tuneWords}
        onInput={(p) => preview(patch(p))}
        onCommit={(p) => {
          preview(null)
          useStore.getState().chooseTokens(patch(p))
          useStore.getState().showFlash(tuneWords(p) === 'As the theme made it' ? 'Back to the theme' : tuneWords(p), { undo: true })
        }}
      />
      <button type="button" onClick={() => setParts((v) => !v)} aria-expanded={parts} className={`mt-1 w-full justify-between ${LINK}`}>
        <span>Change one part</span>
        <ChevronRight size={13} className={`transition-[rotate] duration-200 ${parts ? 'rotate-90' : ''}`} />
      </button>
      {parts && <PartPicker />}
    </div>
  )
}

/** The way into every value: for a designer, or for your agent. Says when the style guide has a choice waiting. */
function GuideDoor() {
  const decisions = openGroups(useResolvedGuide()).length
  return (
    <button
      type="button"
      onClick={() => useStore.getState().setUi({ guideView: 'guide' })}
      className={`${TILE} flex cursor-pointer items-center justify-between gap-3 text-left transition-[translate,box-shadow,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5`}
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-900">
          Style guide
          {decisions > 0 && <span className="rounded-full bg-attention-soft px-2 py-0.5 text-[10.5px] font-bold text-attention-ink">{decisions} to decide</span>}
        </span>
        <span className="text-[11.5px] leading-snug text-zinc-500">Every value, for a designer or your agent.</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-zinc-400" />
    </button>
  )
}
