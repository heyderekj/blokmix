import type { SectionSpace, Slot, SpaceStep } from '@/core/types'
import { useStore } from '@/state/store'

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
}: {
  options: { v: T; label: string }[]
  value?: T
  onHover?: (v: T | null) => void
  onPick: (v: T) => void
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
          className={`h-6 flex-1 rounded-full px-1.5 text-[11.5px] font-semibold transition ${value === o.v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Top and bottom spacing for a whole section, relative to the style guide's section padding. */
export function SectionSpacingRows({ slot }: { slot: Slot }) {
  const st = useStore.getState
  return (
    <div className="space-y-2">
      {(['top', 'bottom'] as const).map((side) => (
        <div key={side} className="flex items-center gap-2">
          <span className="w-14 text-[12px] font-medium text-zinc-500">{side === 'top' ? 'Top' : 'Bottom'}</span>
          <div className="flex-1">
            <Steps options={SECTION_SPACES} value={slot.spacing?.[side] ?? 'default'} onPick={(v) => st().setSectionSpacing(slot.id, { [side]: v })} />
          </div>
        </div>
      ))}
    </div>
  )
}
