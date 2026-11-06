import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import type { SectionSpace, Slot, SpaceStep } from '@/core/types'
import { StepSlider } from '../panels/StyleRows'
import { useStore } from '@/state/store'

export type Device = 'desktop' | 'mobile'

/** Which width a spacing change is for; starts on Mobile while the canvas shows phones. */
export function useDevice(): [Device, (d: Device) => void] {
  return useState<Device>(() => (useStore.getState().ui.viewport === 'mobile' ? 'mobile' : 'desktop'))
}

/** Desktop | Mobile, for spacing groups. Mobile changes apply at 760px and below. */
export function DeviceSwitch({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Spacing for">
      {(['desktop', 'mobile'] as const).map((d) => {
        const Icon = d === 'desktop' ? Monitor : Smartphone
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={value === d}
            aria-label={d === 'desktop' ? 'Desktop' : 'Mobile'}
            title={d === 'mobile' ? 'Phones: 760px wide and below' : 'Every width, unless phones differ'}
            onClick={(e) => {
              e.stopPropagation()
              onChange(d)
            }}
            className={`grid size-6 cursor-pointer place-items-center rounded-md transition-[background-color,color,scale] active:scale-[0.97] ${value === d ? 'bg-zinc-950/[0.08] text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'}`}
          >
            <Icon size={13} />
          </button>
        )
      })}
    </div>
  )
}

/** A row's label, with a phone dot when phones have their own value. */
export function RowLabel({ label, phone }: { label: string; phone?: boolean }) {
  return (
    <span className="flex w-20 shrink-0 items-center gap-1 text-[11.5px] font-medium text-zinc-500">
      {label}
      {phone && <Smartphone size={10} className="text-key" aria-label="Different on mobile" />}
    </span>
  )
}

/** "Same as desktop", or a way back to it. */
export function MobileHint({ overridden, onReset }: { overridden: boolean; onReset: () => void }) {
  return overridden ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onReset()
      }}
      className="cursor-pointer pl-[88px] text-left text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
    >
      Reset to desktop
    </button>
  ) : (
    <span className="pl-[88px] text-[11px] text-zinc-400">Same as desktop</span>
  )
}

/** The spacing scale as people see it; values are steps of --mx-space-*, never pixels. */
export const SPACE_STEPS: { v: SpaceStep; label: string }[] = [
  { v: 0, label: '0' },
  { v: 1, label: 'XS' },
  { v: 2, label: 'S' },
  { v: 4, label: 'M' },
  { v: 6, label: 'L' },
  { v: 8, label: 'XL' },
]

const SECTION_SPACES: { v: SectionSpace; label: string }[] = [
  { v: 'none', label: 'None' },
  { v: 'tight', label: 'Tight' },
  { v: 'default', label: 'Default' },
  { v: 'roomy', label: 'Roomy' },
]

export function Steps<T extends string | number>({
  options,
  value,
  onHover,
  onPick,
  ghost,
}: {
  options: { v: T; label: string }[]
  value?: T
  onHover?: (v: T | null) => void
  onPick: (v: T) => void
  /** The value is inherited (from desktop): shown, but faintly. */
  ghost?: boolean
}) {
  return (
    <div className="flex rounded-full bg-chip p-0.5" onMouseLeave={() => onHover?.(null)}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onMouseEnter={() => onHover?.(o.v)}
          onClick={(e) => {
            e.stopPropagation()
            onPick(o.v)
          }}
          className={`h-6 flex-1 rounded-full px-1.5 text-[11.5px] font-semibold transition ${value === o.v ? (ghost ? 'bg-white/50 text-zinc-400' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const SPACE_ROOM: Record<string, number> = { none: 3, tight: 6, default: 10, roomy: 14 }

/** Top and bottom spacing for a whole section, relative to the style guide's section padding; phones can differ. A small outline shows the room it leaves. */
export function SectionSpacingRows({ slot, device }: { slot: Slot; device: Device }) {
  const st = useStore.getState
  const shown = (side: 'top' | 'bottom') => (device === 'mobile' ? (slot.spacing?.mobile?.[side] ?? slot.spacing?.[side]) : slot.spacing?.[side]) ?? 'default'
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 flex-col justify-between rounded-md px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)] transition-[padding] duration-150 ease-out" style={{ paddingTop: SPACE_ROOM[shown('top')], paddingBottom: SPACE_ROOM[shown('bottom')] }} aria-hidden>
        <span className="flex flex-1 flex-col justify-center gap-[3px]">
          <span className="h-[3px] w-full rounded-full bg-zinc-500" />
          <span className="h-[3px] w-2/3 rounded-full bg-zinc-300" />
        </span>
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        {(['top', 'bottom'] as const).map((side) => {
          const phone = slot.spacing?.mobile?.[side]
          return (
            <div key={side} className="grid gap-0.5">
              <div className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-1">
                <span className="flex items-center gap-1 text-[12px] font-medium text-zinc-600">
                  {side === 'top' ? 'Top' : 'Bottom'}
                  {phone && <Smartphone size={10} className="text-key" aria-label="Different on mobile" />}
                </span>
                <StepSlider
                  label={`Space ${side === 'top' ? 'above' : 'below'}`}
                  value={shown(side)}
                  steps={SECTION_SPACES}
                  faded={device === 'mobile' && !phone}
                  onChange={(v) => st().setSectionSpacing(slot.id, device === 'mobile' ? { mobile: { [side]: v } } : { [side]: v })}
                />
              </div>
              {device === 'mobile' && phone && (
                <button type="button" onClick={(e) => { e.stopPropagation(); st().setSectionSpacing(slot.id, { mobile: { [side]: undefined } }) }} className="cursor-pointer text-left text-[11px] font-medium text-zinc-500 hover:text-zinc-900">
                  Reset to desktop
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
