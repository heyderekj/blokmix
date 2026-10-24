import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'
import type { Status } from '@/core/types'
import { STATUS_INK, STATUS_META, STATUS_ORDER } from './status'

/**
 * A frame's header lives in canvas space (it moves with the frame) but renders at
 * screen size, so it stays readable at any zoom.
 */
export function FrameHeader({ width, children, tint, selected, dim }: { width: number; children: ReactNode; tint?: string; selected?: boolean; dim?: boolean }) {
  return (
    <div
      className="@container absolute bottom-full left-0 z-30 origin-bottom-left pb-2"
      style={{ width: `max(calc(${width}px * var(--z)), 56px)`, transform: 'scale(calc(1 / var(--z)))' }}
      data-chrome
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex min-h-12 items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-1.5 text-[13px] shadow-sm backdrop-blur transition-colors duration-300 ${
          selected ? 'ring-2 ring-zinc-900/80' : ''
        } ${dim ? 'opacity-70' : ''} min-w-0 @max-[180px]:justify-center @max-[180px]:px-1`}
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
export function StatusMenu({ status, onChange, trigger }: { status: Status; onChange: (s: Status) => void; trigger?: ReactNode }) {
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
        className={trigger ? 'group/status block rounded-full transition active:scale-[0.97]' : 'grid size-8 place-items-center rounded-full transition hover:bg-zinc-950/5 active:scale-[0.97]'}
        style={trigger ? undefined : { color: meta.color }}
      >
        {trigger ?? <Icon size={16} strokeWidth={2.25} />}
      </button>
      <AnimatePresence>
        {open && (
          <div className="absolute bottom-full right-0 z-50 mb-2">
            {STATUS_ORDER.map((s, i) => {
              const m = STATUS_META[s]
              const PillIcon = m.icon
              const n = STATUS_ORDER.length
              return (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, y: 16, x: 0, rotate: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: -(n - 1 - i) * 34, x: -(n - 1 - i) * 14, rotate: -(n - 1 - i) * 2, scale: 1 }}
                  exit={{ opacity: 0, y: 10, x: 0, scale: 0.85, transition: { duration: 0.14 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26, delay: (n - 1 - i) * 0.03 }}
                  whileHover={{ scale: 1.06, rotate: 0 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(s)
                    setOpen(false)
                  }}
                  className={`glass-menu absolute bottom-0 right-0 flex h-7 origin-bottom-right items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ${
                    s === status ? '' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                  style={{
                    ...(s === status
                      ? {
                          color: STATUS_INK[s],
                          background: `color-mix(in oklab, ${m.color} 18%, var(--lift))`,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 45%, transparent), 0 6px 16px -8px rgb(0 0 0 / 0.3)`,
                        }
                      : {}),
                    zIndex: i,
                  }}
                >
                  <PillIcon size={13} strokeWidth={2.25} style={{ color: s === status ? m.color : undefined }} />
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

/** Tier one of a header: a bold name over a quiet line of facts. */
export function HeaderTitle({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 @max-[180px]:hidden">
      <div className="truncate text-[15px] font-semibold leading-tight text-zinc-900">{title}</div>
      {meta && <div className="truncate text-[12px] leading-snug text-zinc-500">{meta}</div>}
    </div>
  )
}

export interface MenuItem {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/** Everything that isn't the one strong action lives here. */
export function OverflowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])
  return (
    <div ref={ref} className="relative @max-[260px]:hidden">
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        title="More"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`grid size-8 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] ${open ? 'bg-zinc-950/5 text-zinc-900' : ''}`}
      >
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className="glass-menu absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-2xl p-1.5"
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  it.onClick()
                }}
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition disabled:opacity-30 ${
                  it.danger ? 'text-zinc-700 hover:bg-problem-soft hover:text-problem-ink' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'
                }`}
              >
                <it.icon size={15} />
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The version letter wearing its status as a ring: dashed while in progress (turning only while you point at it), solid
 * after, with a badge once it's been judged. `small` is the gallery's size.
 */
export function StatusRing({ letter, status, small }: { letter: string; status: Status; small?: boolean }) {
  const m = STATUS_META[status]
  const dashed = status === 'in-progress'
  const badge = status === 'ready' || status === 'changes' || status === 'approved'
  return (
    <span className={`relative grid shrink-0 place-items-center ${small ? 'size-7' : 'size-10'}`}>
      <svg viewBox="0 0 40 40" className={`absolute inset-0 transition-transform ${dashed ? 'group-hover/status:animate-[spin_6s_linear_infinite] motion-reduce:!animate-none' : ''}`} aria-hidden>
        <circle cx="20" cy="20" r="18" fill="var(--lift)" stroke={m.color} strokeWidth="2.5" strokeDasharray={dashed ? '5 4' : undefined} />
      </svg>
      <span className={`relative font-bold text-zinc-900 ${small ? 'text-[11.5px]' : 'text-[15px]'}`}>{letter}</span>
      <AnimatePresence>
        {badge && (
          <motion.span
            key={status}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 26 }}
            className={`absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full text-white ring-2 ring-[var(--lift)] ${small ? 'size-3' : 'size-4'}`}
            style={{ background: m.color }}
          >
            <m.icon size={small ? 8 : 10} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
