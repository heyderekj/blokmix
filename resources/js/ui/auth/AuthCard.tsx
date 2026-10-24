import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Wordmark } from '@/ui/brand/Wordmark'

/**
 * The sign-in and sign-up card, on the brand's canvas: a paper board with dots, the
 * card set on it like a block, and the pink block lifted out of its slot beside it.
 * Paper and ink carry the page; hot pink is the drop (the block and the one action,
 * with ink text on it).
 */
export function AuthCard({ title, lede, onSubmit, children, footer }: { title: string; lede?: string; onSubmit: (e: FormEvent) => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      className="relative grid min-h-full place-items-center overflow-hidden px-4 py-12"
      style={{ background: '#FBF8F9', backgroundImage: 'radial-gradient(#DDD2D9 1.2px, transparent 1.3px)', backgroundSize: '24px 24px' }}
    >
      <div className="relative w-full max-w-[380px]">
        <div className="mb-7 flex justify-center text-[#17121A]">
          {/* One color here: the pink block beside the card is the drop. */}
          <Wordmark height={26} mono />
        </div>
        <div className="relative">
          <Slot size={72} className="-right-[52px] -top-[44px] max-sm:hidden" />
          <LiftedBlock size={72} className="-right-[40px] -top-[62px] max-sm:hidden" />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit(e)
            }}
            className="relative rounded-[22px] bg-white p-7 shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_24px_48px_-24px_rgb(23_18_26/0.28)]"
          >
            <h1 className="text-[24px] font-bold tracking-tight text-balance text-[#17121A]">{title}</h1>
            {lede && <p className="mt-1 text-[14px] text-pretty text-[#6B5F68]">{lede}</p>}
            <div className="mt-6 flex flex-col gap-3">{children}</div>
          </form>
        </div>
        {footer && <p className="mt-5 text-center text-[13px] text-[#6B5F68] [&_a]:text-[#C2185B]">{footer}</p>}
      </div>
    </div>
  )
}

/** The lifted block: tilted −9° toward a top-left light, with its side and shadow. */
export function LiftedBlock({ size, className = '', style }: { size: number; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`} style={{ width: size, height: size, ...style }}>
      <span className="absolute inset-0 translate-x-[8%] translate-y-[10%] -rotate-[9deg] rounded-[22%] bg-[rgb(23_18_26/0.16)] blur-[6px]" />
      <span className="absolute inset-0 translate-y-[6%] -rotate-[9deg] rounded-[22%] bg-[#C2185B]" />
      <span className="absolute inset-0 -rotate-[9deg] rounded-[22%] bg-[#FF5CB0] shadow-[inset_0_2px_0_rgb(255_255_255/0.35)]">
        <span className="absolute inset-x-[8%] top-[6%] h-[22%] rounded-full bg-[#FF8CC6]" />
      </span>
    </span>
  )
}

/** The slot carved into the canvas, where the block came from. */
export function Slot({ size, className = '' }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-[20%] bg-[#E4D9DF] shadow-[inset_0_4px_8px_rgb(23_18_26/0.18),inset_0_0_0_1px_rgb(23_18_26/0.06)] ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function Field({ label, error, ...input }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[#6B5F68]">{label}</span>
      <input
        {...input}
        aria-invalid={!!error}
        className="h-11 w-full rounded-xl bg-[#F3EDF0] px-3.5 text-[15px] text-[#17121A] outline-none transition-[box-shadow] duration-150 placeholder:text-[#9C8F99] focus:ring-2 focus:ring-[#FF69B4]/45 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500/40"
      />
      {error && <span className="mt-1.5 block text-[12.5px] text-red-600">{error}</span>}
    </label>
  )
}

/** The one action: hot pink with ink text (never white), deep pink on hover. */
export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="btn-block mt-1 h-11 w-full cursor-pointer rounded-full text-[14px] font-semibold"
    >
      {children}
    </button>
  )
}
