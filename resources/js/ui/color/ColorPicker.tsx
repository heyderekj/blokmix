import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Pipette } from 'lucide-react'
import { hexToOklch, oklchToHex, paletteFrom, type Mode } from '@/core/palette'
import { NAMED_COLORS, parseColor } from '@/core/colorInput'

const W = 304
const RING = 176
const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'

type Lch = { L: number; C: number; h: number }
const toLch = (hex: string): Lch => {
  const v = hexToOklch(hex)
  return v ? { L: v[0], C: v[1], h: v[2] } : { L: 0.55, C: 0.15, h: 30 }
}
const css = (L: number, C: number, h: number) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`

/**
 * Pick a color the Blokmix way: paste or type a hex (or rgb()) first; spin the record's rim for the hue; slide the
 * two faders for how light and how vivid; or start from a named swatch. Works in OKLCH, so steps feel even and the
 * hex is always a real sRGB color. With `palette`, it shows the palette a brand color makes, as it'll land.
 */
export function ColorPicker({ value, anchor, title = 'Color', palette, onChange, onDone, onCancel }: {
  value: string
  anchor: HTMLElement | null
  title?: string
  /** For a brand color: show the whole palette it makes, in this mode. */
  palette?: Mode
  /** Every change while you pick (for a live preview). */
  onChange?: (hex: string) => void
  onDone: (hex: string) => void
  onCancel: () => void
}) {
  const start = useRef(parseColor(value) ?? '#a83607')
  const [lch, setLch] = useState<Lch>(() => toLch(start.current))
  const [hex, setHex] = useState(start.current)
  const [typed, setTyped] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pos = usePlace(anchor, box)

  const set = (next: Lch) => {
    setLch(next)
    const h = oklchToHex(next.L, next.C, next.h)
    setHex(h)
    setTyped(null)
    onChange?.(h)
  }
  const setFromHex = (h: string) => {
    setLch(toLch(h))
    setHex(h)
    onChange?.(h)
  }

  // Escape puts it back; a click outside keeps what you picked.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onCancel())
    const down = (e: PointerEvent) => {
      if (box.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return
      onDone(hex)
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', down, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', down, true)
    }
  }, [hex, anchor, onDone, onCancel])

  const swatches = useMemo(() => (palette ? paletteFrom(hex, palette) : null), [hex, palette])
  const ink = lch.L > 0.68 ? '#17121a' : '#ffffff'
  const eyedrop = typeof window !== 'undefined' && 'EyeDropper' in window

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={title}
      data-color-picker
      className="glass-menu fixed z-[60] animate-pop rounded-2xl p-3 text-zinc-900"
      style={{ width: W, left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* The hex comes first: paste one in, or copy it out. */}
      <div className="flex items-center gap-2">
        <span className="size-9 shrink-0 rounded-xl shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: hex }} />
        <label className="flex h-9 min-w-0 flex-1 items-center rounded-xl bg-zinc-950/[0.05] pl-2.5 focus-within:bg-white focus-within:shadow-[0_0_0_2px_#FF69B4]">
          <span className="font-mono text-[14px] text-zinc-400">#</span>
          <input
            autoFocus
            value={typed ?? hex.slice(1).toUpperCase()}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setTyped(e.target.value)
              const c = parseColor(e.target.value)
              if (c) setFromHex(c)
            }}
            onPaste={(e) => {
              const c = parseColor(e.clipboardData.getData('text'))
              if (!c) return
              e.preventDefault()
              setTyped(null)
              setFromHex(c)
            }}
            onKeyDown={(e) => e.key === 'Enter' && onDone(parseColor(typed ?? hex) ?? hex)}
            onBlur={() => setTyped(null)}
            spellCheck={false}
            aria-label="Hex code"
            className="h-full min-w-0 flex-1 bg-transparent px-1 font-mono text-[15px] font-semibold uppercase tracking-wide outline-none"
          />
        </label>
        <IconButton
          label={copied ? 'Copied' : 'Copy the hex'}
          onClick={() => {
            void navigator.clipboard?.writeText(hex)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </IconButton>
        {eyedrop && (
          <IconButton
            label="Pick a color from the screen"
            onClick={async () => {
              try {
                const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open()
                const c = parseColor(r.sRGBHex)
                if (c) setFromHex(c)
              } catch {
                // Closed without a pick.
              }
            }}
          >
            <Pipette size={15} />
          </IconButton>
        )}
      </div>

      {/* The record: spin the rim for the hue; the label in the middle is the color itself. */}
      <div className="mt-3 flex justify-center">
        <HueRecord lch={lch} ink={ink} hex={hex} onHue={(h) => set({ ...lch, h })} />
      </div>

      <div className="mt-3 grid gap-2.5">
        <Fader
          label="Light"
          ends={['Deep', 'Light']}
          value={(lch.L - 0.22) / (0.92 - 0.22)}
          track={`linear-gradient(to right, ${css(0.22, lch.C, lch.h)}, ${css(0.57, lch.C, lch.h)}, ${css(0.92, lch.C, lch.h)})`}
          onChange={(v) => set({ ...lch, L: 0.22 + v * (0.92 - 0.22) })}
        />
        <Fader
          label="Vivid"
          ends={['Soft', 'Vivid']}
          value={lch.C / 0.26}
          track={`linear-gradient(to right, ${css(lch.L, 0, lch.h)}, ${css(lch.L, 0.26, lch.h)})`}
          onChange={(v) => set({ ...lch, C: v * 0.26 })}
        />
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-1" role="list" aria-label="Start from">
        {NAMED_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="listitem"
            title={`${c.name} ${c.hex.toUpperCase()}`}
            aria-label={c.name}
            onClick={() => setFromHex(c.hex)}
            className={`size-6 rounded-full ${PRESS} ${c.hex === hex ? 'shadow-[0_0_0_2px_var(--lift,#fff),0_0_0_4px_#17121A]' : 'shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] hover:scale-110'}`}
            style={{ background: c.hex }}
          />
        ))}
      </div>

      {swatches && (
        <div className="mt-3 rounded-xl bg-zinc-950/[0.04] p-2">
          <div className="flex h-7 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
            {(['color.bg', 'color.surface', 'color.text', 'color.primary', 'color.accent'] as const).map((k) => (
              <span key={k} className="flex-1" style={{ background: swatches[k] }} />
            ))}
          </div>
          <p className="pt-1.5 text-[11px] leading-snug text-zinc-500">The whole palette follows, and every pair of colors stays readable.</p>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={`h-8 rounded-full px-3 text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-950/5 ${PRESS}`}>
          Cancel
        </button>
        <button type="button" onClick={() => onDone(hex)} className={`h-8 rounded-full bg-zinc-900 px-3.5 text-[12.5px] font-semibold text-white ${PRESS}`}>
          Use this color
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** The hue as a record: its rim is every hue at this lightness and vividness; drag the needle round, or use ← →. */
function HueRecord({ lch, ink, hex, onHue }: { lch: Lch; ink: string; hex: string; onHue: (h: number) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const C = Math.max(lch.C, 0.06)
  const stops = Array.from({ length: 13 }, (_, i) => css(lch.L, C, i * 30)).join(', ')
  const hueAt = (e: { clientX: number; clientY: number }) => {
    const r = el.current!.getBoundingClientRect()
    const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
    return (a + 90 + 360) % 360
  }
  const knob = ((lch.h - 90) * Math.PI) / 180
  const R = RING / 2 - 11
  return (
    <div
      ref={el}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(lch.h)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') (e.preventDefault(), onHue((lch.h + (e.shiftKey ? 15 : 3)) % 360))
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') (e.preventDefault(), onHue((lch.h + 360 - (e.shiftKey ? 15 : 3)) % 360))
      }}
      onPointerDown={(e) => {
        const ring = e.currentTarget
        ring.setPointerCapture(e.pointerId)
        onHue(hueAt(e))
        const move = (m: PointerEvent) => onHue(hueAt(m))
        const up = () => (ring.removeEventListener('pointermove', move), ring.removeEventListener('pointerup', up))
        ring.addEventListener('pointermove', move)
        ring.addEventListener('pointerup', up)
      }}
      className="relative cursor-grab touch-none select-none rounded-full outline-none focus-visible:shadow-[0_0_0_3px_#FF69B4] active:cursor-grabbing"
      style={{ width: RING, height: RING, background: `conic-gradient(from 0deg, ${stops})` }}
    >
      {/* The grooves, then the label in the color you're on. */}
      <span className="absolute inset-[22px] rounded-full" style={{ background: 'repeating-radial-gradient(circle, #1b1719 0 2px, #26211f 2px 4px)' }} />
      <span className="absolute inset-[50px] grid place-items-center rounded-full shadow-[0_0_0_3px_rgb(0_0_0/0.25)]" style={{ background: hex }}>
        <span className="absolute size-2 rounded-full bg-[#1b1719]" />
        <span className="absolute bottom-[22%] font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ color: ink }}>
          {hex}
        </span>
      </span>
      {/* The needle sits on the rim, at the hue. */}
      <span
        className="pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgb(0_0_0/0.4)]"
        style={{ left: RING / 2 + R * Math.cos(knob), top: RING / 2 + R * Math.sin(knob), background: css(lch.L, C, lch.h) }}
      />
    </div>
  )
}

/** A mixing-desk fader: drag along its track, or use ← →. */
function Fader({ label, ends, value, track, onChange }: { label: string; ends: [string, string]; value: number; track: string; onChange: (v: number) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const v = Math.min(1, Math.max(0, value))
  const at = (x: number) => {
    const r = el.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (x - r.left) / r.width))
  }
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-[10.5px] font-medium text-zinc-400">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
      <div
        ref={el}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') (e.preventDefault(), onChange(Math.min(1, v + (e.shiftKey ? 0.1 : 0.02))))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') (e.preventDefault(), onChange(Math.max(0, v - (e.shiftKey ? 0.1 : 0.02))))
        }}
        onPointerDown={(e) => {
          const t = e.currentTarget
          t.setPointerCapture(e.pointerId)
          onChange(at(e.clientX))
          const move = (m: PointerEvent) => onChange(at(m.clientX))
          const up = () => (t.removeEventListener('pointermove', move), t.removeEventListener('pointerup', up))
          t.addEventListener('pointermove', move)
          t.addEventListener('pointerup', up)
        }}
        className="relative h-3 cursor-pointer touch-none rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] outline-none focus-visible:shadow-[0_0_0_2px_#FF69B4]"
        style={{ background: track }}
      >
        <span className="pointer-events-none absolute top-1/2 h-5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[5px] border-2 border-white bg-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.35)]" style={{ left: `${v * 100}%` }} />
      </div>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid size-9 shrink-0 place-items-center rounded-xl text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`}>
      {children}
    </button>
  )
}

