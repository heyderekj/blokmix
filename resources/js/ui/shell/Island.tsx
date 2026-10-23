import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** Chrome morph: quick and settled, no bounce (the canvas is where things bounce). */
export const MORPH = { type: 'spring', stiffness: 560, damping: 44, mass: 0.9 } as const
const CLOSE = { type: 'spring', stiffness: 700, damping: 56, mass: 0.8 } as const

/**
 * A floating bar that grows into the panel it controls. The bar stays put as
 * the panel's header, so opening reads as the same object getting bigger.
 *
 * Size is animated directly (width and height), never with a scale transform,
 * so glass, text and corners stay crisp. On close, the content fades first and
 * the panel folds back into the bar.
 */
export function Island({
  open,
  bar,
  children,
  width,
  grow = 'down',
  maxBody = 'min(68vh, 640px)',
  className = '',
}: {
  open: boolean
  bar: ReactNode
  children?: ReactNode
  width?: number
  grow?: 'down' | 'up'
  maxBody?: string
  className?: string
}) {
  const body = (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: MORPH, opacity: { delay: 0.06, duration: 0.16 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: CLOSE, opacity: { duration: 0.08 } } }}
          className={`overflow-hidden ${grow === 'down' ? 'border-t' : 'border-b'} border-zinc-950/6`}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="thin-scroll min-h-0 overflow-y-auto" style={{ maxHeight: maxBody }} data-scroll-ok>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
  return (
    <motion.div
      initial={false}
      animate={{ width: open && width ? width : 'auto', borderRadius: open ? 20 : 16 }}
      transition={open ? MORPH : CLOSE}
      className={`glass-panel pointer-events-auto flex flex-col overflow-hidden ${className}`}
      data-chrome
    >
      {grow === 'up' && body}
      <div className="flex h-11 shrink-0 items-center gap-1 px-1">{bar}</div>
      {grow === 'down' && body}
    </motion.div>
  )
}

export function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-950/10" />
}
