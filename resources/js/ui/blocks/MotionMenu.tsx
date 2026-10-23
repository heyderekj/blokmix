import { Play } from 'lucide-react'
import type { BlockKind, BlockMotion, EnterPreset, MotionSpeed, SectionMotion, Slot } from '@/core/types'
import { ENTER_INFO, HOVER_INFO, LOOP_INFO, SCROLL_INFO, SPEED_LABEL, canHover, presetsFor, type PresetInfo } from '@/core/motion'
import { useStore } from '@/state/store'
import { Switch } from '../panels/parts'
import { Steps } from './Spacing'
import { useBlockPreview } from './preview'

/**
 * A block's motion: how it arrives, answers a hover, reacts to scroll, or idles.
 * Hovering an option plays it on the page before you choose it.
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
  // Show it, then play it, so a hovered entrance actually arrives.
  const show = (m: BlockMotion | null) => {
    onHover(m)
    if (m) window.setTimeout(replay, 30)
  }
  const Group = <T extends string>({ title, list, prop, none }: { title: string; list: PresetInfo<T>[]; prop: keyof BlockMotion; none: string }) => {
    const items: PresetInfo<string>[] = presetsFor(list, kind)
    // An entrance can also be switched off, even when the section staggers its blocks.
    if (prop === 'enter') items.push({ id: 'none', label: 'None', hint: 'Already there; no entrance' })
    if (!items.length) return null
    const current = motion?.[prop]
    return (
      <div className="px-2 py-1.5">
        <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">{title}</div>
        <div className="flex flex-wrap gap-1" onMouseLeave={() => show(null)}>
          {[{ id: undefined as string | undefined, label: none, hint: '' }, ...items].map((p) => {
            const on = current === p.id || (!current && !p.id)
            return (
              <button
                key={p.id ?? 'none'}
                type="button"
                title={p.hint}
                onMouseEnter={() => show({ [prop]: p.id } as BlockMotion)}
                onClick={() => {
                  onPick({ [prop]: p.id } as BlockMotion)
                  window.setTimeout(replay, 30)
                }}
                className={`h-7 rounded-full px-2.5 text-[12px] font-semibold transition active:scale-[0.97] ${on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <div className="glass-menu w-[320px] animate-pop rounded-2xl p-1.5">
      <Group title="Enter" list={ENTER_INFO} prop="enter" none="Section’s" />
      {canHover(kind) && <Group title="Hover" list={HOVER_INFO} prop="hover" none="None" />}
      <Group title="Scroll" list={SCROLL_INFO} prop="scroll" none="None" />
      <Group title="Loop" list={LOOP_INFO} prop="loop" none="None" />
      <div className="flex items-center gap-2 px-2 pb-2 pt-1.5">
        <span className="w-12 text-[11px] font-semibold text-zinc-400">Speed</span>
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
      {motion?.enter === undefined && motion?.scroll === 'reveal' && (
        <p className="px-2 pb-1.5 text-[11px] text-zinc-400">Reveal uses the section’s entrance (Rise if none).</p>
      )}
    </div>
  )
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
