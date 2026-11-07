// Pieces the guided start draws with: start cards, theme cards, the score ring and the kind tile.
import { Children, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { Kind, SectionType } from '@/core/types'
import { guideFor } from '@/core/start'
import { KIND_FEEL, themesFor } from '@/core/feel'
import { skinList, skinOpen, WIREFRAME, type Skin } from '@/core/skins'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import type { ScoredStart } from '@/lib/start'
import type { Palette as Colors } from '@/core/palette'
import { SkinPreview } from '@/ui/skins/SkinPreview'

export const INK = '#17121A'
export const PINK = '#FF69B4'
export const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
export const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
export const CARD = `rounded-[18px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08)] ${PRESS}`
export const ON = 'shadow-[0_0_0_2px_#FF69B4,0_16px_32px_-20px_rgb(255_105_180/0.6)]'
// The app's lit pink button, the step's one main action.
export const PRIMARY = `btn-lit flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold disabled:pointer-events-none disabled:opacity-45 ${PRESS}`
export const QUIET = `flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`

/** A skin, drawn as your actual page in it. */
export function SkinCard({ skin, on, start, brand, palette, mode, jevPick, onPick }: { skin: Skin; on: boolean; start: Pick<ScoredStart, 'site' | 'content'>; brand: string | null; palette: Colors | null; mode: 'light' | 'dark' | undefined; jevPick: boolean; onPick: () => void }) {
  const guide = useMemo(() => guideFor({ skin: skin.id, brand, mode, palette }), [skin.id, brand, mode, palette])
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={`${CARD} overflow-hidden ${on ? ON : `${HOVER}shadow-[0_0_0_1px_rgb(23_18_26/0.16)]`}`}>
      <span className="block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={guide} content={start.content} title={skin.name} height={160} />
      </span>
      <span className="block px-4 py-3">
        <span className="flex items-center justify-between gap-2 text-[15px] font-semibold">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{skin.name}</span>
            {jevPick && <span className="shrink-0 rounded-full bg-[#FFE4F2] px-2 py-0.5 font-sans text-[10.5px] font-semibold text-[#B0186A]">Best fit</span>}
          </span>
          {on && <Check size={16} style={{ color: PINK }} />}
        </span>
      </span>
    </button>
  )
}

/**
 * A row of cards that scrolls sideways, each at least `min` wide, so a card never gets too narrow to read its page.
 * Swipe or scroll it; ‹ › show on the side that has more.
 */
