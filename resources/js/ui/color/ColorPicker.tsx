import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, Copy, Pipette } from 'lucide-react'
import { hexToOklch, oklchToHex, type Mode, type PaletteVariant } from '@/core/palette'
import { pairingOf, pairingPalettes, readability, type Pairing } from '@/core/colorPairs'
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
export function ColorPicker({ value, anchor, title = 'Color', palette, variant: startVariant, onChange, onDone, onCancel }: {
  value: string
  anchor: HTMLElement | null
  title?: string
  /** For a brand color: show the whole palette it makes, in this mode. */
  palette?: Mode
  /** For a brand color: how it pairs (the accent and the greys), as last chosen. */
  variant?: PaletteVariant
  /** Every change while you pick (for a live preview). */
  onChange?: (hex: string, variant?: PaletteVariant) => void
  onDone: (hex: string, variant?: PaletteVariant) => void
  onCancel: () => void
}) {
  const start = useRef(parseColor(value) ?? '#a83607')
  const [lch, setLch] = useState<Lch>(() => toLch(start.current))
  const [hex, setHex] = useState(start.current)
  const [typed, setTyped] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pair, setPair] = useState<Pairing>(() => pairingOf(startVariant))
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
      onDone(hex, palette ? pair.variant : undefined)
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', down, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', down, true)
    }
  }, [hex, pair, palette, anchor, onDone, onCancel])

  const pairings = useMemo(() => (palette ? pairingPalettes(hex, palette) : null), [hex, palette])
  const reads = useMemo(() => readability(hex), [hex])
  const eyedrop = typeof window !== 'undefined' && 'EyeDropper' in window

  // Opened from inside a panel (Design, Content, Notes, Style): a layer over that panel, with a way back to it.
  // Anywhere else (the start): a popover by the swatch.
  const host = anchor?.closest<HTMLElement>('[data-layer-host]') ?? null
  const body = (
    <>
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
            onKeyDown={(e) => e.key === 'Enter' && onDone(parseColor(typed ?? hex) ?? hex, palette ? pair.variant : undefined)}
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

      {/* The ring: drag round it for the hue. */}
      <div className="mt-3 flex justify-center">
        <HueRing lch={lch} hex={hex} onHue={(h) => set({ ...lch, h, C: lch.C < 0.04 ? 0.15 : lch.C })} />
      </div>

      {/* One slider: the hue from deep to light. How vivid it can be follows (very light and very deep colors are softer). */}
      <div className="mt-3">
        <Fader
          label="Shade"
          ends={['Deep', 'Light']}
          value={(lch.L - 0.22) / (0.92 - 0.22)}
          track={`linear-gradient(to right, ${css(0.22, lch.C, lch.h)}, ${css(0.57, lch.C, lch.h)}, ${css(0.92, lch.C, lch.h)})`}
          onChange={(v) => set({ ...lch, L: 0.22 + v * (0.92 - 0.22) })}
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

      {pairings && (
        <>
          {/* Is it readable? Words on the color, both ways, with the verdict in plain words. */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {reads.map((r, i) => (
              <div key={r.ink} className={`flex items-center gap-1.5 rounded-xl px-1.5 py-1.5 ${i === 0 ? 'bg-zinc-950/[0.05]' : ''}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold" style={{ background: hex, color: r.ink === 'light' ? '#ffffff' : '#17121a' }}>
                  Aa
                </span>
                <span className="grid min-w-0 leading-tight">
                  <span className={`text-[11.5px] font-semibold ${r.ratio >= 4.5 ? 'text-zinc-800' : r.ratio >= 3 ? 'text-amber-700' : 'text-red-600'}`}>{r.verdict}</span>
                  <span className="whitespace-nowrap text-[10.5px] tabular-nums text-zinc-400">
                    {r.ink === 'light' ? 'White' : 'Dark'} · {r.ratio.toFixed(1)}:1
                  </span>
                </span>
              </div>
            ))}
          </div>
          {/* What it pairs with: each a whole palette, readable by construction. */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between pb-1.5">
              <span className="text-[11.5px] font-semibold text-zinc-800">Goes with</span>
              <span className="text-[10.5px] text-zinc-400">every one reads</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {pairings.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.words}
                  aria-pressed={pair.id === p.id}
                  onClick={() => (setPair(p), onChange?.(hex, p.variant))}
                  className={`grid gap-1 rounded-xl p-1.5 text-left ${PRESS} ${pair.id === p.id ? 'bg-white shadow-[0_0_0_2px_#17121A]' : 'shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] hover:bg-zinc-950/[0.03]'}`}
                >
                  <span className="flex h-6 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" style={{ background: p.palette['color.bg'] }}>
                    <span className="w-1/4" style={{ background: p.palette['color.surface'] }} />
                    <span className="flex-1" style={{ background: p.palette['color.primary'] }} />
                    <span className="w-1/4" style={{ background: p.palette['color.accent'] }} />
                    <span className="w-1/6" style={{ background: p.palette['color.text'] }} />
                  </span>
                  <span className="truncate px-0.5 text-[11px] font-semibold text-zinc-700">{p.name}</span>
                </button>
              ))}
            </div>
            <p className="pt-1.5 text-[11px] leading-snug text-zinc-500">{pair.words}.</p>
          </div>
        </>
      )}

      <div className="mt-3 flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={`h-8 rounded-full px-3 text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-950/5 ${PRESS}`}>
          Cancel
        </button>
        <button type="button" onClick={() => onDone(hex, palette ? pair.variant : undefined)} className={`h-8 rounded-full bg-zinc-900 px-3.5 text-[12.5px] font-semibold text-white ${PRESS}`}>
          Use this color
        </button>
      </div>
    </>
  )
  if (host)
    return createPortal(
      <div
        ref={box}
        role="dialog"
        aria-label={title}
        data-color-picker
        className="absolute inset-0 z-30 flex animate-layer flex-col bg-[var(--lift,#fff)] text-zinc-900"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-2 pb-1 pt-2.5">
          <button
            type="button"
            onClick={() => onDone(hex, palette ? pair.variant : undefined)}
            aria-label={`Back to ${host.getAttribute('aria-label') ?? 'the panel'}`}
            className={`flex h-8 items-center gap-0.5 rounded-full pl-1 pr-2.5 text-[12.5px] font-medium text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900 ${PRESS}`}
          >
            <ChevronLeft size={16} /> {host.getAttribute('aria-label') ?? 'Back'}
          </button>
          <h3 className="flex-1 truncate text-center text-[13.5px] font-semibold text-zinc-900">{title}</h3>
          <span className="w-16" />
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1" data-scroll-ok>
          {body}
        </div>
      </div>,
      host,
    )
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
      {body}
    </div>,
    document.body,
  )
}

/** The hue as a ring: every hue at this shade; drag the handle round, or use ← →. The middle is the color itself. */
function HueRing({ lch, hex, onHue }: { lch: Lch; hex: string; onHue: (h: number) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const C = Math.max(lch.C, 0.06)
  const stops = Array.from({ length: 13 }, (_, i) => css(lch.L, C, i * 30)).join(', ')
  const hueAt = (e: { clientX: number; clientY: number }) => {
    const r = el.current!.getBoundingClientRect()
    const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
    return (a + 90 + 360) % 360
  }
  const knob = ((lch.h - 90) * Math.PI) / 180
  const R = RING / 2 - 8
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
      {/* A clean ring of hues around a disc of the color you're on. */}
      <span className="absolute inset-[16px] rounded-full bg-[var(--lift,#fff)]" />
      <span className="absolute inset-[24px] rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: hex }} />
      {/* The needle sits on the rim, at the hue. */}
      <span
        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgb(0_0_0/0.14),0_1px_3px_rgb(0_0_0/0.25)]"
        style={{ left: RING / 2 + R * Math.cos(knob), top: RING / 2 + R * Math.sin(knob), background: css(lch.L, C, lch.h) }}
      />
    </div>
  )
}

/** A slider like the Feel dials': a round knob on its track; drag, or use ← →. */
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
        className="relative h-2 cursor-pointer touch-none rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus-visible:shadow-[0_0_0_2px_#FF69B4]"
        style={{ background: track }}
      >
        <span className="pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.14),0_1px_3px_rgb(0_0_0/0.25)] transition-[scale] duration-100 active:scale-110" style={{ left: `${v * 100}%` }} />
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
export function ColorButton({ value, onPick, live, palette, variant, title, className, children }: {
  value: string
  onPick: (hex: string, variant?: PaletteVariant) => void
  live?: (hex: string, variant?: PaletteVariant) => void
  palette?: Mode
  variant?: PaletteVariant
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
          variant={variant}
          onChange={live}
          onDone={(h, v) => {
            setOpen(false)
            if (h !== before.current || v) onPick(h, v)
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
