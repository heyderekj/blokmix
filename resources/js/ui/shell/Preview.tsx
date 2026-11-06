import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AlignLeft,
  Building2,
  ChartColumn,
  CircleHelp,
  CreditCard,
  Heading,
  Images,
  LayoutGrid,
  Mail,
  MousePointerClick,
  Newspaper,
  PanelBottom,
  PanelTop,
  Quote,
  Star,
  Users,
} from 'lucide-react'
import type { Clip, SectionType, Slot } from '@/core/types'
import { DEFAULT_KEEP } from '@/core/types'
import { useStore } from '@/state/store'
import { frameStateFor, usePageStyle, useResolvedGuide } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'

const PAGE_W = 1280

/** One small, recognisable mark per section type, for pickers and menus. */
export const TYPE_ICON: Record<SectionType, typeof Star> = {
  nav: PanelTop,
  hero: Star,
  header: Heading,
  logos: Building2,
  features: LayoutGrid,
  stats: ChartColumn,
  content: AlignLeft,
  gallery: Images,
  team: Users,
  testimonials: Quote,
  pricing: CreditCard,
  blog: Newspaper,
  faq: CircleHelp,
  contact: Mail,
  cta: MousePointerClick,
  footer: PanelBottom,
}

/** The one card size for layout thumbnails (the Crate, a section's Layouts strip): 16:10. */
export const CARD_W = 240
export const CARD_H = 150

/** How far the bottom of a cropped section fades into the page color, in card pixels. */
const FADE = 36

/**
 * True once the element has come near the scroller's view (horizontally: the strips scroll sideways). Previews are
 * live frames, so only those in reach load. Off (`enabled` false) it is near at once.
 */
export function useNear<T extends HTMLElement>(scroller: RefObject<HTMLElement | null> | undefined, enabled = true) {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(!enabled)
  useEffect(() => {
    if (near || !ref.current) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), {
      root: scroller?.current ?? null,
      rootMargin: '0px 480px',
    })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [near, scroller])
  return [ref, near] as const
}

/**
 * A live section as a thumbnail: drawn at a 1280px page and scaled to the box's width, never smaller, so its words
 * stay legible. A short section (a nav, a logo row) sits centered on the page color; a tall one is cropped from the
 * top and fades out at the bottom. Until the frame has measured itself, a page-color skeleton holds its place.
 * Given a `scroller`, the frame mounts only once the box comes near its view.
 */
export const Preview = memo(function Preview({
  clip,
  slot,
  width,
  height,
  scroller,
  className = '',
}: {
  clip: Clip
  slot?: Pick<Slot, 'keep' | 'words' | 'edits'> | null
  width: number
  height: number
  scroller?: RefObject<HTMLElement | null>
  className?: string
}) {
  const [box, near] = useNear<HTMLDivElement>(scroller, !!scroller)
  const mode = useStore((s) => s.ui.mode)
  const guide = useResolvedGuide()
  const own = mode === 'unified' && !slot?.keep.style
  const bg = own ? guide.tokens['color.bg'] : clip.tokens['color.bg']
  const ink = own ? guide.tokens['color.text'] : clip.tokens['color.text']
  const [h, setH] = useState(0)
  const scale = width / PAGE_W
  const shown = h * scale
  const tall = shown > height
  const top = h && !tall ? (height - shown) / 2 : 0
  const fade = tall ? `linear-gradient(to bottom, #000 calc(100% - ${FADE}px), transparent)` : undefined
  return (
    <div ref={box} className={`relative overflow-hidden ${className}`} style={{ width, height, background: bg }}>
      <Skeleton ink={String(ink ?? 'currentColor')} shown={!h} />
      {near && (
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: fade, WebkitMaskImage: fade }}>
          <div
            className="absolute left-0 origin-top-left transition-opacity duration-300"
            style={{ top, width: PAGE_W, transform: `scale(${scale})`, opacity: h ? 1 : 0, transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
          >
            <Frame clip={clip} slot={slot} onHeight={setH} />
          </div>
        </div>
      )}
    </div>
  )
})

/** The live frame itself, apart so the box can show its skeleton before any of the frame's work is done. */
function Frame({ clip, slot, onHeight }: { clip: Clip; slot?: Pick<Slot, 'keep' | 'words' | 'edits'> | null; onHeight: (h: number) => void }) {
  const mode = useStore((s) => s.ui.mode)
  const content = useStore((s) => s.content)
  const guide = useResolvedGuide()
  const page = usePageStyle()
  const state = useMemo(
    () => frameStateFor(clip, slot ?? { keep: DEFAULT_KEEP }, mode, guide.tokens, content, 'desktop', page),
    [clip, slot, mode, guide.tokens, content, page],
  )
  return <ClipFrame clip={clip} width={PAGE_W} state={state} onHeight={onHeight} />
}

/** Two faint bars on the page color: a heading and a line, while the section loads. */
function Skeleton({ ink, shown }: { ink: string; shown: boolean }) {
  const bar = `color-mix(in oklab, ${ink} 12%, transparent)`
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-[7px] px-[12%] transition-opacity duration-200"
      style={{ opacity: shown ? 1 : 0, transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
    >
      <div className="h-[9px] w-[62%] rounded-full" style={{ background: bar }} />
      <div className="h-[6px] w-[40%] rounded-full" style={{ background: bar }} />
    </div>
  )
}