/** Below the swatch that opened it, or above when there's no room; always on screen. */
function usePlace(anchor: HTMLElement | null, box: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState({ left: 0, top: 0, ready: false })
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor?.getBoundingClientRect()
      const h = box.current?.offsetHeight ?? 480
      if (!a) return setPos({ left: (innerWidth - W) / 2, top: Math.max(12, (innerHeight - h) / 2), ready: true })
      const left = Math.min(Math.max(12, a.left), innerWidth - W - 12)
      const below = a.bottom + 8
      const top = below + h <= innerHeight - 12 ? below : Math.max(12, a.top - h - 8)
      setPos({ left, top, ready: true })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, box])
  return pos
}

/**
 * A swatch that opens the picker. `live` sends every change as you pick (for a preview); otherwise only the color you
 * end on. The swatch itself is whatever you pass, or a plain round chip.
 */
export function ColorButton({ value, onPick, live, palette, title, className, children }: {
  value: string
  onPick: (hex: string) => void
  live?: (hex: string) => void
  palette?: Mode
  title?: string
  className?: string
  children?: ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const before = useRef(value)
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={title ?? 'Pick a color'}
        aria-expanded={open}
        title={title}
        onClick={() => {
          before.current = value
          setOpen((o) => !o)
        }}
        className={className ?? `size-7 shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] ${PRESS}`}
        style={children ? undefined : { background: value }}
      >
        {children}
      </button>
      {open && (
        <ColorPicker
          value={value}
          anchor={ref.current}
          title={title}
          palette={palette}
          onChange={live}
          onDone={(h) => {
            setOpen(false)
            if (h !== before.current) onPick(h)
          }}
          onCancel={() => {
            setOpen(false)
            if (live) live(before.current)
          }}
        />
      )}
    </>
  )
}
