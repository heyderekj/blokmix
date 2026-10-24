import { useState } from 'react'
import { Play } from 'lucide-react'
import type { BlockKind, BlockMotion, EnterPreset, MotionSpeed, SectionMotion, Slot } from '@/core/types'
import { ENTER_INFO, HOVER_INFO, LOOP_INFO, SCROLL_INFO, SPEED_LABEL, canHover, presetsFor } from '@/core/motion'
import { useStore } from '@/state/store'
import { Switch } from '../panels/parts'
import { Steps } from './Spacing'
import { useBlockPreview } from './preview'

type Trigger = 'enter' | 'hover' | 'scroll' | 'loop'

const KIND_NOUN: Record<BlockKind, string> = {
  heading: 'heading',
  text: 'text',
  button: 'button',
  link: 'link',
  badge: 'badge',
  icon: 'icon',
  image: 'image',
  input: 'field',
  banner: 'banner',
  card: 'card',
  item: 'item',
  list: 'list',
}

/** Each phrase says what happens, including when nothing does. */
const PHRASE: Record<Trigger, (v: string | undefined) => string> = {
  enter: (v) =>
    ({ rise: 'rises in', fade: 'fades in', pop: 'pops in', drop: 'drops in', slide: 'slides in', blur: 'sharpens into view', none: 'is already there' })[v ?? ''] ??
    'arrives with its section',
  hover: (v) => ({ lift: 'lifts', glow: 'glows', tilt: 'tilts', zoom: 'grows', nudge: 'nudges forward', underline: 'underlines' })[v ?? ''] ?? 'doesn’t move',
  scroll: (v) => ({ reveal: 'reveals as you scroll', parallax: 'drifts as you scroll' })[v ?? ''] ?? 'ignores scrolling',
  loop: (v) => ({ float: 'floats gently', breathe: 'breathes slowly', spin: 'spins slowly' })[v ?? ''] ?? 'doesn’t loop',
}

/**
 * A block's motion as a sentence you can edit: "This button rises in, lifts on
 * hover, ignores scrolling and doesn't loop." Each phrase opens swatches that
 * perform their preset, and hovering one plays it on the page too.
 */
