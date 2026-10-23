import { useState, type ReactNode } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { useStore } from '@/state/store'

/**
 * Design exploration: how a track is labelled when you're NOT on it. Today the
 * resting pill sits on top of the design and takes a lot of room. Each
 * direction here keeps the page visible. Open with ?lab=pill.
 */
type Track = { n: number; type: string; source: string; pos: string; locked?: boolean; h: number; paint: ReactNode }

const TRACKS: Track[] = [
  { n: 1, type: 'Nav', source: 'Monolith Supply', pos: '2 of 3', h: 54, paint: <NavPaint /> },
  { n: 2, type: 'Hero', source: 'Marginalia', pos: '1 of 3', locked: true, h: 210, paint: <HeroPaint /> },
  { n: 3, type: 'Features', source: 'Puffin', pos: '3 of 3', h: 170, paint: <FeaturesPaint /> },
]

export default function LabPill() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const variants: { letter: string; name: string; notes: string; Label: (p: { t: Track; hover: boolean }) => ReactNode }[] = [
    { letter: 'A', name: 'Tab on the seam', notes: 'A small tab hangs on the line between tracks: number and name only. It covers a sliver of the page edge, never the content.', Label: LabelA },
    { letter: 'B', name: 'Gutter rail', notes: 'Labels move off the page into the gutter on the left, as a quiet vertical rail. The page is completely clear.', Label: LabelB },
    { letter: 'C', name: 'Hover to reveal', notes: 'At rest there’s only a hairline between tracks and a tiny number. Hovering a track fades in its name and source.', Label: LabelC },
    { letter: 'D', name: 'Numbered dot', notes: 'A numbered dot sits on the page edge, half outside. Hovering it grows a small label. The most minimal.', Label: LabelD },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1200px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Track labels at rest: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          These replace the resting pill (when you’re not on a track). The focused track still opens the full two-tier pill. Hover the tracks to see each one respond.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          {variants.map((v) => (
            <section key={v.letter} className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{v.letter}</span>
                <h2 className="text-[15px] font-semibold text-zinc-900">{v.name}</h2>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">{v.notes}</p>
              <Stage Label={v.Label} />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stage({ Label }: { Label: (p: { t: Track; hover: boolean }) => ReactNode }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="relative overflow-hidden rounded-xl py-6 pl-16 pr-10" style={{ background: 'var(--canvas-bg)' }}>
      {/* ghost neighbors, like the canvas */}
      <div className="absolute left-[-180px] top-6 w-[200px] opacity-25">
        {TRACKS.map((t) => (
          <div key={t.n} style={{ height: t.h }} className="bg-[#0b0d0e]/80" />
        ))}
      </div>
      <div className="relative overflow-hidden rounded-[10px] bg-[#f6f1e7] shadow-[0_20px_50px_-20px_rgb(0_0_0/0.3)]">
        {TRACKS.map((t) => (
          <div key={t.n} className="relative" style={{ height: t.h }} onMouseEnter={() => setHover(t.n)} onMouseLeave={() => setHover(null)}>
            {t.paint}
          </div>
        ))}
      </div>
      {/* labels sit in their own layer so outside-the-page variants can escape the clip */}
      <div className="pointer-events-none absolute inset-0 py-6 pl-16 pr-10">
        <div className="relative">
          {TRACKS.reduce<{ top: number; el: ReactNode[] }>(
            (acc, t) => {
              acc.el.push(
                <div key={t.n} className="pointer-events-auto absolute inset-x-0" style={{ top: acc.top, height: t.h }} onMouseEnter={() => setHover(t.n)} onMouseLeave={() => setHover(null)}>
                  <Label t={t} hover={hover === t.n} />
                </div>,
              )
              acc.top += t.h
              return acc
            },
            { top: 0, el: [] },
          ).el}
        </div>
      </div>
    </div>
  )
}

/* ---------- A. Tab on the seam ---------- */

function LabelA({ t, hover }: { t: Track; hover: boolean }) {
  return (
    <div className="absolute left-3 top-0 -translate-y-1/2">
      <span className={`glass-menu flex h-6 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[11.5px] transition ${hover ? 'shadow-md' : ''}`}>
        <span className="grid size-4 place-items-center rounded-full bg-zinc-900 text-[9.5px] font-bold text-white">{t.n}</span>
        <span className="font-semibold text-zinc-900">{t.type}</span>
        {hover && <span className="text-zinc-500">{t.source}</span>}
        {t.locked && <Lock size={10} className="text-key-ink" strokeWidth={2.6} />}
      </span>
    </div>
  )
}

/* ---------- B. Gutter rail ---------- */

function LabelB({ t, hover }: { t: Track; hover: boolean }) {
  return (
    <div className="absolute -left-12 top-0 flex h-full w-9 flex-col items-center gap-1.5 border-r-2 py-2 transition-colors" style={{ borderColor: hover ? 'var(--color-tape)' : 'var(--n-200)' }}>
      <span className={`text-[11px] font-bold tabular-nums ${hover ? 'text-zinc-900' : 'text-zinc-400'}`}>{String(t.n).padStart(2, '0')}</span>
      <span className="text-[11px] font-semibold text-zinc-600" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        {t.type}
      </span>
      {t.locked && <Lock size={11} className="mt-auto text-zinc-500" />}
    </div>
  )
}

/* ---------- C. Hover to reveal ---------- */

function LabelC({ t, hover }: { t: Track; hover: boolean }) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-px bg-zinc-950/10" />
      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[10.5px] font-bold tabular-nums transition ${hover ? 'bg-zinc-900 text-white' : 'bg-white/70 text-zinc-500'}`}>{t.n}</span>
        <span className={`glass-menu flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] transition-all duration-150 ${hover ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0'}`}>
          <span className="font-semibold text-zinc-900">{t.type}</span>
          <span className="text-zinc-500">
            {t.source} · {t.pos}
          </span>
          {t.locked ? <Lock size={11} className="text-key-ink" /> : <LockOpen size={11} className="text-zinc-400" />}
        </span>
      </div>
    </>
  )
}

/* ---------- D. Numbered dot ---------- */

function LabelD({ t, hover }: { t: Track; hover: boolean }) {
  return (
    <div className="absolute left-0 top-3 flex -translate-x-1/2 items-center">
      <span className={`grid size-6 place-items-center rounded-full text-[10.5px] font-bold tabular-nums shadow-sm ring-2 ring-[var(--canvas-bg)] transition ${t.locked ? 'bg-key text-key-ink' : 'bg-zinc-900 text-white'}`}>{t.n}</span>
      <span
        className={`glass-menu ml-1.5 flex h-6 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full text-[11.5px] transition-all duration-150 ${
          hover ? 'max-w-60 px-2.5 opacity-100' : 'max-w-0 px-0 opacity-0'
        }`}
      >
        <span className="font-semibold text-zinc-900">{t.type}</span>
        <span className="text-zinc-500">{t.source}</span>
      </span>
    </div>
  )
}

/* ---------- page mock ---------- */

function NavPaint() {
  return (
    <div className="flex h-full items-center gap-6 border-b border-[#d6c9b1] px-5 font-serif text-[13px] text-[#1f1a14]">
      <span className="text-[16px]">Mixtape</span>
      <span className="ml-auto">How it works</span>
      <span>Pricing</span>
      <span className="rounded-sm bg-[#7a1f1f] px-2.5 py-1 text-[#f6f1e7]">Start a tape</span>
    </div>
  )
}

function HeroPaint() {
  return (
    <div className="flex h-full items-center gap-6 px-6">
      <div className="flex-1">
        <div className="font-serif text-[30px] leading-[1.05] text-[#1f1a14]">
          Clip the web.
          <br />
          Mix your site.
        </div>
        <div className="mt-3 h-2 w-48 rounded bg-[#1f1a14]/15" />
        <div className="mt-1.5 h-2 w-40 rounded bg-[#1f1a14]/15" />
        <div className="mt-4 h-6 w-24 rounded-sm bg-[#7a1f1f]" />
      </div>
      <div className="grid h-36 w-28 place-items-center rounded bg-[#ece4d3]">
        <div className="size-14 rounded-full bg-[#c2602e]" />
      </div>
    </div>
  )
}

function FeaturesPaint() {
  return (
    <div className="h-full border-t border-[#d6c9b1] px-6 py-5">
      <div className="mx-auto mb-3 w-fit font-serif text-[18px] text-[#1f1a14]">From scattered inspo to a real build</div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-[#ece4d3]" />
        ))}
      </div>
    </div>
  )
}
