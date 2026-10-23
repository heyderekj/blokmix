import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Status } from '@/core/types'
import { STATUS_META, STATUS_ORDER } from './status'

/**
 * A frame's header lives in canvas space (it moves with the frame) but renders at
 * screen size, so it stays readable at any zoom.
 */
export function FrameHeader({ width, children, tint, selected }: { width: number; children: ReactNode; tint?: string; selected?: boolean }) {
  return (
    <div
      className="absolute bottom-full left-0 origin-bottom-left pb-2"
      style={{ width: `max(calc(${width}px * var(--z)), min(400px, calc(${width + 280}px * var(--z))))`, transform: 'scale(calc(1 / var(--z)))' }}
      data-chrome
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex h-9 items-center gap-1.5 rounded-xl border px-1.5 text-[13px] shadow-sm backdrop-blur transition-colors duration-300 ${
          selected ? 'ring-2 ring-zinc-900/80' : ''
        }`}
        style={{
          background: tint ? `color-mix(in oklab, ${tint} 12%, var(--header-bg))` : 'var(--header-bg)',
          borderColor: tint ? `color-mix(in oklab, ${tint} 45%, transparent)` : 'var(--header-border)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function HeaderButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  kbd,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  onClick?: (e: React.MouseEvent) => void
  active?: boolean
  disabled?: boolean
  kbd?: string
}) {
  return (
    <button
      type="button"
      title={kbd ? `${label} (${kbd})` : label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={`grid size-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-90 disabled:opacity-30 ${
        active ? 'bg-zinc-950/5 text-zinc-900' : ''
      }`}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  )
}

/** Will King-style status picker: a fanned stack of pills, and the header flashes the new status. */
export function StatusMenu({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = STATUS_META[status]
  const Icon = meta.icon

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={`Status: ${meta.label}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="grid size-7 place-items-center rounded-lg transition hover:bg-zinc-950/5 active:scale-90"
        style={{ color: meta.color }}
      >
        <Icon size={16} strokeWidth={2.25} />
      </button>
      <AnimatePresence>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-2">
            {STATUS_ORDER.map((s, i) => {
              const m = STATUS_META[s]
              const PillIcon = m.icon
              const n = STATUS_ORDER.length
              return (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, y: -16, rotate: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: (n - 1 - i) * 34, rotate: (i - 2) * 2.5, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.85, transition: { duration: 0.14 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26, delay: (n - 1 - i) * 0.03 }}
                  whileHover={{ scale: 1.06, rotate: 0, x: 4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(s)
                    setOpen(false)
                  }}
                  className="absolute left-0 top-0 flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium shadow-md"
                  style={{
                    color: m.color,
                    background: `color-mix(in oklab, ${m.color} 14%, var(--header-bg))`,
                    borderColor: `color-mix(in oklab, ${m.color} 40%, transparent)`,
                    outline: s === status ? `2px solid ${m.color}` : undefined,
                    outlineOffset: 1,
                    zIndex: i,
                  }}
                >
                  <PillIcon size={13} strokeWidth={2.25} />
                  {m.label}
                </motion.button>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Title that briefly shows the new status (in its color) when the status changes. */
export function FlashTitle({ status, children }: { status: Status; children: ReactNode }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(status)
  useEffect(() => {
    if (prev.current === status) return
    prev.current = status
    setFlash(true)
    const t = window.setTimeout(() => setFlash(false), 1300)
    return () => window.clearTimeout(t)
  }, [status])
  const m = STATUS_META[status]
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {flash ? (
          <motion.div
            key="flash"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="truncate font-semibold"
            style={{ color: m.color }}
          >
            {m.label}
          </motion.div>
        ) : (
          <motion.div
            key="title"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="min-w-0"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
