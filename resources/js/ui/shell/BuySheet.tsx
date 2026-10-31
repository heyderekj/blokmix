import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { router } from '@inertiajs/react'
import { Check, Lock } from 'lucide-react'
import { PACK_OPENS } from '@/core/plan'
import { needsPack, useBuySheet } from '@/state/plan'
import { useAccount } from '@/lib/account'

const close = () => useBuySheet.setState({ open: false, what: null })
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/**
 * What a mix pack opens, when something on the board needs one (state/plan.ts `needsPack`): $20 once, three mixes,
 * and everything Free leaves out. The mix's owner can buy one at Polar; anyone else hears that it's the owner's call.
 */
export function BuySheet() {
  const { open, what } = useBuySheet()
  const { owns, buy, price } = useAccount()
  const reduce = useReducedMotion()
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="buy"
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
        >
          <div className="absolute inset-0 bg-[#17121A]/35 backdrop-blur-[3px]" onPointerDown={close} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-title"
            className="relative w-full max-w-[420px] rounded-[22px] bg-[var(--lift)] p-6 text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_30px_70px_-24px_rgb(23_18_26/0.45)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
          >
            <span className="grid size-11 place-items-center rounded-[14px] bg-key-soft text-key-ink" aria-hidden>
              <Lock size={20} />
            </span>
            <h2 id="buy-title" className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 [text-wrap:balance]">
              A mix pack opens {what ? lower(what) : 'everything'}
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 [text-wrap:pretty]">
              ${price} once, no subscription. {owns ? 'Buy more whenever you need more mixes.' : 'This mix’s owner is on Free; a pack is theirs to get.'}
            </p>
            <ul className="mt-4 grid gap-1.5">
              {PACK_OPENS.map((line) => (
                <li key={line} className="flex items-start gap-2 text-[13.5px] leading-snug text-zinc-700">
                  <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-key-ink" aria-hidden /> {line}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-end gap-2">
              {owns && !buy && <span className="mr-auto text-[12.5px] text-zinc-500">Mix packs are coming soon.</span>}
              <button type="button" onClick={close} className="btn-quiet h-10 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold">
                {owns && buy ? 'Not now' : 'OK'}
              </button>
              {owns && buy && (
                <button ref={okRef} type="button" onClick={() => router.post('/api/billing/checkout')} className="btn-lit h-10 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold">
                  Get a mix pack, ${price}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** A quiet line atop a control Free leaves out: you can look and preview; using it opens the buy sheet. */
export function PackNote({ what }: { what: string }) {
  const paid = useAccount((s) => s.paid)
  if (paid) return null
  return (
    <button
      type="button"
      onClick={() => needsPack(what)}
      className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-key-soft/60 px-2.5 py-2 text-left text-[12px] font-medium text-key-ink transition-[scale] duration-150 active:scale-[0.97]"
    >
      <Lock size={13} className="shrink-0" /> {what} come with a mix pack. Preview them here.
    </button>
  )
}
