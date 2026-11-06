import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { canvasApi } from '../canvas/Canvas'

/**
 * A padlock you can feel: locking drops the shackle home with a small overshoot (the brand's lift-and-drop) and the
 * body gives one short clunk as it lands; unlocking lifts the shackle and swings it open. Only a change animates, never
 * the first draw, so a page full of locked sections loads still.
 */
export function LockGlyph({ locked, size = 15, strokeWidth = 2, className = '' }: { locked: boolean; size?: number; strokeWidth?: number; className?: string }) {
  const clunk = useChanged(locked, true)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`lock-glyph ${clunk ? 'lock-clunk' : ''} ${className}`}
      data-locked={locked || undefined}
    >
      <path className="lock-shackle" d="M7 11V7a5 5 0 0 1 10 0v4" />
      <rect className="lock-body" x="3.5" y="11" width="17" height="10.5" rx="2.25" />
    </svg>
  )
}

/**
 * The section, clamped: four corner brackets in the key color snap in around a section as it locks and stay while it's
 * locked, so you can tell at a glance which sections are hands off. Locking also pulses the outline once, inward, like
 * a clamp closing. Unlocking lifts the brackets off, quicker than they came.
 */
export function LockCorners({ locked }: { locked: boolean }) {
  const reduce = useReducedMotion()
  const pulse = useChanged(locked, true)
  // Offsets are on screen; the brackets live in the zoomed page, so divide by the zoom.
  const out = reduce ? 0 : 1 / (canvasApi.get().z || 1)
  const corners = [
    { key: 'tl', at: { left: 0, top: 0 }, x: -1, y: -1 },
    { key: 'tr', at: { right: 0, top: 0 }, x: 1, y: -1 },
    { key: 'bl', at: { left: 0, bottom: 0 }, x: -1, y: 1 },
    { key: 'br', at: { right: 0, bottom: 0 }, x: 1, y: 1 },
  ] as const
  return (
    <div className="pointer-events-none absolute inset-[calc(6px/var(--z))] z-[11]" aria-hidden>
      <AnimatePresence initial={false}>
        {locked &&
          corners.map((c, i) => (
            <motion.span
              key={c.key}
              className="absolute block"
              style={{
                ...c.at,
                width: 'calc(16px / var(--z))',
                height: 'calc(16px / var(--z))',
                borderColor: 'var(--color-key)',
                borderStyle: 'solid',
                borderWidth: 0,
                [c.y < 0 ? 'borderTopWidth' : 'borderBottomWidth']: 'calc(2.5px / var(--z))',
                [c.x < 0 ? 'borderLeftWidth' : 'borderRightWidth']: 'calc(2.5px / var(--z))',
                [`border${c.y < 0 ? 'Top' : 'Bottom'}${c.x < 0 ? 'Left' : 'Right'}Radius`]: 'calc(5px / var(--z))',
              }}
              initial={{ opacity: 0, x: c.x * 10 * out, y: c.y * 10 * out }}
              animate={{ opacity: 1, x: 0, y: 0, transition: { duration: 0.24, delay: i * 0.03, ease: [0.3, 1.4, 0.5, 1] } }}
              exit={{ opacity: 0, x: c.x * 5 * out, y: c.y * 5 * out, transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] } }}
            />
          ))}
      </AnimatePresence>
      {pulse && locked && <span key={pulse} className="lock-pulse absolute -inset-[calc(6px/var(--z))] block" />}
    </div>
  )
}

/** A short-lived token, set when `value` turns into `when` (not on first draw); null again once the moment has passed. */
function useChanged<T>(value: T, when: T, ms = 420): number | null {
  const prev = useRef(value)
  const [token, setToken] = useState<number | null>(null)
  useEffect(() => {
    if (prev.current !== value && value === when) setToken(Date.now())
    prev.current = value
  }, [value, when])
  useEffect(() => {
    if (token === null) return
    const t = window.setTimeout(() => setToken(null), ms)
    return () => window.clearTimeout(t)
  }, [token, ms])
  return token
}