export function Carousel({ children, label, min = 280 }: { children: ReactNode; label: string; min?: number }) {
  const row = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ back: false, on: false })
  const check = useCallback(() => {
    const el = row.current
    if (!el) return
    setMore({ back: el.scrollLeft > 4, on: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])
  useLayoutEffect(() => {
    const el = row.current
    if (!el) return
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [check, children])
  const step = (dir: 1 | -1) => {
    const el = row.current
    if (el) el.scrollBy({ left: dir * (min + 12), behavior: 'smooth' })
  }
  const arrow = `absolute top-[80px] z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white text-[#17121A] shadow-[0_0_0_1px_rgb(23_18_26/0.1),0_6px_16px_-6px_rgb(23_18_26/0.35)] ${PRESS}`
  return (
    <div className="relative -mx-1">
      <div
        ref={row}
        role="group"
        aria-label={label}
        onScroll={check}
        className="flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div className="flex shrink-0 snap-start [&>*]:w-full" style={{ width: `max(${min}px, calc((100% - 24px) / 3))` }}>
            {child}
          </div>
        ))}
      </div>
      {more.back && (
        <button type="button" aria-label="Back" onClick={() => step(-1)} className={`${arrow} -left-2`}>
          <ChevronLeft size={18} />
        </button>
      )}
      {more.on && (
        <button type="button" aria-label="More" onClick={() => step(1)} className={`${arrow} -right-2`}>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}

/** One start: its page on a laptop (hover pans down it), what's in it, and only what needs a look. The card is the pick. */
export function StartCard({ start, letter, best, busy, sections, onPick }: { start: ScoredStart; letter: string; best: boolean; busy?: boolean; sections: boolean; onPick: () => void }) {
  const { checks, phoneScreens, score } = start.score
  const misses = checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight)
  const name = start.from === 'starter' ? start.label.replace(/^Starter: /, '') : start.label
  const types = firstPage(start)
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-label={`Open ${letter}: ${name}${misses.length ? `. ${misses[0].words}` : ''}`}
      className={`group flex flex-col overflow-hidden rounded-[16px] bg-white text-left shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_18px_36px_-26px_rgb(23_18_26/0.35)] ${PRESS} disabled:pointer-events-none disabled:opacity-60 ${HOVER}shadow-[0_0_0_2px_#FF69B4,0_18px_36px_-22px_rgb(255_105_180/0.55)]`}
    >
      <span className="relative block border-b border-zinc-950/5">
        <SkinPreview site={start.site} guide={start.guide} content={start.content} title={`Start ${letter}`} height={196} peek />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        {best && <span className="absolute bottom-2 left-3 rounded-full bg-[#FF69B4] px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_2px_6px_-2px_rgb(194_40_111/0.6)]">Holds up best</span>}
      </span>
      <span className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <span className="flex items-center gap-2">
          <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-[#17121A] text-[10.5px] font-semibold text-white">{letter}</span>
          <span className="min-w-0 truncate text-[14.5px] font-semibold leading-tight">{name}</span>
          {misses.length > 0 && <Score value={score} />}
        </span>
        {sections && <span className="text-[12.5px] leading-snug text-[#6B5F68] [text-wrap:pretty]">{sectionWords(types).replace(/^./, (c) => c.toUpperCase())}</span>}
        {misses.length > 0 && <span className="line-clamp-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[12px] leading-snug text-amber-900 [text-wrap:pretty]">{misses[0].words}</span>}
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-950/[0.06] pt-2.5">
          <span className="text-[11.5px] text-[#9A8E97]">{phoneScreens !== null && `${Math.max(1, Math.round(phoneScreens))} screens on a phone`}</span>
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#17121A] opacity-75 transition-opacity duration-150 group-hover:opacity-100">
            Open {letter} <ArrowRight size={14} className="transition-[translate] duration-150 ease-out group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </button>
  )
}

/** A page's sections in plain words, nav and footer left out: "a big opener, what you offer, questions". */
const SECTION_WORDS: Record<SectionType, string> = {
  nav: 'a menu',
  header: 'a page title',
  hero: 'a big opener',
  logos: 'who uses it',
  features: 'what you offer',
  stats: 'numbers',
  content: 'your story',
  gallery: 'pictures',
  team: 'the team',
  testimonials: 'what people say',
  blog: 'posts',
  faq: 'questions',
  contact: 'how to reach you',
  cta: 'a last nudge',
  pricing: 'prices',
  footer: 'a footer',
}
export function sectionWords(types: SectionType[], max = 5): string {
  const all = [...new Set(types.filter((t) => t !== 'nav' && t !== 'footer').map((t) => SECTION_WORDS[t]))]
  const said = all.length > max ? [...all.slice(0, max - 1), 'more'] : all
  return said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}` : (said[0] ?? 'a blank page')
}

export const firstPage = (start: ScoredStart): SectionType[] => (start.site.pages[0]?.slots ?? []).map((x) => x.type)

/** The look a new start opens in: Jev's pick, else the theme that fits this kind best, never the grey sketch. */
export function firstTheme(looks: string[], kind: Kind): string {
  const open = skinList().filter((x) => skinOpen(library, x))
  return looks.find((id) => open.some((x) => x.id === id)) ?? themesFor(KIND_FEEL[kind], open, { count: 1 })[0]?.id ?? WIREFRAME
}

export function Score({ value }: { value: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-9 shrink-0 place-items-center" title={`${value} out of 100`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#F1E9EE" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="4" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-[11px] font-bold tabular-nums">{value}</span>
    </span>
  )
}

/** Every skin's fonts, so the cards draw in them. */
export function useSkinFonts() {
  useEffect(() => {
    const hrefs = new Set(skinList().flatMap((v) => fontHrefs(fontsForTokens(resolveGuide(guideFor({ skin: v.id })).tokens, []))))
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])
}

/** A kind's icon in a slot carved into the paper; picked, it lifts out as the pink block, tilted, the icon in white. */
export function KindTile({ icon: Icon, on }: { icon: LucideIcon; on: boolean }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <span className="absolute inset-0 rounded-[30%] bg-zinc-100 shadow-[inset_0_2px_4px_rgb(0_0_0/0.1),inset_0_0_0_1px_rgb(0_0_0/0.05)]" />
      <span
        className={`absolute inset-0 grid place-items-center rounded-[30%] bg-[#FF5CB0] text-white shadow-[0_3px_0_#C2185B,0_8px_14px_-6px_rgb(194_24_91/0.6),inset_0_2px_0_rgb(255_255_255/0.35)] transition-[opacity,transform] duration-200 ease-out ${on ? '-translate-y-1 rotate-[-8deg] opacity-100' : 'translate-y-0 rotate-0 opacity-0'}`}
      >
        <Icon size={17} strokeWidth={2.2} />
      </span>
      {!on && <Icon size={17} className="relative text-zinc-500" />}
    </span>
  )
}
