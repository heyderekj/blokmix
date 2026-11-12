import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { router } from '@inertiajs/react'
import { Check } from 'lucide-react'
import { useBuySheet } from '@/state/shipping'
import { useStore } from '@/state/store'
import { canEdit, useAccount } from '@/lib/account'
import { openMixId } from '@/lib/mixSync'

const close = () => useBuySheet.setState({ open: false, what: null })

/** What paying for a site opens, in plain words. Storage is a guardrail, never listed. */
const SITE_OPENS = [
  'Download the code: Astro or Next.js, with BLOKMIX.md for your agent',
  'Hand any version to your agent to build',
  'Every version and export of this site, free from then on',
  'No “Made with Blokmix” badge on blok.page',
] as const

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
 * Paying for this site, when someone tries to ship a mix that isn't paid for yet (state/shipping.ts `canShip`): the
 * pricing ticket from blokmix.com on its pink paint (public/paint/pricing.webp). Free to make, $30 a site when you ship
 * it. Anyone who can edit the mix can pay at Polar; a viewer hears that it's an editor's call.
 */
export function BuySheet() {
  const { open, what } = useBuySheet()
  const { role, archived, buy, price } = useAccount()
  const name = useStore((s) => s.mixName)
  const reduce = useReducedMotion()
  const okRef = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState<string | null>(null)
  const id = openMixId()
  const saved = !!id && id !== 'local'
  const canPay = saved && canEdit(role) && !archived

  useEffect(() => {
    if (!open) return
    setError(null)
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const pay = () =>
    router.post(`/api/mixes/${id}/checkout`, {}, { preserveState: true, preserveScroll: true, onError: (e) => setError(e.buy ?? 'Couldn’t start paying. Try again.') })

  const why = !saved
    ? 'Save this mix to your mixes first, then pay for it there.'
    : archived
      ? 'This mix is archived. Bring it back from your mixes to pay for it.'
      : !canEdit(role)
        ? 'Someone who can edit this mix can pay for it.'
        : 'Paying for sites opens at launch.'

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
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[16px] font-bold text-[#C2185B]">
                <Block size={14} tilt={-6} /> <span className="truncate">{name || 'This site'}</span>
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
                <span className="text-[14px] font-semibold text-zinc-900">Free to make. ${price} a site when you ship it.</span>
              </div>

              <div className="grid gap-2 border-t border-zinc-950/10 pt-4">
                <h2 id="buy-title" className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 [text-wrap:balance]">
                  {what ?? 'Shipping'} needs this site paid for
                </h2>
                <ul className="grid gap-1.5">
                  {SITE_OPENS.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[13.5px] leading-snug text-zinc-600">
                      <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#C2185B]" aria-hidden /> {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {canPay && buy ? (
                  <>
                    <button ref={okRef} type="button" onClick={pay} className="btn-block h-11 cursor-pointer rounded-full px-5 text-[14px] font-semibold">
                      Pay ${price} for this site
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
                    <span className="text-[13px] text-zinc-500">{why}</span>
                  </>
                )}
              </div>
              {error && <p className="-mt-2 text-[13px] text-red-700">{error}</p>}

              <div className="flex items-center gap-3 border-t border-zinc-950/10 pt-4">
                <span aria-hidden className="size-6 shrink-0 rounded-[22%] shadow-[inset_0_0_0_1.5px_currentColor] text-zinc-900" />
                <p className="text-[13px] leading-snug text-zinc-500">
                  <b className="font-semibold text-zinc-900">Making stays free.</b> Every layout, theme and control, as many mixes as you like. A copy of a mix is a new site.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
