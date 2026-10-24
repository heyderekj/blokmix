import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Trash2 } from 'lucide-react'

/**
 * Blokmix's own confirm, in place of the browser's: a card on a dimmed board that names the thing, says what happens,
 * and offers Cancel and the action. `await confirmAction({…})` resolves true when confirmed. It mounts itself on first
 * use, so any page (the board, the mixes page, the waitlist) can call it without placing anything.
 */
export interface ConfirmOptions {
  title: string
  body?: string
  /** The action's words: "Delete mix", "Replace". */
  confirm: string
  cancel?: string
  /** Danger is red with a bin; caution (replacing, overwriting) is the pink key with a warning sign. */
  tone?: 'danger' | 'caution'
}

type Ask = ConfirmOptions & { resolve: (ok: boolean) => void }
let current: Ask | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
let mounted = false

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  if (!mounted) {
    mounted = true
    const host = document.createElement('div')
    host.dataset.confirmHost = ''
    document.body.appendChild(host)
    createRoot(host).render(<ConfirmHost />)
  }
  // A second ask while one is open answers the first with Cancel.
  current?.resolve(false)
  return new Promise((resolve) => {
    current = { ...options, resolve }
    emit()
  })
}

function answer(ok: boolean) {
  if (!current) return
  current.resolve(ok)
  current = null
  emit()
}

function ConfirmHost() {
  const ask = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  )
  const reduce = useReducedMotion()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  const danger = (ask?.tone ?? 'danger') === 'danger'

  useEffect(() => {
    if (!ask) return
    const back = document.activeElement as HTMLElement | null
    // Destructive asks start on Cancel, so a stray Enter never deletes; others start on the action.
    ;(danger ? cancelRef : okRef).current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        answer(false)
      } else if (e.key === 'Tab') {
        // Keep focus on the two buttons.
        e.preventDefault()
        ;(document.activeElement === cancelRef.current ? okRef : cancelRef).current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      back?.focus?.()
    }
  }, [ask, danger])

  return (
    <AnimatePresence>
      {ask && (
        <motion.div
          key="confirm"
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
        >
          <div className="absolute inset-0 bg-[#17121A]/35 backdrop-blur-[3px]" onPointerDown={() => answer(false)} aria-hidden />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={ask.body ? 'confirm-body' : undefined}
            className="relative w-full max-w-[400px] rounded-[22px] bg-[var(--lift)] p-6 text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_30px_70px_-24px_rgb(23_18_26/0.45)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
          >
            <span className={`grid size-11 place-items-center rounded-[14px] ${danger ? 'bg-red-500/10 text-red-600' : 'bg-key-soft text-key-ink'}`} aria-hidden>
              {danger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
            </span>
            <h2 id="confirm-title" className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 [text-wrap:balance]">
              {ask.title}
            </h2>
            {ask.body && (
              <p id="confirm-body" className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 [text-wrap:pretty]">
                {ask.body}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => answer(false)} className="btn-quiet h-10 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold">
                {ask.cancel ?? 'Cancel'}
              </button>
              <button
                ref={okRef}
                type="button"
                onClick={() => answer(true)}
                className="btn-lit h-10 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold"
                style={danger ? ({ '--btn-key': '#e5484d', '--btn-text-shadow': '0 1px 0 rgb(150 20 30 / 0.35)' } as React.CSSProperties) : undefined}
              >
                {ask.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
