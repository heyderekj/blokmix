import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const COLS = 13
const ROWS = 6
const PAD = 6
const clamp = (n: number) => Math.min(100, Math.max(0, n))

export interface Point {
  x: number
  y: number
}

/**
 * A field of dots you drag one point across, after Tesla's air vents: x and y run 0–100, and the dots near the point
 * swell and darken so the field shows where you are. The hollow ring is home (where the theme put it); a double click
 * goes back there. `onInput` follows the drag, `onCommit` is letting go (or a key press).
 */
export function DotMatrix({ label, value, home = { x: 50, y: 50 }, ends, describe, onInput, onCommit }: {
  label: string
  value: Point
  home?: Point
  /** The words at each edge: left, right, bottom, top. */
  ends: { left: string; right: string; bottom: string; top: string }
  describe: (p: Point) => string
  onInput?: (p: Point) => void
  onCommit?: (p: Point) => void
}) {
  const field = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Point | null>(null)
  const p = drag ?? value
  const at = (e: PointerEvent): Point => {
    const r = field.current!.getBoundingClientRect()
    return { x: Math.round(clamp(((e.clientX - r.left - PAD) / (r.width - PAD * 2)) * 100)), y: Math.round(clamp((1 - (e.clientY - r.top - PAD) / (r.height - PAD * 2)) * 100)) }
  }
  const move = (n: Point) => {
    if (n.x === p.x && n.y === p.y) return
    setDrag(n)
    onInput?.(n)
  }
  const go = (n: Point) => {
    const to = { x: clamp(n.x), y: clamp(n.y) }
    if (to.x === value.x && to.y === value.y) return
    onInput?.(to)
    onCommit?.(to)
  }
  const key = (e: KeyboardEvent) => {
    const by: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }
    if (!(e.key in by)) return
    e.preventDefault()
    go({ x: value.x + by[e.key][0], y: value.y + by[e.key][1] })
  }
  const word = (on: boolean) => `text-[11px] font-semibold transition-[color] duration-150 ${on ? 'text-zinc-900' : 'text-zinc-400'}`
  const place = (q: Point) => ({ left: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${q.x / 100})`, top: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${1 - q.y / 100})` })
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-x-1.5 gap-y-1">
      <span className={`col-start-2 text-center ${word(p.y > 60)}`}>{ends.top}</span>
      <span className={`col-start-1 text-right ${word(p.x < 40)}`}>{ends.left}</span>
      <div
        ref={field}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={describe(p)}
        onKeyDown={key}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag(value)
          move(at(e))
        }}
        onPointerMove={(e) => drag && move(at(e))}
        onPointerUp={() => {
          if (drag && (drag.x !== value.x || drag.y !== value.y)) onCommit?.(drag)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={() => go(home)}
        className="relative grid aspect-[2/1] cursor-pointer touch-none rounded-xl bg-chip outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#ff69b4)]"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, padding: PAD }}
      >
        {Array.from({ length: COLS * ROWS }, (_, k) => {
          const dx = (k % COLS) / (COLS - 1) - p.x / 100
          const dy = 1 - Math.floor(k / COLS) / (ROWS - 1) - p.y / 100
          const near = Math.exp(-(dx * dx * 4 + dy * dy) * 9)
          const size = 4 + near * 7
          return (
            <i
              key={k}
              className={`place-self-center rounded-full transition-[width,height,opacity,background-color] duration-100 ${near > 0.35 ? 'bg-zinc-900' : 'bg-zinc-400'}`}
              style={{ width: size, height: size, opacity: 0.35 + near * 0.65 }}
            />
          )
        })}
        <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-zinc-400" style={place(home)} />
        <span
          className={`pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 shadow-[0_0_0_4px_rgb(24_24_27/0.14)] ${drag ? '' : 'transition-[left,top] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]'}`}
          style={place(p)}
        />
      </div>
      <span className={`col-start-3 ${word(p.x > 60)}`}>{ends.right}</span>
      <span className={`col-start-2 text-center ${word(p.y < 40)}`}>{ends.bottom}</span>
    </div>
  )
}
