import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { BlockKind, BlockMotion, EnterPreset, MotionSpeed, SectionMotion, Slot } from '@/core/types'
import { ENTER_INFO, HOVER_INFO, LOOP_INFO, SCROLL_INFO, SPEED_LABEL, canHover, presetsFor } from '@/core/motion'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { Switch } from '../panels/parts'
import { Steps } from './Spacing'
import { StepSlider, StyleRow } from '../panels/StyleRows'
import { Strip } from '../panels/Strip'
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
  bare,
}: {
  kind: BlockKind
  motion?: BlockMotion
  /** In a panel rather than a floating menu. */
  bare?: boolean
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
    <div className={bare ? '' : 'glass-menu w-[340px] animate-pop rounded-2xl p-3'}>
      <p className="text-[14px] leading-[1.95] text-zinc-600">
        This {KIND_NOUN[kind]} <Phrase t="enter" after="," /> {hoverable && <Phrase t="hover" after="," />} <Phrase t="scroll" /> and <Phrase t="loop" after="." />
      </p>

      {open && bare && (
        // In the panel, one sideways row instead of a tall grid.
        <div className="mt-2.5 border-t border-zinc-950/6 pt-2.5" onMouseLeave={() => show(null)}>
          <Strip label="Motion" watch={open}>
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
                data-on={on || undefined}
                className={`group flex flex-col items-center gap-1 rounded-xl p-1 transition active:scale-[0.97] ${bare ? 'w-[68px] shrink-0 snap-start' : ''}`}
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
          </Strip>
        </div>
      )}
      {open && !bare && (
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
                data-on={on || undefined}
                className={`group flex flex-col items-center gap-1 rounded-xl p-1 transition active:scale-[0.97] ${bare ? 'w-[68px] shrink-0 snap-start' : ''}`}
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
export function SectionMotionRows({ slot, untitled }: { slot: Slot; untitled?: boolean }) {
  const st = useStore.getState
  const replay = useBlockPreview((s) => s.replay)
  const m: SectionMotion = slot.motion ?? { mode: slot.keep.motion ? 'captured' : 'none' }
  const set = (next: SectionMotion | null) => {
    st().setSectionMotion(slot.id, next)
    window.setTimeout(replay, 40)
  }
  const row = useRef<HTMLDivElement>(null)
  const layout = library.clips[slot.clipId]?.origin === 'layout'
  // A built-in layout has no motion of its own: "as it comes" is the skin's, which is nothing at all if the skin has none.
  const fromSkin = useStore((s) => s.guide.sections?.[slot.type]?.motion)
  const skinEnter = fromSkin?.mode === 'preset' ? (fromSkin.enter ?? 'rise') : null
  const skinName = useStore((s) => s.guide.skin?.name)
  const asComes = !layout || !!skinEnter
  const on = m.mode === 'preset' ? (m.enter ?? 'rise') : m.mode === 'captured' && !asComes ? 'none' : m.mode
  const tiles: { id: string; label: string; hint: string }[] = [
    { id: 'none', label: 'None', hint: 'Still' },
    ...(!asComes ? [] : layout ? [{ id: 'captured', label: 'From the theme', hint: `What ${skinName ?? 'the theme'} does: ${ENTER_INFO.find((e) => e.id === skinEnter)?.label ?? 'Rise'}` }] : [{ id: 'captured', label: 'Original', hint: 'The motion it came with' }]),
    ...ENTER_INFO,
  ]
  const pick = (id: string) => {
    if (id === 'captured') {
      if (!slot.keep.motion) st().toggleKeep(slot.id, 'motion')
      set(null)
    }
    else if (id === 'none') set(asComes ? { mode: 'none' } : null)
    else set({ stagger: true, ...(m.mode === 'preset' ? m : {}), mode: 'preset', enter: id as EnterPreset })
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-400">{untitled ? '' : 'Motion'}</span>
        <span className="flex gap-0.5">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir < 0 ? 'Earlier motions' : 'More motions'}
              onClick={(e) => {
                e.stopPropagation()
                row.current?.scrollBy({ left: dir * 208, behavior: 'smooth' })
              }}
              className="grid size-6 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
            >
              {dir < 0 ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          ))}
        </span>
      </div>
      <div
        ref={row}
        role="radiogroup"
        aria-label="How the section arrives"
        className="-mx-3 flex snap-x gap-2 overflow-x-auto scroll-smooth px-3 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: 12, maskImage: 'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 24px), transparent 100%)' }}
      >
        {tiles.map((t) => (
          <MotionTile key={t.id} id={t.id} shows={t.id === 'captured' && layout ? (skinEnter ?? undefined) : undefined} label={t.label} hint={t.hint} on={on === t.id} onPick={() => pick(t.id)} />
        ))}
      </div>
      {m.mode === 'preset' && (
        <>
          <StyleRow label="Speed">
            <StepSlider label="Speed" value={m.speed ?? 'normal'} steps={(['slow', 'normal', 'quick'] as const).map((v) => ({ v, label: SPEED_LABEL[v] }))} onChange={(v: MotionSpeed) => set({ ...m, speed: v === 'normal' ? undefined : v })} />
          </StyleRow>
          <div className="flex items-center justify-between text-[12px] font-medium text-zinc-600">
            One after another
            <Switch on={!!m.stagger} onChange={() => set({ ...m, stagger: !m.stagger })} label="Stagger blocks" />
          </div>
          <div className="flex items-center justify-between text-[12px] font-medium text-zinc-600">
            When scrolled into view
            <Switch on={!!m.onScroll} onChange={() => set({ ...m, onScroll: !m.onScroll })} label="Play on scroll" />
          </div>
        </>
      )}
    </div>
  )
}

