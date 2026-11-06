import { useEffect, useRef, useState } from 'react'

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
 * The moment a section locks or unlocks, for its own motion: "lock" presses it in and lets it settle (it clicks into
 * place), "unlock" lifts it a touch and lets go. Null the rest of the time, and on first draw.
 */
export function useLockMoment(locked: boolean): 'lock' | 'unlock' | null {
  const on = useChanged(locked, true)
  const off = useChanged(locked, false)
  return on ? 'lock' : off ? 'unlock' : null
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
