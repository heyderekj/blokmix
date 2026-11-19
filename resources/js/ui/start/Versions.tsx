import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Lock, Moon, Shuffle, Sun, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type { GuideState } from '@/core/types'
import type { StartCandidate, StartInput } from '@/core/start'
import { startVersions, type StartVersion } from '@/core/startVersions'
import { leanOf, noteTaste, tasteWords, type Taste } from '@/core/taste'
import { rankThemes } from '@/core/themeRanking'
import { skinById } from '@/core/skins'
import type { PageScore } from '@/core/score'
import type { PaletteVariant } from '@/core/palette'
import { library } from '@/data/library'
import { scoreStart } from '@/lib/start'
import { wordsCandidates, type Heard } from '@/lib/startFromText'
import { ColorButton } from '@/ui/color/ColorPicker'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { HOVER, PRESS, PRIMARY, QUIET, Score } from './parts'

export const ROW = 4
const ODD = [
  { v: 0, label: 'Safe' },
  { v: 1, label: 'A bit unusual' },
  { v: 2, label: 'Strange' },
] as const

type Pin = { look?: string; layout?: string }

/**
 * Pick a version: whole pages that differ in layout and look, each with what it is and how its first screen holds up.
 * Mix spins a new row; "Keep this layout" or "Keep this look" holds one half while the other changes. Open one and
 * the site starts with that page alone; the rest are remembered as passed, so the next row leans your way.
 */
