import { memo, useMemo, useState } from 'react'
import {
  AlignLeft,
  Building2,
  ChartColumn,
  CircleHelp,
  CreditCard,
  Heading,
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
  team: Users,
  testimonials: Quote,
  pricing: CreditCard,
  blog: Newspaper,
  faq: CircleHelp,
  contact: Mail,
  cta: MousePointerClick,
  footer: PanelBottom,
}

/**
 * A live, shrunken section that fits its box instead of being cropped: short
 * sections (a nav, a logo row) sit centred on the page colour, tall ones scale
 * down until they fit, cropping only the very tallest from the top.
 */
export const Preview = memo(function Preview({
  clip,
  slot,
  width,
  height,
  className = '',
}: {
  clip: Clip
  slot?: Pick<Slot, 'keep' | 'words' | 'edits'> | null
  width: number
  height: number
  className?: string
}) {
  const mode = useStore((s) => s.ui.mode)
  const content = useStore((s) => s.content)
  const guide = useResolvedGuide()
  const page = usePageStyle()
  const state = useMemo(
    () => frameStateFor(clip, slot ?? { keep: DEFAULT_KEEP }, mode, guide.tokens, content, 'desktop', page),
    [clip, slot, mode, guide.tokens, content, page],
  )
  const [h, setH] = useState(0)
  const fitW = width / PAGE_W
  // Never shrink below ~half the width-fit scale, or the section turns into a speck.
  const scale = h ? Math.max(Math.min(fitW, height / h), fitW * 0.5) : fitW
  const w = PAGE_W * scale
  const top = h ? Math.max(0, (height - h * scale) / 2) : 0
  const bg = mode === 'unified' && !slot?.keep.style ? guide.tokens['color.bg'] : clip.tokens['color.bg']
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height, background: bg }}>
      <div
        className="pointer-events-none absolute origin-top-left transition-opacity duration-300"
        style={{ left: (width - w) / 2, top, width: PAGE_W, transform: `scale(${scale})`, opacity: h ? 1 : 0 }}
      >
        <ClipFrame clip={clip} width={PAGE_W} state={state} onHeight={setH} />
      </div>
    </div>
  )
})
