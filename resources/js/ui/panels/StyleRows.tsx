import { Dropdown } from '@/ui/controls/Dropdown'
import type { CSSProperties, ReactNode } from 'react'

/** One compact option: its name on the left, its control on the right. */
export function StyleRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[12px] font-medium text-zinc-600">{label}</span>
      {children}
    </div>
  )
}

/** A compact dropdown with an optional swatch for the current choice. */
export function StyleSelect<T extends string>({ label, value, options, lead, onChange }: { label: string; value: T; options: readonly { v: T; label: string }[]; lead?: ReactNode; onChange: (v: T) => void }) {
  return <Dropdown label={label} value={value} options={options} lead={lead} onChange={onChange} className="w-full bg-lift text-[12px]" />
}

/** The panel's slider: a thin track filled to the thumb, light enough to sit in a list of options. */
export function Slider({ value, min, max, step = 1, label, valueText, disabled, faded, onChange, onCommit }: { value: number; min: number; max: number; step?: number; label: string; valueText?: string; disabled?: boolean; faded?: boolean; onChange: (n: number) => void; onCommit?: () => void }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      className={`style-range min-w-0 flex-1 text-zinc-900 ${faded ? 'opacity-40' : ''}`}
      style={{ '--p': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
    />
  )
}

/** A slider over named steps, for choices that run small to large: it shows the step you're on. */
export function StepSlider<T extends string>({ label, value, steps, faded, onChange }: { label: string; value: T; steps: readonly { v: T; label: string }[]; faded?: boolean; onChange: (v: T) => void }) {
  const at = Math.max(0, steps.findIndex((s) => s.v === value))
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Slider label={label} valueText={steps[at]?.label} value={at} min={0} max={steps.length - 1} faded={faded} onChange={(n) => onChange(steps[n].v)} />
      <span className={`w-[46px] shrink-0 text-right text-[11.5px] ${faded ? 'text-zinc-400' : 'text-zinc-500'}`}>{steps[at]?.label}</span>
    </div>
  )
}
