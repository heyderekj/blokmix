import { useState, type ReactNode } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import type { BlockMotion, EnterPreset, HoverPreset, LoopPreset, MotionSpeed, ScrollPreset } from '@/core/types'
import { ENTER_INFO, ENTER_MS, HOVER_INFO, LOOP_INFO, SCROLL_INFO, SPEED_LABEL, presetsFor } from '@/core/motion'
import { useStore } from '@/state/store'

/**
 * Design exploration: how to represent a block's motion. Today it's four rows
 * of word chips; these try showing the motion itself. Open with ?lab=motion.
 */
export default function LabMotion() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const variants: { letter: string; name: string; notes: string; V: () => ReactNode }[] = [
    { letter: 'A', name: 'Motion swatches', notes: 'Every preset is a tiny tile that performs itself: entrances replay when you hover them, hovers react, loops loop. You pick by feel, not by name.', V: VariantA },
    { letter: 'B', name: 'Trigger rows', notes: 'Like Figma’s prototype panel: one row per trigger (On enter, On hover, On scroll, Loop), each a compact dropdown with its timing. Quiet until you need it.', V: VariantB },
    { letter: 'C', name: 'Stage + tabs', notes: 'Pick a trigger tab, watch a preview stage play the block, and choose from a list with hints. Speed is a dial with real milliseconds.', V: VariantC },
    { letter: 'D', name: 'Sentence', notes: 'Motion as a sentence you can edit: “Rises in, lifts on hover, reveals on scroll.” Each phrase is a chip that opens its options.', V: VariantD },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <style>{DEMO_CSS}</style>
      <div className="mx-auto max-w-[1240px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Motion: four ways to show it</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">For a selected button. Hover the options; they move the way the preset would.</p>
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

/* ---------- live demo pieces ---------- */

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
const DEMO_CSS = `
@keyframes demo-rise { from { opacity: 0; translate: 0 10px; } }
@keyframes demo-fade { from { opacity: 0; } }
@keyframes demo-pop { from { opacity: 0; scale: 0.9; } }
@keyframes demo-drop { from { opacity: 0; translate: 0 -10px; } }
@keyframes demo-slide { from { opacity: 0; translate: -14px 0; } }
@keyframes demo-blur { from { opacity: 0; filter: blur(6px); } }
@keyframes demo-float { from { translate: 0 -3px; } to { translate: 0 3px; } }
@keyframes demo-breathe { from { scale: 1; } to { scale: 1.06; } }
@keyframes demo-spin { to { rotate: 1turn; } }
@keyframes demo-reveal { 0%, 30% { opacity: 0; translate: 0 10px; } 70%, 100% { opacity: 1; translate: 0 0; } }
@keyframes demo-scrollpage { from { translate: 0 30%; } to { translate: 0 -30%; } }
.demo-hover { transition: translate 200ms ${EASE}, box-shadow 200ms ${EASE}, rotate 200ms ${EASE}, scale 200ms ${EASE}, background-size 260ms ${EASE}; }
.group:hover .demo-hover-lift { translate: 0 -3px; box-shadow: 0 10px 18px -8px rgb(0 0 0 / 0.45); }
.group:hover .demo-hover-glow { box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-tape) 30%, transparent), 0 6px 18px -6px var(--color-tape); }
.group:hover .demo-hover-tilt { rotate: -4deg; }
.group:hover .demo-hover-zoom { scale: 1.08; }
.group:hover .demo-hover-nudge { translate: 3px 0; }
.demo-hover-underline { background: linear-gradient(currentColor, currentColor) no-repeat 0 100% / 0 1.5px; }
.group:hover .demo-hover-underline { background-size: 100% 1.5px; }
`

/** A little pill standing in for the selected button. */
function Chip({ className = '', style, small }: { className?: string; style?: React.CSSProperties; small?: boolean }) {
  return <span className={`inline-block rounded-full bg-zinc-900 ${small ? 'h-3 w-8' : 'h-5 w-14'} ${className}`} style={style} />
}

/** Plays an entrance whenever `play` changes. */
function Enter({ preset, play, speed = 'normal', small }: { preset: EnterPreset | 'none' | undefined; play: number; speed?: MotionSpeed; small?: boolean }) {
  const anim = preset && preset !== 'none' ? `demo-${preset} ${ENTER_MS[speed]}ms ${EASE} both` : undefined
  return <Chip key={play} small={small} style={{ animation: anim }} />
}

function Loop({ preset, small }: { preset: LoopPreset; small?: boolean }) {
  const anim = preset === 'spin' ? 'demo-spin 4s linear infinite' : `demo-${preset} 1.4s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate`
  return <Chip small={small} style={{ animation: anim }} />
}

function useMotion() {
  return useState<BlockMotion>({ hover: 'lift' })
}

const ENTERS = ENTER_INFO
const HOVERS = presetsFor(HOVER_INFO, 'button')
const SCROLLS = presetsFor(SCROLL_INFO, 'button')
const LOOPS = presetsFor(LOOP_INFO, 'button')

const panel = 'glass-menu rounded-2xl p-2'

/* ---------- A: swatches ---------- */

function Swatch({ label, on, onClick, children, onEnter }: { label: string; on: boolean; onClick: () => void; children: ReactNode; onEnter?: () => void }) {
  return (
    <button type="button" onClick={onClick} onMouseEnter={onEnter} className={`group flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${on ? 'bg-zinc-900/[0.06] ring-1.5 ring-zinc-900' : 'hover:bg-zinc-950/5'}`}>
      <span className={`grid h-11 w-full place-items-center overflow-hidden rounded-lg bg-zinc-950/[0.04] ${on ? 'ring-1 ring-zinc-900/60' : ''}`}>{children}</span>
      <span className={`text-[11px] ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{label}</span>
    </button>
  )
}

function VariantA() {
  const [m, setM] = useMotion()
  const [plays, setPlays] = useState<Record<string, number>>({})
  const replay = (id: string) => setPlays((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }))
  const Title = ({ children }: { children: ReactNode }) => <div className="px-1 pb-1 pt-1.5 text-[11px] font-semibold text-zinc-400">{children}</div>
  return (
    <div className={`${panel} w-[340px]`}>
      <Title>Enter</Title>
      <div className="grid grid-cols-4 gap-1">
        {[...ENTERS, { id: 'none' as const, label: 'None', hint: '' }].map((p) => (
          <Swatch key={p.id} label={p.label} on={m.enter === p.id} onClick={() => setM({ ...m, enter: p.id })} onEnter={() => replay(p.id)}>
            <Enter preset={p.id} play={plays[p.id] ?? 0} small />
          </Swatch>
        ))}
      </div>
      <Title>Hover</Title>
      <div className="grid grid-cols-4 gap-1">
        {HOVERS.map((p) => (
          <Swatch key={p.id} label={p.label} on={m.hover === p.id} onClick={() => setM({ ...m, hover: m.hover === p.id ? undefined : p.id })}>
            <Chip small className={`demo-hover demo-hover-${p.id}`} />
          </Swatch>
        ))}
      </div>
      <Title>Loop</Title>
      <div className="grid grid-cols-4 gap-1">
        {LOOPS.map((p) => (
          <Swatch key={p.id} label={p.label} on={m.loop === p.id} onClick={() => setM({ ...m, loop: m.loop === p.id ? undefined : p.id })}>
            <Loop preset={p.id} small />
          </Swatch>
        ))}
        {SCROLLS.map((p) => (
          <Swatch key={p.id} label={`${p.label} on scroll`} on={m.scroll === p.id} onClick={() => setM({ ...m, scroll: m.scroll === p.id ? undefined : p.id })}>
            <Chip small style={{ animation: 'demo-reveal 2.4s ease-out infinite' }} />
          </Swatch>
        ))}
      </div>
    </div>
  )
}

/* ---------- B: trigger rows ---------- */

function VariantB() {
  const [m, setM] = useMotion()
  const [open, setOpen] = useState<keyof BlockMotion | null>(null)
  const rows: { key: 'enter' | 'hover' | 'scroll' | 'loop'; label: string; list: { id: string; label: string }[]; timing: string }[] = [
    { key: 'enter', label: 'On enter', list: [...ENTERS, { id: 'none', label: 'None' }], timing: `${ENTER_MS[m.speed ?? 'normal']}ms · ease-out` },
    { key: 'hover', label: 'On hover', list: HOVERS, timing: '200ms · ease-out' },
    { key: 'scroll', label: 'On scroll', list: SCROLLS, timing: 'scroll-linked' },
    { key: 'loop', label: 'Loop', list: LOOPS, timing: '3.6s · in-out' },
  ]
  return (
    <div className={`${panel} w-[340px] p-1.5`}>
      {rows.map((r) => {
        const val = m[r.key] as string | undefined
        const label = val ? r.list.find((x) => x.id === val)?.label : r.key === 'enter' ? 'Section’s' : 'None'
        return (
          <div key={r.key}>
            <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-zinc-950/5">
              <span className="w-20 text-[12.5px] font-medium text-zinc-500">{r.label}</span>
              <span className={`flex-1 text-[13px] font-semibold ${val ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</span>
              {val && <span className="font-mono text-[10.5px] text-zinc-400">{r.timing}</span>}
              <ChevronDown size={13} className="text-zinc-400" />
            </button>
            {open === r.key && (
              <div className="mb-1 ml-[88px] mr-1 overflow-hidden rounded-lg ring-1 ring-zinc-950/8">
                {[{ id: undefined as string | undefined, label: r.key === 'enter' ? 'Section’s' : 'None' }, ...r.list].map((p) => (
                  <button
                    key={p.id ?? 'x'}
                    type="button"
                    onClick={() => {
                      setM({ ...m, [r.key]: p.id })
                      setOpen(null)
                    }}
                    className={`block w-full px-2.5 py-1.5 text-left text-[12.5px] ${val === p.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="mt-1 flex items-center gap-2 border-t border-zinc-950/6 px-2 pt-2">
        <span className="w-20 text-[12.5px] font-medium text-zinc-500">Speed</span>
        <SpeedSteps value={m.speed ?? 'normal'} onPick={(speed) => setM({ ...m, speed })} />
      </div>
    </div>
  )
}

/* ---------- C: stage + tabs ---------- */

function VariantC() {
  const [m, setM] = useMotion()
  const [tab, setTab] = useState<'enter' | 'hover' | 'scroll' | 'loop'>('enter')
  const [play, setPlay] = useState(0)
  const list: { id: string; label: string; hint: string }[] =
    tab === 'enter' ? [...ENTERS, { id: 'none', label: 'None', hint: 'Already there' }] : tab === 'hover' ? HOVERS : tab === 'scroll' ? SCROLLS : LOOPS
  const val = m[tab] as string | undefined
  return (
    <div className={`${panel} w-[360px]`}>
      <div className="flex rounded-full bg-chip p-0.5">
        {(['enter', 'hover', 'scroll', 'loop'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`h-7 flex-1 rounded-full text-[12px] font-semibold capitalize ${tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
            {t}
            {m[t] && <span className="ml-1 inline-block size-1.5 rounded-full bg-tape align-middle" />}
          </button>
        ))}
      </div>
      <div className="group my-2 grid h-24 place-items-center rounded-xl bg-[linear-gradient(135deg,#f4eee4,#ebe2d3)] ring-1 ring-zinc-950/6">
        {tab === 'enter' && <Enter preset={(m.enter as EnterPreset) ?? 'rise'} play={play} speed={m.speed} />}
        {tab === 'hover' && <Chip className={`demo-hover demo-hover-${m.hover ?? 'none'}`} />}
        {tab === 'scroll' && <Chip style={{ animation: m.scroll ? 'demo-reveal 2.4s ease-out infinite' : undefined }} />}
        {tab === 'loop' && (m.loop ? <Loop preset={m.loop} /> : <Chip />)}
      </div>
      <div className="max-h-44 overflow-auto">
        {[{ id: undefined as string | undefined, label: tab === 'enter' ? 'Section’s' : 'None', hint: tab === 'enter' ? 'Follows the section' : '' }, ...list].map((p) => (
          <button
            key={p.id ?? 'x'}
            type="button"
            onMouseEnter={() => {
              setM({ ...m, [tab]: p.id })
              setPlay((n) => n + 1)
            }}
            onClick={() => setM({ ...m, [tab]: p.id })}
            className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left ${val === p.id ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/5'}`}
          >
            <span className="w-16 text-[12.5px] font-semibold text-zinc-900">{p.label}</span>
            <span className="truncate text-[11.5px] text-zinc-500">{p.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="text-[11px] font-semibold text-zinc-400">Speed</span>
        <input type="range" min={0} max={2} step={1} value={['quick', 'normal', 'slow'].indexOf(m.speed ?? 'normal')} onChange={(e) => setM({ ...m, speed: (['quick', 'normal', 'slow'] as const)[+e.target.value] })} className="flex-1 accent-zinc-900" />
        <span className="w-14 text-right font-mono text-[11px] text-zinc-500">{ENTER_MS[m.speed ?? 'normal']}ms</span>
        <button type="button" onClick={() => setPlay((n) => n + 1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-950/5">
          <Play size={13} />
        </button>
      </div>
    </div>
  )
}

/* ---------- D: sentence ---------- */

function VariantD() {
  const [m, setM] = useMotion()
  const [open, setOpen] = useState<'enter' | 'hover' | 'scroll' | 'loop' | null>(null)
  const verb: Record<string, string> = { rise: 'rises in', fade: 'fades in', pop: 'pops in', drop: 'drops in', slide: 'slides in', blur: 'sharpens in', none: 'is already there' }
  const hoverVerb: Record<HoverPreset, string> = { lift: 'lifts', glow: 'glows', tilt: 'tilts', zoom: 'grows', nudge: 'nudges forward', underline: 'underlines' }
  const scrollVerb: Record<ScrollPreset, string> = { reveal: 'reveals on scroll', parallax: 'drifts on scroll' }
  const loopVerb: Record<LoopPreset, string> = { float: 'floats', breathe: 'breathes', spin: 'spins' }
  const Phrase = ({ k, text, set }: { k: 'enter' | 'hover' | 'scroll' | 'loop'; text: string; set: boolean }) => (
    <button type="button" onClick={() => setOpen(open === k ? null : k)} className={`mx-0.5 rounded-md px-1 underline decoration-dotted underline-offset-4 ${set ? 'bg-tape/15 text-zinc-900' : 'text-zinc-400'} ${open === k ? 'ring-1 ring-zinc-900' : ''}`}>
      {text}
    </button>
  )
  const options =
    open === 'enter' ? [...ENTERS, { id: 'none', label: 'None' }] : open === 'hover' ? HOVERS : open === 'scroll' ? SCROLLS : open === 'loop' ? LOOPS : []
  return (
    <div className={`${panel} w-[340px] p-3`}>
      <p className="text-[15px] leading-[1.9] text-zinc-700">
        This button <Phrase k="enter" set={!!m.enter} text={m.enter ? verb[m.enter] : 'arrives with its section'} />,{' '}
        <Phrase k="hover" set={!!m.hover} text={m.hover ? `${hoverVerb[m.hover]} on hover` : 'stays still on hover'} />,{' '}
        <Phrase k="scroll" set={!!m.scroll} text={m.scroll ? scrollVerb[m.scroll] : 'ignores scroll'} /> and{' '}
        <Phrase k="loop" set={!!m.loop} text={m.loop ? `${loopVerb[m.loop]} gently` : 'rests'} />.
      </p>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-950/6 pt-2">
          {[{ id: undefined as string | undefined, label: open === 'enter' ? 'Section’s' : 'None' }, ...options].map((p) => (
            <button
              key={p.id ?? 'x'}
              type="button"
              onClick={() => {
                setM({ ...m, [open]: p.id })
                setOpen(null)
              }}
              className={`h-7 rounded-full px-2.5 text-[12px] font-semibold ${(m[open] as string | undefined) === p.id ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-zinc-950/6 pt-2">
        <span className="text-[11px] font-semibold text-zinc-400">Speed</span>
        <SpeedSteps value={m.speed ?? 'normal'} onPick={(speed) => setM({ ...m, speed })} />
      </div>
    </div>
  )
}

function SpeedSteps({ value, onPick }: { value: MotionSpeed; onPick: (v: MotionSpeed) => void }) {
  return (
    <div className="flex flex-1 rounded-full bg-chip p-0.5">
      {(['quick', 'normal', 'slow'] as const).map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className={`h-6 flex-1 rounded-full text-[11.5px] font-semibold ${value === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
          {SPEED_LABEL[v]}
        </button>
      ))}
    </div>
  )
}
