import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** Chrome morph: quick and settled, no bounce (the canvas is where things bounce). */
export const MORPH = { type: 'spring', stiffness: 560, damping: 44, mass: 0.9 } as const

/**
 * A floating bar that grows into the panel it controls. The bar stays put as
 * the panel's header, so opening reads as the same object getting bigger
 * rather than a new window appearing.
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
          layout="position"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.07, duration: 0.14 } }}
          exit={{ opacity: 0, transition: { duration: 0.06 } }}
          className={`thin-scroll min-h-0 overflow-y-auto ${grow === 'down' ? 'border-t' : 'border-b'} border-zinc-950/6`}
          style={{ maxHeight: maxBody }}
          data-scroll-ok
          onKeyDown={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
  return (
    <motion.div
      layout
      transition={MORPH}
      className={`glass-panel pointer-events-auto flex flex-col overflow-hidden ${className}`}
      style={{ width: open && width ? width : undefined, borderRadius: open ? 20 : 16 }}
      data-chrome
    >
      {grow === 'up' && body}
      <motion.div layout="position" transition={MORPH} className="flex h-11 shrink-0 items-center gap-1 px-1">
        {bar}
      </motion.div>
      {grow === 'down' && body}
    </motion.div>
  )
}

export function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-950/10" />
}
