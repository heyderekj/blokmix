import type { ColorRef } from '@/core/types'
import { useStore } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'

/** The palette's own colors, in the order every color row shows them; brand colors you added follow. */
export const CORE: { ref: ColorRef; key: string; label: string }[] = [
  { ref: 'primary', key: 'color.primary', label: 'Primary' },
  { ref: 'accent', key: 'color.accent', label: 'Accent' },
  { ref: 'text', key: 'color.text', label: 'Text' },
  { ref: 'muted', key: 'color.muted', label: 'Muted' },
  { ref: 'surface', key: 'color.surface', label: 'Surface' },
  { ref: 'bg', key: 'color.bg', label: 'Page' },
]

/** Resolve a palette ref to something the browser can paint in the chrome. */
export function usePaint() {
  const tokens = useResolvedGuide().tokens as Record<string, string>
  const swatches = useStore((s) => s.guide.swatches) ?? []
  return (ref: ColorRef | undefined) => {
    if (!ref) return undefined
    const [name, mix] = ref.split('/')
    const base = name.startsWith('x:') ? swatches.find((w) => w.name === name.slice(2))?.value : tokens[`color.${name}`]
    if (!base) return undefined
    return mix ? `color-mix(in oklab, ${base} ${mix}%, ${tokens['color.bg']})` : base
  }
}

/** Every color you can pick: the palette's, then your brand colors. */
export function usePaletteRefs(): { ref: ColorRef; label: string }[] {
  const swatches = useStore((s) => s.guide.swatches) ?? []
  return [...CORE, ...swatches.map((w) => ({ ref: `x:${w.name}`, label: w.name }))]
}

export function Swatch({ color, label, on, onHover, onPick, small }: { color?: string; label: string; on: boolean; onHover: () => void; onPick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      onMouseEnter={onHover}
      onClick={onPick}
      className={`${small ? 'size-6' : 'size-7'} rounded-full ring-offset-2 transition hover:scale-110 ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`}
      style={{ background: color }}
    />
  )
}

export function Segmented<T extends string>({ options, value, onHover, onPick }: { options: { v: T; label: string }[]; value?: T; onHover: (v: T | null) => void; onPick: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-chip p-0.5" onMouseLeave={() => onHover(null)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onMouseEnter={() => onHover(o.v)}
          onClick={() => onPick(o.v)}
          className={`h-6 flex-1 rounded-full text-[11.5px] font-semibold transition ${value === o.v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

