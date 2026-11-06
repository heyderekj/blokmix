import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * A row of choices in the Style panel that scrolls sideways instead of growing tall, under one line with its title,
 * whatever sits beside it (a Suggested/All switch), ‹ › to page through, and the chosen tile kept in view. Tiles carry `data-on` when chosen.
 */
export function Strip({ label, title, top, watch, children }: { label: string; title?: string; top?: ReactNode; watch?: unknown; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = row.current
    const on = el?.querySelector<HTMLElement>('[data-on]')
    if (!el || !on) return
    const l = on.offsetLeft - el.offsetLeft
    if (l < el.scrollLeft || l + on.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollTo({ left: l - 12, behavior: 'smooth' })
  }, [watch])
  const arrows = (floating: boolean) => (
    <span className={floating ? 'pointer-events-none absolute inset-y-0 -right-1.5 flex items-center' : 'flex gap-0.5'}>
      {([-1, 1] as const).filter((dir) => !floating || dir > 0).map((dir) => (
        <button
          key={dir}
          type="button"
          aria-label={dir < 0 ? 'Earlier' : 'More'}
          onClick={() => row.current?.scrollBy({ left: dir * 216, behavior: 'smooth' })}
          className={`pointer-events-auto grid size-6 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.92] ${floating ? 'bg-[var(--lift)] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_6px_-2px_rgb(0_0_0/0.25)]' : ''}`}
        >
          {dir < 0 ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      ))}
    </span>
  )
  const head = !!(title || top)
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      {head && (
        <div className="flex min-h-6 items-center gap-2">
          {title && <h3 className="text-[11px] font-semibold text-zinc-400">{title}</h3>}
          <div className="min-w-0 flex-1">{top}</div>
          {arrows(false)}
        </div>
      )}
      <div className="relative">
        <div
          ref={row}
          role="radiogroup"
          aria-label={label}
          className="-mx-3 flex snap-x gap-2 overflow-x-auto scroll-smooth px-3 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: 12, maskImage: 'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 24px), transparent 100%)' }}
        >
          {children}
        </div>
        {/* With no line above it, one "more" button rides on the row's faded edge. */}
        {!head && arrows(true)}
      </div>
    </div>
  )
}
