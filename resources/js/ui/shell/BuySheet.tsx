import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { router } from '@inertiajs/react'
import { Check, Lock } from 'lucide-react'
import { PLUS_OPENS } from '@/core/plan'
import { needsPlus, useBuySheet } from '@/state/plan'
import { useAccount } from '@/lib/account'

const close = () => useBuySheet.setState({ open: false, what: null })
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The brand's pink block, as on blokmix.com: a soft top, a deep edge, and a drip of paint off its bottom. */
function Block({ size, tilt = 0 }: { size: number; tilt?: number }) {
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size, rotate: `${tilt}deg` }}>
      <span className="absolute inset-0 rounded-[22%] bg-[linear-gradient(160deg,#FF9ACD,#FF5CB0_55%)] shadow-[inset_0_-2px_0_rgb(194_24_91/0.6)]" />
      {size >= 20 && (
        <>
          <span className="absolute left-[58%] top-[86%] h-[34%] w-[13%] rounded-b-full bg-[#FF5CB0]" />
          <span className="absolute left-[59.5%] top-[128%] aspect-square w-[10%] rounded-full bg-[#FF5CB0]" />
        </>
      )}
    </span>
  )
}

/**
 * What Plus opens, when something on the board needs it (state/plan.ts `needsPlus`): the pricing ticket from blokmix.com
 * on its pink paint (public/paint/pricing.webp, the site's baked still). $25 once, every mix and everything Free leaves
 * out. The mix's owner can buy it at Polar; anyone else hears that it's the owner's call.
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
            className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] bg-[#FF5CB0] p-4 text-left shadow-[0_30px_70px_-24px_rgb(23_18_26/0.55)] sm:p-8"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
          >
            <img src="/paint/pricing.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover" />
            <div className="relative grid max-h-[calc(100dvh-64px)] gap-5 overflow-y-auto rounded-[18px] bg-[var(--lift)] p-6 shadow-[0_0_0_1px_rgb(23_18_26/0.1),0_24px_48px_-24px_rgb(194_24_91/0.7)]">
              <span className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#C2185B]">
                <Block size={14} tilt={-6} /> Plus
              </span>
              <p className="-mt-2 flex items-baseline gap-2 text-[16px] text-zinc-500">
                <b className="text-[52px] font-extrabold leading-none tracking-[-0.04em] text-zinc-900 tabular-nums">${price}</b> once
              </p>
              <div className="flex items-center gap-3">
                <span className="flex gap-2 pb-2">
                  <Block size={24} />
                  <Block size={24} tilt={-4} />
                  <Block size={24} tilt={3} />
                </span>
                <span className="text-[14px] font-semibold text-zinc-900">Every feature, every mix</span>
              </div>

              <div className="grid gap-2 border-t border-zinc-950/10 pt-4">
                <h2 id="buy-title" className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 [text-wrap:balance]">
                  Plus opens {what ? lower(what) : 'everything'}
                </h2>
                <ul className="grid gap-1.5">
                  {PLUS_OPENS.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[13.5px] leading-snug text-zinc-600">
                      <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#C2185B]" aria-hidden /> {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {owns && buy ? (
                  <>
                    <button ref={okRef} type="button" onClick={() => router.post('/api/billing/checkout')} className="btn-block h-11 cursor-pointer rounded-full px-5 text-[14px] font-semibold">
                      Get Plus, ${price}
                    </button>
                    <button type="button" onClick={close} className="cursor-pointer text-[13.5px] font-semibold text-zinc-500 hover:text-zinc-900">
                      Not now
                    </button>
                  </>
                ) : (
                  <>
                    <button ref={okRef} type="button" onClick={close} className="btn-block h-11 cursor-pointer rounded-full px-6 text-[14px] font-semibold">
                      OK
                    </button>
                    <span className="text-[13px] text-zinc-500">{owns ? 'Plus opens at launch.' : 'This mix’s owner is on Free; Plus is theirs to get.'}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-950/10 pt-4">
                <span aria-hidden className="size-6 shrink-0 rounded-[22%] shadow-[inset_0_0_0_1.5px_currentColor] text-zinc-900" />
                <p className="text-[13px] leading-snug text-zinc-500">
                  <b className="font-semibold text-zinc-900">{owns ? 'You’re on Free.' : 'Free'}</b> 1 mix, the core layouts and themes, and the Feel dials.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** A quiet note where something needs Plus (Effects, backdrops): previews stay, using one opens the sheet. */
export function PackNote({ what }: { what: string }) {
  const paid = useAccount((s) => s.paid)
  if (paid) return null
  return (
    <button
      type="button"
      onClick={() => needsPlus(what)}
      className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-key-soft/60 px-2.5 py-2 text-left text-[12px] font-medium text-key-ink transition-[scale] duration-150 active:scale-[0.97]"
    >
      <Lock size={13} className="shrink-0" /> {what} come with Plus. Preview them here.
    </button>
  )
}
