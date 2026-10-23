import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/state/store'

/**
 * Design exploration: how a track shows its alternatives. Today every row shows
 * its neighbours faded off to the left and right, which reads as clutter.
 * Open with ?lab=options.
 */
type Alt = { source: string; title: string; Paint: (p: { mini?: boolean }) => ReactNode }

const ALTS: Alt[] = [
  { source: 'Marginalia', title: 'Editorial split', Paint: HeroEditorial },
  { source: 'Nightowl', title: 'Terminal hero', Paint: HeroTerminal },
  { source: 'Puffin', title: 'Gradient hero', Paint: HeroGradient },
]

export default function LabOptions() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const variants: { letter: string; name: string; notes: string; V: () => ReactNode }[] = [
    { letter: 'A', name: 'Strip in the dock', notes: 'Nothing beside the page. When you’re on a track, the dock shows its alternatives as a row of thumbnails, the way Figma shows variants. Click one to swap.', V: VariantA },
    { letter: 'B', name: 'Deck', notes: 'The alternatives sit stacked behind the section like a deck of tapes, showing only thin edges on the right. Hover fans them out; click to bring one to the front.', V: VariantB },
    { letter: 'C', name: 'Peek on the arrow', notes: 'Only arrows and a dot count. Hovering an arrow shows a small preview of what’s next, so you slide with confidence and the page stays clean.', V: VariantC },
    { letter: 'D', name: 'Gutter thumbnails', notes: 'A short column of thumbnails in the right gutter, for the focused track only, mirroring the rail on the left. The current one is ringed.', V: VariantD },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1240px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Showing a track’s alternatives: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">These replace the faded neighbours beside the page. Each one is clickable: try switching the hero between Marginalia, Nightowl and Puffin.</p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          {variants.map(({ letter, name, notes, V }) => (
            <section key={letter} className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
                <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">{notes}</p>
              <V />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- shared stage ---------- */

function Page({ current, children, right }: { current: number; children?: ReactNode; right?: ReactNode }) {
  const Hero = ALTS[current].Paint
  return (
    <div className="relative flex items-start gap-4 rounded-xl px-10 py-6" style={{ background: 'var(--canvas-bg)' }}>
      {/* the gutter rail on the left, as on the canvas */}
      <div className="flex w-6 flex-col">
        <RailMark n="01" label="Nav" h={34} />
        <RailMark n="02" label="Hero" h={170} active />
        <RailMark n="03" label="Features" h={90} />
      </div>
      <div className="relative w-[300px] shrink-0 overflow-hidden rounded-[10px] bg-[#f6f1e7] shadow-[0_20px_50px_-20px_rgb(0_0_0/0.3)]">
        <div className="flex h-[34px] items-center gap-3 border-b border-[#d6c9b1] px-3 font-serif text-[10px] text-[#1f1a14]">
          Mixtape<span className="ml-auto">Pricing</span>
          <span className="rounded-sm bg-[#7a1f1f] px-1.5 py-0.5 text-[#f6f1e7]">Start</span>
        </div>
        <div className="relative h-[170px] outline-2 -outline-offset-2 outline-tape" style={{ outlineStyle: 'solid' }}>
          <Hero />
          {children}
        </div>
        <div className="h-[90px] border-t border-[#d6c9b1] p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded bg-[#ece4d3]" />
            ))}
          </div>
        </div>
      </div>
      {right}
    </div>
  )
}