export function Versions({ input, copy, fixed, taste, onTaste, brand, onBrand, mode, onMode, busy, onOpen }: {
  input: StartInput
  copy: Heard | null
  /** A saved style guide you started from: only the layouts vary. */
  fixed: { name: string; guide?: GuideState } | null
  taste: Taste | undefined
  onTaste: (t: Taste) => void
  brand: string | null
  onBrand: (hex: string | null, variant?: PaletteVariant) => void
  mode: 'light' | 'dark' | undefined
  onMode: (m: 'light' | 'dark') => void
  busy?: boolean
  onOpen: (chosen: StartCandidate, row: StartCandidate[], taste: Taste) => void
}) {
  const [seed, setSeed] = useState(0)
  const [odd, setOdd] = useState(1)
  const [pin, setPin] = useState<Pin | null>(null)
  const [keep, setKeep] = useState<StartVersion | null>(null)
  const [round, setRound] = useState(0)
  const tasteKey = JSON.stringify(taste?.events.map((e) => [e.kind, e.ref, e.traits]) ?? [])
  const key = JSON.stringify([input, seed, odd, pin, keep?.start.id, tasteKey, copy?.lines, fixed?.name])

  const row = useMemo<StartVersion[]>(() => {
    const at = { ...input, seed }
    // Your own words: three arrangements of them, each in a look that fits.
    if (copy?.plan) {
      const looks = rankThemes({ brief: input.brief, count: ROW })
      return wordsCandidates(at, copy.plan)
        .slice(0, ROW)
        .map((start, i) => {
          const look = looks[i % looks.length]
          return { start: { ...start, guide: fixed?.guide ?? look.guide }, why: `${look.skin.name}: ${look.reason}`, theme: look.skin.id, traits: [] }
        })
    }
    if (fixed)
      return startVersions(at, library, { count: ROW, vary: 'layout' }).map((v) => ({ ...v, start: { ...v.start, guide: fixed.guide ?? v.start.guide }, why: `Your style guide ${fixed.name}, laid out another way.` }))
    return startVersions(at, library, { count: ROW, vary: 'both', taste, odd, pin: pin ?? undefined, keep: keep ?? undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Each page is measured once it's on screen; the verdicts fade in and the cards never move.
  const [scores, setScores] = useState<Record<string, PageScore>>({})
  useEffect(() => {
    let live = true
    for (const v of row) {
      const id = scoreKey(v)
      if (scores[id]) continue
      scoreStart(v.start)
        .then((s) => live && setScores((x) => ({ ...x, [id]: s })))
        .catch(() => {})
    }
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row])

  /** A new row: what wasn't kept is remembered as passed, so it stays out and the next row leans away from it. */
  const mix = () => {
    const passed = row.filter((v) => v.direction && v !== keep).map((v) => ({ kind: 'passed' as const, traits: v.traits, ref: v.direction, source: 'you' as const }))
    if (passed.length) onTaste(noteTaste(taste, ...passed))
    setSeed((n) => n + 1)
    setRound((n) => n + 1)
  }
  const react = (v: StartVersion, kind: 'more' | 'less') => {
    onTaste(noteTaste(taste, { kind, traits: v.traits, ref: v.direction, source: 'you' }))
    setSeed((n) => n + 1)
    setRound((n) => n + 1)
  }
  const hold = (v: StartVersion, half: 'look' | 'layout') => {
    const on = keep?.start.id === v.start.id && !!pin?.[half]
    if (on) return (setPin(null), setKeep(null))
    setKeep(v)
    setPin(half === 'look' ? { look: v.theme } : v.direction ? { layout: v.direction } : null)
    setRound((n) => n + 1)
  }
  const open = (v: StartVersion) => {
    const others = row.filter((x) => x !== v && x.direction)
    const next = noteTaste(taste, { kind: 'picked', traits: v.traits, ref: v.direction, source: 'you' }, ...others.map((x) => ({ kind: 'passed' as const, traits: x.traits, ref: x.direction, source: 'you' as const })))
    onOpen(v.start, row.map((x) => x.start), next)
  }
  const leaning = tasteWords(leanOf(taste))
  const page = mode ?? 'light'

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-tight [text-wrap:balance] sm:text-[26px]">Pick a version</h2>
          <p className="mt-1.5 max-w-2xl text-[15px] text-[#6B5F68] [text-wrap:pretty]">
            {fixed ? `Your page in ${fixed.name}, laid out ${ROW} ways.` : copy?.plan ? 'Your words, arranged a few ways, each in a look that fits.' : 'Whole pages, each a different layout and look. Open the one you like; Mix shows more.'}
          </p>
          {leaning && <p className="mt-1 text-[13px] text-[#6B5F68]">{leaning}</p>}
        </div>
        <button type="button" onClick={mix} className={`${PRIMARY}`} aria-label="Mix: show a new row">
          <Shuffle size={16} /> Mix
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!fixed && !copy?.plan && (
          <span className="flex items-center rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]" role="radiogroup" aria-label="How unusual">
            {ODD.map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={odd === o.v} onClick={() => setOdd(o.v)} className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${PRESS} ${odd === o.v ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
                {o.label}
              </button>
            ))}
          </span>
        )}
        {(pin?.look || pin?.layout) && keep && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD4E8]/60 py-1 pl-3 pr-1 text-[12.5px] font-medium">
            <Lock size={12} /> Keeping {pin.look ? `the look of ${skinById(pin.look)?.name ?? 'that one'}` : `the layout of ${keep.start.label}`}
            <button type="button" onClick={() => (setPin(null), setKeep(null))} aria-label="Stop keeping it" className={`grid size-6 place-items-center rounded-full ${HOVER}bg-zinc-950/5 ${PRESS}`}>
              <X size={12} />
            </button>
          </span>
        )}
        <span className="flex-1" />
        {!fixed && (
          <span className="flex items-center rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(23_18_26/0.08)]">
            <ColorButton
              value={brand ?? '#404040'}
              live={(h, v) => onBrand(h, v)}
              onPick={(h, v) => onBrand(h, v)}
              palette={page}
              title="Brand color"
              className={`flex h-8 items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium text-[#6B5F68] ${PRESS}`}
            >
              <span className="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: brand ?? 'conic-gradient(#FF69B4, #FFB020, #2BB673, #3B82F6, #FF69B4)' }} />
              {brand ? <span className="font-mono text-[12px] uppercase">{brand}</span> : 'Brand color'}
            </ColorButton>
            {brand && (
              <button type="button" onClick={() => onBrand(null)} aria-label="Use each theme’s own colors" title="Use each theme’s own colors" className={`grid size-8 place-items-center rounded-full text-[#6B5F68] hover:text-[#17121A] ${PRESS}`}>
                <X size={14} />
              </button>
            )}
            <span className="mx-1 h-5 w-px bg-zinc-950/10" aria-hidden />
            <span className="flex" role="radiogroup" aria-label="Light or dark">
              {(['light', 'dark'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} aria-label={m === 'light' ? 'Light' : 'Dark'} title={m === 'light' ? 'Light' : 'Dark'} onClick={() => onMode(m)} className={`grid size-8 place-items-center rounded-full ${PRESS} ${mode === m ? 'bg-[#17121A] text-white' : 'text-[#6B5F68]'}`}>
                  {m === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              ))}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
        {row.map((v, i) => (
          <VersionCard
            key={`${round}-${v.start.id}`}
            v={v}
            index={i}
            score={scores[scoreKey(v)]}
            kept={keep?.start.id === v.start.id ? (pin?.look ? 'look' : 'layout') : null}
            canReact={!!v.direction}
            busy={busy}
            onOpen={() => open(v)}
            onHold={(half) => hold(v, half)}
            onReact={(kind) => react(v, kind)}
          />
        ))}
      </div>
    </section>
  )
}

const scoreKey = (v: StartVersion) => JSON.stringify([v.start.id, v.start.site.pages.map((p) => p.slots.map((s) => s.clipId)), v.start.guide.skin, v.start.guide.brand, v.start.guide.mode])

/** What the first screen's measure says, in one line: the first thing it misses, or that it holds up. */
function verdict(score: PageScore): string {
  const miss = score.checks.find((c) => !c.ok && c.weight > 0)
  return miss ? miss.words : 'The headline and the main button show on a laptop and a phone.'
}

function VersionCard({ v, index, score, kept, canReact, busy, onOpen, onHold, onReact }: {
  v: StartVersion
  index: number
  score?: PageScore
  kept: 'look' | 'layout' | null
  canReact: boolean
  busy?: boolean
  onOpen: () => void
  onHold: (half: 'look' | 'layout') => void
  onReact: (kind: 'more' | 'less') => void
}) {
  const chip = (on: boolean) => `inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${PRESS} ${on ? 'bg-[#17121A] text-white' : `text-[#3F363D] shadow-[0_0_0_1px_rgb(23_18_26/0.1)] ${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.25)]`}`
  const pages = v.start.site.pages.length
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-[18px] bg-white motion-safe:animate-pop ${kept ? 'shadow-[0_0_0_2px_#FF69B4,0_16px_32px_-20px_rgb(255_105_180/0.6)]' : 'shadow-[0_0_0_1px_rgb(23_18_26/0.08)]'}`}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <button type="button" onClick={onOpen} disabled={busy} aria-label={`Open ${v.start.label}`} className="group block cursor-pointer text-left disabled:cursor-wait">
        <SkinPreview site={v.start.site} guide={v.start.guide} content={v.start.content} title={v.start.label} height={300} peek />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14.5px] font-semibold">{v.start.label}</h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B5F68] [text-wrap:pretty]">{v.why}</p>
          </div>
          {score && <Score value={score.score} />}
        </div>
        <p className={`min-h-[2lh] text-[12px] leading-snug text-[#6B5F68] transition-opacity duration-300 ${score ? 'opacity-100' : 'opacity-0'}`}>
          {score ? verdict(score) : 'Measuring…'}
          {pages > 1 ? ` ${pages} pages.` : ''}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onHold('layout')} disabled={!v.direction} aria-pressed={kept === 'layout'} className={chip(kept === 'layout')}>
            Keep layout
          </button>
          <button type="button" onClick={() => onHold('look')} aria-pressed={kept === 'look'} className={chip(kept === 'look')}>
            Keep look
          </button>
          <span className="flex-1" />
          {canReact && (
            <>
              <button type="button" onClick={() => onReact('more')} aria-label={`More like ${v.start.label}`} title="More like this" className={`grid size-7 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
                <ThumbsUp size={13} />
              </button>
              <button type="button" onClick={() => onReact('less')} aria-label={`Not ${v.start.label}`} title="Not this" className={`grid size-7 place-items-center rounded-full text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`}>
                <ThumbsDown size={13} />
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={onOpen} disabled={busy} className={`${QUIET} -mx-1 justify-center bg-[#17121A]/[0.04] font-semibold text-[#17121A]`}>
          Open this one <ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}