/** A way for a section to arrive, shown by doing it: a tiny page that loops the motion while you point at it. */
function MotionTile({ id, shows, label, hint, on, onPick }: { id: string; shows?: string; label: string; hint: string; on: boolean; onPick: () => void }) {
  const [play, setPlay] = useState(0)
  const [hovering, setHovering] = useState(false)
  const tile = useRef<HTMLButtonElement>(null)
  const enter = shows ?? id
  const moves = enter !== 'none' && enter !== 'captured'
  useEffect(() => {
    if (!hovering || !moves) return
    setPlay((n) => n + 1)
    const timer = window.setInterval(() => setPlay((n) => n + 1), 1500)
    return () => window.clearInterval(timer)
  }, [hovering, moves])
  // Bring your choice into view, without moving the panel around it.
  useEffect(() => {
    if (on) tile.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [on])
  const anim = (delay: number) => (moves ? { animation: `sw-${enter} 640ms cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms both` } : undefined)
  return (
    <button
      ref={tile}
      type="button"
      role="radio"
      aria-checked={on}
      title={hint}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={(e) => {
        e.stopPropagation()
        setPlay((n) => n + 1)
        onPick()
      }}
      className="grid w-[96px] shrink-0 cursor-pointer snap-start gap-1.5 rounded-lg text-center transition-[scale] active:scale-[0.98]"
    >
      <span key={play} className={`flex h-[68px] flex-col justify-center gap-1 overflow-hidden rounded-lg bg-lift px-3 transition-shadow duration-150 ${on ? 'shadow-[0_0_0_1.5px_rgb(24_24_27)]' : 'shadow-[0_0_0_1px_rgb(0_0_0/0.08)]'}`}>
        <span className={`block h-1.5 w-full rounded-full ${moves ? 'bg-zinc-700' : 'bg-zinc-300'}`} style={anim(0)} />
        <span className={`block h-1 w-2/3 rounded-full ${moves ? 'bg-zinc-400' : 'bg-zinc-200'}`} style={anim(70)} />
        <span className={`mt-1 block h-3 w-8 rounded-full ${moves ? 'bg-zinc-700' : 'bg-zinc-300'}`} style={anim(140)} />
      </span>
      <span className={`text-[11.5px] leading-tight ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{label}</span>
    </button>
  )
}
