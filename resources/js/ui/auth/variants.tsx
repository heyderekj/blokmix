import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Wordmark } from '@/ui/brand/Wordmark'

/**
 * Branded takes on the sign-in card (labs: /labs/sign-in). Same props as AuthCard,
 * so the one we keep drops in. All from the brand guide: paper, ink and concrete carry
 * the page, hot pink is the drop (the block and the primary button, ink text on it).
 */
type Props = { title: string; lede?: string; onSubmit: (e: FormEvent) => void; children: ReactNode; footer?: ReactNode }

const PINK = '#FF69B4'
const INK = '#17121A'
const PAPER = '#FBF8F9'
const CONCRETE = '#2A2130'

/** Fields and the button on paper, with the brand's pink primary. */
const onPaper = {
  '--auth-field': '#F3EDF0',
  '--auth-ink': INK,
  '--auth-label': '#6B5F68',
  '--auth-focus': 'rgb(255 105 180 / 0.45)',
  '--auth-button': PINK,
  '--auth-button-ink': INK,
  '--auth-button-hover': '#FF1493',
} as CSSProperties

/** The lifted block: tilted −9° toward a top-left light, with its shadow. */
function LiftedBlock({ size, className = '', style }: { size: number; className?: string; style?: CSSProperties }) {
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

/** A slot carved into the canvas, where a block came from. */
function Slot({ size, className = '' }: { size: number; className?: string }) {
  return <span aria-hidden className={`pointer-events-none absolute rounded-[20%] bg-[#E9E1E6] shadow-[inset_0_3px_6px_rgb(23_18_26/0.12)] ${className}`} style={{ width: size, height: size }} />
}

const dots = (color: string, gap = 24): CSSProperties => ({
  backgroundImage: `radial-gradient(${color} 1.2px, transparent 1.3px)`,
  backgroundSize: `${gap}px ${gap}px`,
})

function Form({ title, lede, onSubmit, children, dark = false }: Omit<Props, 'footer'> & { dark?: boolean }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(e)
      }}
    >
      <h1 className={`text-[24px] font-bold tracking-tight text-balance ${dark ? 'text-[#FBF8F9]' : 'text-[#17121A]'}`}>{title}</h1>
      {lede && <p className={`mt-1 text-[14px] text-pretty ${dark ? 'text-[#B9AEB6]' : 'text-[#6B5F68]'}`}>{lede}</p>}
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </form>
  )
}

/** A · Canvas: the dotted board, the card as a block on it, the pink one lifted out of its slot. */
export function AuthCanvas({ footer, ...form }: Props) {
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-4 py-12" style={{ background: PAPER, ...dots('#DDD2D9'), ...onPaper }}>
      <div className="relative w-full max-w-[380px]">
        <div className="mb-7 flex justify-center text-[#17121A]">
          <Wordmark height={26} />
        </div>
        <div className="relative">
          <Slot size={72} className="-right-[52px] -top-[44px] max-sm:hidden" />
          <LiftedBlock size={72} className="-right-[40px] -top-[62px] max-sm:hidden" />
          <div className="relative rounded-[22px] bg-white p-7 shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_24px_48px_-24px_rgb(23_18_26/0.28)]">
            <Form {...form} />
          </div>
        </div>
        {footer && <p className="mt-5 text-center text-[13px] text-[#6B5F68] [&_a]:text-[#C2185B]">{footer}</p>}
      </div>
    </div>
  )
}

/** B · Poster: an ink panel with the line and a pegboard of sections, one lifted in pink; the form on paper. */
export function AuthPoster({ footer, ...form }: Props) {
  return (
    <div className="grid min-h-full md:grid-cols-[1.1fr_1fr]" style={onPaper}>
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 md:flex" style={{ background: INK, ...dots('#2E2533', 28) }}>
        <span className="text-[#FBF8F9]">
          <Wordmark height={24} />
        </span>
        <div className="relative mx-auto w-full max-w-[340px]">
          {/* The pegboard: sections of a page as cards, the sampled one lifted off in pink. */}
          <div className="flex flex-col gap-2.5">
            {[44, 88, 64, 52].map((h, i) => (
              <div key={i} className="relative rounded-[14px] p-3.5" style={{ height: h, background: CONCRETE }}>
                <span className="block h-2 w-1/3 rounded-full bg-[#3B3141]" />
                {h > 50 && <span className="mt-2 block h-2 w-2/3 rounded-full bg-[#3B3141]" />}
                {i === 1 && (
                  <span className="absolute inset-0 -translate-y-3 translate-x-4 -rotate-[6deg] rounded-[14px] bg-[#FF5CB0] p-3.5 shadow-[0_18px_32px_-12px_rgb(0_0_0/0.6),inset_0_2px_0_rgb(255_255_255/0.3)]">
                    <span className="block h-2 w-1/3 rounded-full bg-[#17121A]/25" />
                    <span className="mt-2 block h-2 w-2/3 rounded-full bg-[#17121A]/25" />
                    <span className="mt-2 block h-2 w-1/2 rounded-full bg-[#17121A]/25" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[34px] font-extrabold leading-[1.05] tracking-tight text-balance text-[#FBF8F9]">Sample the web, block by block.</p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.09em] text-[#8C7F89]">Any section · any site · Astro + Next.js</p>
        </div>
      </aside>
      <main className="grid place-items-center px-6 py-12" style={{ background: PAPER }}>
        <div className="w-full max-w-[360px]">
          <span className="mb-8 block text-[#17121A] md:hidden">
            <Wordmark height={22} />
          </span>
          <Form {...form} />
          {footer && <p className="mt-6 text-[13px] text-[#6B5F68] [&_a]:text-[#C2185B]">{footer}</p>}
        </div>
      </main>
    </div>
  )
}

/** C · Flyer: ink and concrete, a liner-notes line, the pink block lifted behind the card. */
export function AuthFlyer({ footer, ...form }: Props) {
  const onInk = {
    '--auth-field': '#1E1823',
    '--auth-ink': PAPER,
    '--auth-label': '#A79BA4',
    '--auth-focus': 'rgb(255 105 180 / 0.55)',
    '--auth-button': PINK,
    '--auth-button-ink': INK,
    '--auth-button-hover': '#FF1493',
  } as CSSProperties
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-4 py-12" style={{ background: INK, ...dots('#2A2130'), ...onInk }}>
      <div className="relative w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <span className="inline-block text-[#FBF8F9]">
            <Wordmark height={28} />
          </span>
          <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.09em] text-[#8C7F89]">
            <span className="size-1.5 rounded-[2px] bg-[#FF69B4]" /> Sample the web · block by block
          </p>
        </div>
        <div className="relative">
          <LiftedBlock size={96} className="-bottom-[34px] -left-[42px] max-sm:hidden" />
          <div className="relative rounded-[22px] p-7 shadow-[0_0_0_1px_rgb(255_255_255/0.06),0_30px_60px_-24px_rgb(0_0_0/0.7)]" style={{ background: CONCRETE }}>
            <Form {...form} dark />
          </div>
        </div>
        {footer && <p className="mt-6 text-center text-[13px] text-[#A79BA4] [&_a]:text-[#FF69B4]">{footer}</p>}
      </div>
    </div>
  )
}
