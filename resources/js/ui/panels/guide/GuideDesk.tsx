import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { GROUP_LABEL } from '@/core/tokens'
import { BrandColours, Candidates, Components, CopyFooter, GroupTokens, useContrast } from '../GuidePanel'
import { FontLinks, SourceMark, choose, sourceName, summaryOf, unchoose, useGuideData, withCandidate } from './shared'

/**
 * B · Mixing desk. Every group is a channel strip: its sources sit at the ends of a
 * crossfader, and the knob says which one the guide follows (centre: not decided yet).
 * Contrast is the master section, as level meters.
 */
export function GuideDesk() {
  const { tokens, open, candidates } = useGuideData()
  return (
    <div className="bg-zinc-950/[0.025] pb-1">
      <FontLinks tokens={[tokens, ...TOKEN_GROUPS.flatMap((g) => candidates(g).map((c) => withCandidate(tokens, c)))]} />
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5 text-[12px]">
        <span className="font-semibold text-zinc-800">Channels</span>
        <span className={open.length ? 'font-semibold text-attention-ink' : 'font-semibold text-done-ink'}>{open.length ? `${open.length} not set` : 'All set'}</span>
      </div>
      {TOKEN_GROUPS.map((g) => (
        <Strip key={g} group={g} />
      ))}
      <Master />
      <div className="bg-[var(--lift)]">
        <BrandColours />
        <Components />
        <Candidates />
      </div>
      <CopyFooter />
    </div>
  )
}