export function MotionMenu({
  kind,
  motion,
  onHover,
  onPick,
}: {
  kind: BlockKind
  motion?: BlockMotion
  onHover: (m: BlockMotion | null) => void
  onPick: (m: BlockMotion) => void
}) {
  const replay = useBlockPreview((s) => s.replay)
  const hoverable = canHover(kind)
  const [open, setOpen] = useState<Trigger | null>('enter')
  const [plays, setPlays] = useState<Record<string, number>>({})
  const show = (m: BlockMotion | null) => {
    onHover(m)
    if (m) window.setTimeout(replay, 30)
  }
  const pick = (t: Trigger, v: string | undefined) => {
    onPick({ [t]: v } as BlockMotion)
    window.setTimeout(replay, 30)
  }

  const Phrase = ({ t, before, after }: { t: Trigger; before?: string; after?: string }) => {
    const v = motion?.[t] as string | undefined
    return (
      <>
        {before}
        <button
          type="button"
          onClick={() => setOpen(open === t ? null : t)}
          className={`mx-0.5 rounded-md px-1 py-px font-medium underline decoration-dotted decoration-1 underline-offset-[5px] transition ${
            open === t ? 'bg-zinc-900 text-white decoration-transparent' : v ? 'bg-key/15 text-zinc-900 hover:bg-key/25' : 'text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-800'
          }`}
        >
          {PHRASE[t](v)}
          {t === 'hover' && ' on hover'}
        </button>
        {after}
      </>
    )
  }

  const options: { id: string | undefined; label: string; hint: string }[] =
    open === 'enter'
      ? [{ id: undefined, label: 'With section', hint: 'Follows the section’s entrance' }, ...ENTER_INFO, { id: 'none', label: 'None', hint: 'Already there; no entrance' }]
      : open === 'hover'
        ? [{ id: undefined, label: 'Still', hint: 'Doesn’t move on hover' }, ...presetsFor(HOVER_INFO, kind)]
        : open === 'scroll'
          ? [{ id: undefined, label: 'Ignore', hint: 'Doesn’t react to scrolling' }, ...presetsFor(SCROLL_INFO, kind)]
          : open === 'loop'
            ? [{ id: undefined, label: 'No loop', hint: 'Stays put once it’s in' }, ...presetsFor(LOOP_INFO, kind)]
            : []

  return (
    <div className="glass-menu w-[340px] animate-pop rounded-2xl p-3">
      <p className="text-[14px] leading-[1.95] text-zinc-600">
        This {KIND_NOUN[kind]} <Phrase t="enter" after="," /> {hoverable && <Phrase t="hover" after="," />} <Phrase t="scroll" /> and <Phrase t="loop" after="." />
      </p>

      {open && (
        <div className="mt-2.5 grid grid-cols-4 gap-1 border-t border-zinc-950/6 pt-2.5" onMouseLeave={() => show(null)}>
          {options.map((o) => {
            const on = (motion?.[open] as string | undefined) === o.id
            return (
              <button
                key={o.id ?? 'default'}
                type="button"
                title={o.hint}
                onMouseEnter={() => {
                  setPlays((p) => ({ ...p, [o.id ?? 'default']: (p[o.id ?? 'default'] ?? 0) + 1 }))
                  show({ [open]: o.id } as BlockMotion)
                }}
                onClick={() => pick(open, o.id)}
                className="group flex flex-col items-center gap-1 rounded-xl p-1 transition active:scale-[0.97]"
              >
                <span
                  className={`grid h-11 w-full place-items-center overflow-hidden rounded-lg transition ${on ? 'bg-zinc-900/[0.07] ring-[1.5px] ring-zinc-900' : 'bg-zinc-950/[0.04] group-hover:bg-zinc-950/[0.07]'}`}
                >
                  <SwatchShape kind={kind} trigger={open} preset={o.id} play={plays[o.id ?? 'default'] ?? 0} />
                </span>
                <span className={`text-[11px] leading-tight ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{o.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2 border-t border-zinc-950/6 pt-2.5">
        <span className="text-[11px] font-semibold text-zinc-400">Speed</span>
        <div className="flex-1">
          <Steps
            options={(['quick', 'normal', 'slow'] as const).map((v) => ({ v, label: SPEED_LABEL[v] }))}
            value={motion?.speed ?? 'normal'}
            onPick={(v: MotionSpeed) => {
              onPick({ speed: v === 'normal' ? undefined : v })
              window.setTimeout(replay, 30)
            }}
          />
        </div>
        <button type="button" onClick={replay} title="Play again" className="grid size-7 place-items-center rounded-full text-zinc-600 hover:bg-zinc-950/5">
          <Play size={13} />
        </button>
      </div>
    </div>
  )
}

/** A tiny stand-in for the block that performs a preset: entrances replay when `play` changes. */
function SwatchShape({ kind, trigger, preset, play }: { kind: BlockKind; trigger: Trigger; preset: string | undefined; play: number }) {
  const shape =
    kind === 'image' || kind === 'card' || kind === 'item'
      ? 'h-6 w-8 rounded-[5px]'
      : kind === 'heading' || kind === 'text' || kind === 'link'
        ? 'h-1.5 w-9 rounded-full'
        : kind === 'icon'
          ? 'size-5 rounded-md'
          : 'h-3 w-9 rounded-full'
  const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'
  let anim: string | undefined
  let cls = ''
  if (trigger === 'enter' && preset && preset !== 'none') anim = `sw-${preset} 520ms ${ease} both`
  if (trigger === 'enter' && !preset) anim = `sw-rise 520ms ${ease} both`
  if (trigger === 'hover' && preset) cls = `sw-hover sw-hover-${preset}`
  if (trigger === 'scroll' && preset) anim = preset === 'reveal' ? 'sw-reveal 2.2s ease-out infinite' : 'sw-parallax 1.6s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate'
  if (trigger === 'loop' && preset)
    anim = preset === 'spin' ? 'sw-spin 3s linear infinite' : `sw-${preset} 1.2s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate`
  const muted = (trigger === 'enter' && !preset) || !preset
  return <span key={trigger === 'enter' ? play : undefined} className={`block ${shape} ${muted ? 'bg-zinc-400' : 'bg-zinc-900'} ${cls}`} style={{ animation: anim }} />
}

/** A whole section's motion: as clipped, a preset (optionally staggered and on scroll), or none. */
export function SectionMotionRows({ slot }: { slot: Slot }) {
  const st = useStore.getState
  const replay = useBlockPreview((s) => s.replay)
  const m: SectionMotion = slot.motion ?? { mode: slot.keep.motion ? 'captured' : 'none' }
  const set = (next: SectionMotion | null) => {
    st().setSectionMotion(slot.id, next)
    window.setTimeout(replay, 40)
  }
  const preset = m.mode === 'preset' ? m : { mode: 'preset' as const, enter: 'rise' as EnterPreset, stagger: true }
  return (
    <div className="space-y-2">
      <Steps
        options={[
          { v: 'captured', label: 'As clipped' },
          { v: 'preset', label: 'Preset' },
          { v: 'none', label: 'None' },
        ]}
        value={m.mode}
        onPick={(v) => set(v === 'captured' ? null : v === 'none' ? { mode: 'none' } : preset)}
      />
      {m.mode === 'preset' && (
        <>
          <div className="flex flex-wrap gap-1">
            {ENTER_INFO.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={(e) => {
                  e.stopPropagation()
                  set({ ...m, enter: p.id })
                }}
                className={`h-7 rounded-full px-2.5 text-[12px] font-semibold transition active:scale-[0.97] ${(m.enter ?? 'rise') === p.id ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[12px] text-zinc-600">
            One after another
            <Switch on={!!m.stagger} onChange={() => set({ ...m, stagger: !m.stagger })} label="Stagger blocks" />
          </div>
          <div className="flex items-center justify-between text-[12px] text-zinc-600">
            When scrolled into view
            <Switch on={!!m.onScroll} onChange={() => set({ ...m, onScroll: !m.onScroll })} label="Play on scroll" />
          </div>
          <Steps
            options={(['quick', 'normal', 'slow'] as const).map((v) => ({ v, label: SPEED_LABEL[v] }))}
            value={m.speed ?? 'normal'}
            onPick={(v: MotionSpeed) => set({ ...m, speed: v === 'normal' ? undefined : v })}
          />
        </>
      )}
    </div>
  )
}