function RailMark({ n, label, h, active }: { n: string; label: string; h: number; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 border-r-2 pr-1.5 pt-1" style={{ height: h, borderColor: active ? 'var(--color-tape)' : 'var(--n-200)' }}>
      <span className={`text-[9px] font-bold tabular-nums ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>{n}</span>
      <span className="text-[9px] font-semibold text-zinc-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        {label}
      </span>
    </div>
  )
}

function Thumb({ i, active, onClick, w = 90 }: { i: number; active: boolean; onClick: () => void; w?: number }) {
  const { Paint, source } = ALTS[i]
  return (
    <button type="button" onClick={onClick} className="group shrink-0 text-left" title={`${source}: ${ALTS[i].title}`}>
      <div
        className={`relative overflow-hidden rounded-md ring-2 transition ${active ? 'ring-tape' : 'ring-transparent group-hover:ring-zinc-300'}`}
        style={{ width: w, height: w * 0.57 }}
      >
        <div className="origin-top-left" style={{ width: 300, height: 170, transform: `scale(${w / 300})` }}>
          <Paint mini />
        </div>
      </div>
      <div className={`mt-1 truncate text-[11px] ${active ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`}>{source}</div>
    </button>
  )
}

/* ---------- A. Strip in the dock ---------- */

function VariantA() {
  const [cur, setCur] = useState(0)
  return (
    <div>
      <Page current={cur} />
      <div className="glass-panel mx-auto -mt-2 w-fit rounded-2xl p-2">
        <div className="mb-1.5 flex items-center justify-between px-1 text-[11.5px]">
          <span className="font-semibold text-zinc-900">Hero · alternatives</span>
          <span className="text-zinc-500">
            {cur + 1} of {ALTS.length} · ← →
          </span>
        </div>
        <div className="flex gap-2">
          {ALTS.map((_, i) => (
            <Thumb key={i} i={i} active={i === cur} onClick={() => setCur(i)} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- B. Deck ---------- */

function VariantB() {
  const [cur, setCur] = useState(0)
  const [fan, setFan] = useState(false)
  const others = ALTS.map((_, i) => i).filter((i) => i !== cur)
  return (
    <Page
      current={cur}
      right={
        <div className="relative h-[294px] w-[110px]" onMouseEnter={() => setFan(true)} onMouseLeave={() => setFan(false)}>
          {others.map((i, k) => (
            <button
              key={i}
              type="button"
              onClick={() => setCur(i)}
              className="absolute top-[34px] overflow-hidden rounded-md shadow-md ring-1 ring-zinc-950/10 transition-all duration-200"
              style={{ left: fan ? 6 + k * 52 : -14 + k * 5, width: fan ? 96 : 20, height: fan ? 56 : 170, zIndex: 10 - k, top: fan ? 34 + k * 66 : 34 + k * 4 }}
              title={ALTS[i].source}
            >
              <div className="origin-top-left" style={{ width: 300, height: 170, transform: `scale(${fan ? 96 / 300 : 1})` }}>
                {(() => {
                  const P = ALTS[i].Paint
                  return <P mini />
                })()}
              </div>
            </button>
          ))}
          {!fan && <span className="absolute left-2 top-[210px] text-[10.5px] font-medium text-zinc-500">+{others.length}</span>}
        </div>
      }
    />
  )
}

/* ---------- C. Peek on the arrow ---------- */

function VariantC() {
  const [cur, setCur] = useState(0)
  const [peek, setPeek] = useState<-1 | 1 | null>(null)
  const n = ALTS.length
  const next = (d: -1 | 1) => (cur + d + n) % n
  return (
    <Page current={cur}>
      {([-1, 1] as const).map((d) => (
        <div key={d} className={`absolute top-1/2 -translate-y-1/2 ${d < 0 ? 'left-2' : 'right-2'}`}>
          <button
            type="button"
            onMouseEnter={() => setPeek(d)}
            onMouseLeave={() => setPeek(null)}
            onClick={() => setCur(next(d))}
            className="grid size-8 place-items-center rounded-full border border-zinc-950/10 bg-white text-zinc-800 shadow-md transition hover:scale-110"
          >
            {d < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          {peek === d && (
            <div className={`glass-menu absolute top-1/2 z-10 -translate-y-1/2 rounded-lg p-1 ${d < 0 ? 'left-10' : 'right-10'}`}>
              <Thumb i={next(d)} active={false} onClick={() => setCur(next(d))} w={110} />
            </div>
          )}
        </div>
      ))}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-zinc-900/70 px-2 py-1">
        {ALTS.map((_, i) => (
          <span key={i} className={`size-1.5 rounded-full ${i === cur ? 'bg-white' : 'bg-white/40'}`} />
        ))}
      </div>
    </Page>
  )
}

/* ---------- D. Gutter thumbnails ---------- */

function VariantD() {
  const [cur, setCur] = useState(0)
  return (
    <Page
      current={cur}
      right={
        <div className="flex flex-col gap-2 pt-[38px]">
          {ALTS.map((_, i) => (
            <Thumb key={i} i={i} active={i === cur} onClick={() => setCur(i)} w={84} />
          ))}
        </div>
      }
    />
  )
}

/* ---------- mock heroes ---------- */

function HeroEditorial() {
  return (
    <div className="flex h-[170px] w-[300px] items-center gap-3 bg-[#f6f1e7] px-4">
      <div className="flex-1">
        <div className="font-serif text-[20px] leading-[1.05] text-[#1f1a14]">
          Clip the web.
          <br />
          Mix your site.
        </div>
        <div className="mt-2 h-1.5 w-32 rounded bg-[#1f1a14]/15" />
        <div className="mt-1 h-1.5 w-24 rounded bg-[#1f1a14]/15" />
        <div className="mt-3 h-4 w-16 rounded-sm bg-[#7a1f1f]" />
      </div>
      <div className="grid h-28 w-20 place-items-center rounded bg-[#ece4d3]">
        <div className="size-10 rounded-full bg-[#c2602e]" />
      </div>
    </div>
  )
}

function HeroTerminal() {
  return (
    <div className="flex h-[170px] w-[300px] flex-col items-center justify-center bg-[#0b0d0e] px-4 text-center">
      <div className="text-[18px] font-semibold leading-tight text-[#e8f0ec]">
        Clip the web.
        <br />
        Mix your site.
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className="h-4 w-14 rounded bg-[#3dff8f]" />
        <span className="h-4 w-14 rounded border border-[#252d30]" />
      </div>
      <div className="mt-3 w-48 rounded-md border border-[#252d30] bg-[#14181a] p-1.5 text-left font-mono text-[7px] leading-tight text-[#8a9a93]">
        $ npx create-site --from tape.json
        <br />
        <span className="text-[#3dff8f]">✓ 6 sections composed</span>
      </div>
    </div>
  )
}

function HeroGradient() {
  return (
    <div className="relative flex h-[170px] w-[300px] flex-col items-center justify-center overflow-hidden bg-[#fdfcff] px-4 text-center">
      <div className="absolute -left-6 -top-8 size-32 rounded-full bg-[#7c5cff]/30 blur-2xl" />
      <div className="absolute -right-6 top-6 size-28 rounded-full bg-[#ff8a65]/30 blur-2xl" />
      <div className="relative bg-gradient-to-r from-[#7c5cff] to-[#ff8a65] bg-clip-text text-[19px] font-extrabold leading-tight text-transparent">
        Clip the web.
        <br />
        Mix your site.
      </div>
      <div className="relative mt-2 flex gap-1.5">
        <span className="h-4 w-14 rounded-full bg-[#7c5cff]" />
        <span className="h-4 w-14 rounded-full border border-[#e6e1f7] bg-white" />
      </div>
    </div>
  )
}