function Strip({ group }: { group: TokenGroup }) {
  const { tokens, open, candidates, winner } = useGuideData()
  const [tune, setTune] = useState(false)
  const cands = candidates(group)
  const isOpen = open.includes(group)
  const w = winner(group)
  const at = cands.findIndex((c) => c.id === w)
  const track = useRef<HTMLDivElement>(null)
  // Stops: one per source, spread across the fader; undecided sits in the middle.
  const stops = cands.map((_, i) => (cands.length === 1 ? 50 : (i / (cands.length - 1)) * 100))
  const pos = at >= 0 ? stops[at] : 50
  const dragTo = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    const p = ((clientX - r.left) / r.width) * 100
    const nearest = stops.reduce((best, s, i) => (Math.abs(s - p) < Math.abs(stops[best] - p) ? i : best), 0)
    if (Math.abs(p - 50) < 12 && cands.length === 2) return unchoose(group)
    choose(cands[nearest])
  }
  return (
    <section className="mx-3 my-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_4px_12px_-8px_rgb(0_0_0/0.2)]">
      <header className="flex items-center gap-2">
        <SourceMark group={group} tokens={tokens} size={20} />
        <span className="text-[13.5px] font-semibold text-zinc-900">{GROUP_LABEL[group]}</span>
        <span className={`ml-auto text-[11.5px] ${isOpen ? 'font-semibold text-attention-ink' : 'text-zinc-500'}`}>
          {cands.length < 2 ? (cands[0] ? `from ${sourceName(cands[0])}` : 'Default') : isOpen ? 'Pick a side' : `from ${sourceName(cands[at] ?? cands[0])}`}
        </span>
      </header>

      {cands.length >= 2 ? (
        <div className="mt-3 grid gap-2">
          <div className="flex justify-between gap-3">
            {[cands[0], cands[cands.length - 1]].map((c, i) => (
              <button key={c.id} type="button" onClick={() => choose(c)} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg p-1 text-left transition-[background-color] duration-150 hover:bg-zinc-950/5 ${i ? 'flex-row-reverse text-right' : ''}`}>
                <SourceMark group={group} tokens={withCandidate(tokens, c)} size={26} />
                <span className="min-w-0">
                  <span className={`block truncate text-[12px] font-semibold ${w === c.id ? 'text-zinc-900' : 'text-zinc-500'}`}>{sourceName(c)}</span>
                  <span className="block truncate font-mono text-[10px] text-zinc-400">{summaryOf(group, withCandidate(tokens, c)).split(' · ')[0]}</span>
                </span>
              </button>
            ))}
          </div>
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label={`${GROUP_LABEL[group]} source`}
            aria-valuetext={at >= 0 ? sourceName(cands[at]) : 'Not decided'}
            onPointerDown={(e) => {
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              dragTo(e.clientX)
            }}
            onPointerMove={(e) => e.buttons && dragTo(e.clientX)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') choose(cands[Math.max(0, (at < 0 ? 1 : at) - 1)])
              if (e.key === 'ArrowRight') choose(cands[Math.min(cands.length - 1, at + 1)])
            }}
            className="relative h-9 cursor-pointer touch-none rounded-[10px] bg-zinc-950/[0.05] shadow-[inset_0_1px_3px_rgb(0_0_0/0.08)] outline-none focus-visible:ring-2 focus-visible:ring-key"
          >
            <span className="absolute inset-x-5 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: `linear-gradient(90deg, ${withCandidate(tokens, cands[0])['color.primary']}, ${withCandidate(tokens, cands[cands.length - 1])['color.primary']})`, opacity: group === 'color' ? 1 : 0.25 }} />
            <span className="absolute left-1/2 top-2 h-5 w-px bg-zinc-950/15" />
            <span
              className="absolute top-1 grid h-7 w-11 -translate-x-1/2 place-items-center rounded-lg bg-gradient-to-b from-white to-zinc-100 shadow-[0_0_0_1px_rgb(0_0_0/0.12),0_3px_6px_-2px_rgb(0_0_0/0.3),inset_0_1px_0_#fff] transition-[left] duration-[240ms] ease-[cubic-bezier(0.3,1.4,0.5,1)] motion-reduce:transition-none"
              style={{ left: `calc(20px + (100% - 40px) * ${pos / 100})` }}
            >
              <span className={`h-3.5 w-0.5 rounded-full ${isOpen ? 'bg-attention' : 'bg-key'}`} />
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 font-mono text-[11px] text-zinc-500">{summaryOf(group, tokens)}</p>
      )}

      <button type="button" aria-expanded={tune} onClick={() => setTune((t) => !t)} className="mt-2 flex h-6 cursor-pointer items-center gap-1 text-[11.5px] font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        <ChevronRight size={13} className={`transition-transform duration-200 ${tune ? 'rotate-90' : ''}`} /> Fine-tune
      </button>
      {tune && (
        <div className="animate-rise pt-2">
          <GroupTokens group={group} />
        </div>
      )}
    </section>
  )
}

/** Contrast as level meters: one bar per pair, AA at 4.5:1 marked. */
function Master() {
  const pairs = useContrast()
  return (
    <section className="mx-3 my-2 rounded-2xl bg-zinc-900 p-3 text-white shadow-[0_8px_20px_-10px_rgb(0_0_0/0.5)]">
      <header className="mb-2 flex items-center justify-between text-[12px]">
        <span className="font-semibold">Contrast</span>
        <span className="text-white/50">AA at 4.5:1</span>
      </header>
      <div className="grid gap-1.5">
        {pairs.map((p) => {
          const n = Math.min(16, Math.round((p.ratio ?? 0) * 1.2))
          return (
            <div key={p.label} className="grid grid-cols-[96px_1fr_48px] items-center gap-2 text-[11px]">
              <span className="truncate text-white/70">{p.label}</span>
              <span className="flex gap-[3px]">
                {Array.from({ length: 16 }, (_, i) => (
                  <i key={i} className={`h-3 flex-1 rounded-[2px] ${i < n ? (i < 5 ? 'bg-red-400' : i < 8 ? 'bg-amber-300' : 'bg-key') : 'bg-white/10'}`} />
                ))}
              </span>
              <span className={`text-right font-mono ${p.ok ? 'text-white' : 'text-red-300'}`}>{p.ratio ?? '?'}:1</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
