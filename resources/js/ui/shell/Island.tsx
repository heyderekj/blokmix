import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

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
  onClose,
  anchor = 'left',
}: {
  open: boolean
  bar: ReactNode
  children?: ReactNode
  width?: number
  grow?: 'down' | 'up'
  maxBody?: string
  className?: string
  /** Shows a close button at the end of the bar while open. */
  onClose?: () => void
  /** Which side the island grows from; the bar's contents stay pinned there so nothing slides. */
  anchor?: 'left' | 'center' | 'right'
}) {
  // Closed, the island is exactly as wide as its bar. Animating to that measured
  // width (rather than 'auto') lets it fold in both directions at once, instead
  // of keeping the open width until the body unmounts and then snapping.
  const barRef = useRef<HTMLDivElement>(null)
  const [barW, setBarW] = useState<number>()
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setBarW(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const closedW = barW ? barW + 12 : 'auto' // + the bar row's px-1.5 on both sides

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
      animate={{ width: open ? (width ?? 'auto') : closedW, borderRadius: open ? 20 : 16 }}
      transition={open ? MORPH : CLOSE}
      className={`glass-panel pointer-events-auto flex flex-col overflow-hidden ${className}`}
      data-chrome
    >
      {grow === 'up' && body}
      <div
        className={`relative flex h-11 shrink-0 items-center gap-1 px-1.5 ${
          anchor === 'center' ? 'justify-center' : anchor === 'right' ? 'justify-end' : 'justify-start'
        } ${open && onClose ? (anchor === 'center' ? 'px-10' : anchor === 'right' ? 'pl-10' : 'pr-10') : ''}`}
      >
        <div ref={barRef} className="flex shrink-0 items-center gap-1">
          {bar}
        </div>
        <AnimatePresence initial={false}>
          {open && onClose && (
            <motion.button
              key="close"
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 0.08, duration: 0.14 } }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.06 } }}
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
              className={`absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 ${
                anchor === 'right' ? 'left-1.5' : 'right-1.5'
              }`}
            >
              <X size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {grow === 'down' && body}
    </motion.div>
  )
}

export function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-950/10" />
}
