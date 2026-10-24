import { useMemo } from 'react'
import type { GuideState, SectionType, TokenSet } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { WEIGHT } from '@/ui/brand/MixMark'

const W = 160
/** About the shape of the gallery's page frame, so the drawing fills it without cropping its sides. */
const H = 142
/** Height per unit of a section's weight: a hero is 4 units, so the drawing shows the top of the page, like a screenshot. */
const UNIT = 9

/** The few colors a thumbnail needs, from the mix's style guide (neutral when it has none yet). */
function paletteOf(guide: GuideState | null) {
  const t: Partial<TokenSet> = guide ? resolveGuide(guide).tokens : {}
  return {
    bg: t['color.bg'] ?? '#ffffff',
    surface: t['color.surface'] ?? '#f4f4f5',
    text: t['color.text'] ?? '#18181b',
    muted: t['color.muted'] ?? '#a1a1aa',
    border: t['color.border'] ?? '#e4e4e7',
    primary: t['color.primary'] ?? '#ff69b4',
    onPrimary: t['color.onPrimary'] ?? '#ffffff',
    radius: Math.min(4, (parseFloat(t['radius.base'] ?? '8') || 8) / 3),
  }
}
type Palette = ReturnType<typeof paletteOf>

/**
 * A mix drawn small: its first page top to bottom, each section as tall as its kind tends to be, with a few shapes
 * that say what it is, painted in the mix's own style guide. Decorative; the card names the mix.
 */
export function MixThumb({ sections, guide }: { sections: SectionType[]; guide: GuideState | null }) {
  const p = useMemo(() => paletteOf(guide), [guide])
  let y = 0
  const bands = sections.map((type, i) => {
    const h = (WEIGHT[type] ?? 2) * UNIT
    const band = { type, y, h, key: `${type}-${i}` }
    y += h
    return band
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block size-full" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <rect width={W} height={H} fill={p.bg} />
      {bands.length ? (
        bands.filter((b) => b.y < H).map((b) => <Band key={b.key} type={b.type} y={b.y} h={b.h} p={p} />)
      ) : (
        <text x={W / 2} y={H / 2 + 3} textAnchor="middle" fontSize="8" fill={p.muted} fontFamily="Figtree, system-ui, sans-serif">
          Nothing here yet
        </text>
      )}
    </svg>
  )
}

/** One section's shapes inside its band (x from 0 to W, y from `y` to `y + h`). */
function Band({ type, y, h, p }: { type: SectionType; y: number; h: number; p: Palette }) {
  const r = p.radius
  const bar = (x: number, by: number, w: number, bh = 1.6, fill = p.muted) => <rect x={x} y={by} width={w} height={bh} rx={bh / 2} fill={fill} opacity={fill === p.muted ? 0.55 : 0.9} />
  const mid = y + h / 2
  switch (type) {
    case 'nav':
      return (
        <g>
          <rect x={10} y={mid - 2} width={4} height={4} rx={1} fill={p.text} />
          {bar(17, mid - 0.9, 16, 1.8, p.text)}
          {bar(92, mid - 0.8, 10, 1.6)}
          {bar(106, mid - 0.8, 10, 1.6)}
          <rect x={126} y={mid - 2.2} width={24} height={4.4} rx={2.2} fill={p.primary} />
        </g>
      )
    case 'hero':
    case 'header':
      return (
        <g>
          {bar(40, y + h * 0.26, 80, 3.2, p.text)}
          {bar(54, y + h * 0.26 + 5, 52, 3.2, p.text)}
          {bar(52, y + h * 0.26 + 11.5, 56, 1.4)}
          <rect x={67} y={y + h * 0.26 + 16.5} width={26} height={4.8} rx={Math.max(r, 2.4)} fill={p.primary} />
        </g>
      )
    case 'logos':
      return <g>{[0, 1, 2, 3, 4].map((i) => bar(14 + i * 28, mid - 1.5, 18, 3))}</g>
    case 'features':
    case 'team':
    case 'blog':
      return (
        <g>
          {bar(58, y + 3, 44, 2.4, p.text)}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={10 + i * 48} y={y + 10} width={44} height={h - 12} rx={r} fill={p.surface} stroke={p.border} strokeWidth={0.5} />
              <rect x={14 + i * 48} y={y + 13} width={5} height={5} rx={1.5} fill={p.primary} opacity={0.75} />
              {bar(14 + i * 48, y + h - 8.5, 22, 1.6, p.text)}
              {bar(14 + i * 48, y + h - 5.5, 30, 1.3)}
            </g>
          ))}
        </g>
      )
    case 'stats':
      return <g>{[0, 1, 2].map((i) => <g key={i}>{bar(18 + i * 48, mid - 4, 26, 5, p.text)}{bar(18 + i * 48, mid + 3, 20, 2)}</g>)}</g>
    case 'content':
      return (
        <g>
          {bar(12, y + 6, 54, 4, p.text)}
          {bar(12, y + 13, 62, 2.2)}
          {bar(12, y + 17.5, 56, 2.2)}
          {bar(12, y + 22, 48, 2.2)}
          <rect x={86} y={y + 4} width={62} height={h - 8} rx={r} fill={p.surface} stroke={p.border} strokeWidth={0.5} />
        </g>
      )
    case 'testimonials':
      return (
        <g>
          <text x={W / 2} y={y + 9} textAnchor="middle" fontSize="9" fill={p.primary} fontFamily="Georgia, serif">“</text>
          {bar(34, y + 12, 92, 2.6, p.text)}
          {bar(46, y + 17, 68, 2.6, p.text)}
          <circle cx={70} cy={y + 18 + 0.5 + 5} r={2.5} fill={p.primary} opacity={0.75} />
          {bar(75, y + 22.5, 18, 2)}
        </g>
      )
    case 'pricing':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={12 + i * 47} y={y + 4} width={42} height={h - 8} rx={r} fill={i === 1 ? p.primary : p.surface} stroke={p.border} strokeWidth={i === 1 ? 0 : 0.5} />
              {bar(17 + i * 47, y + 9, 14, 2.2, i === 1 ? p.onPrimary : p.muted)}
              {bar(17 + i * 47, y + 14, 22, 4, i === 1 ? p.onPrimary : p.text)}
            </g>
          ))}
        </g>
      )
    case 'faq':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={30} y={y + 3 + i * 7} width={100} height={5.5} rx={Math.min(r, 2)} fill={p.surface} stroke={p.border} strokeWidth={0.5} />
              {bar(34, y + 4.8 + i * 7, 50, 2, p.text)}
            </g>
          ))}
        </g>
      )
    case 'contact':
      return (
        <g>
          {bar(12, y + 6, 46, 4, p.text)}
          {bar(12, y + 13, 56, 2.2)}
          <rect x={86} y={y + 4} width={62} height={5} rx={Math.min(r, 2)} fill={p.surface} stroke={p.border} strokeWidth={0.5} />
          <rect x={86} y={y + 11} width={62} height={5} rx={Math.min(r, 2)} fill={p.surface} stroke={p.border} strokeWidth={0.5} />
          <rect x={86} y={y + 18} width={24} height={5} rx={Math.max(r, 2.5)} fill={p.primary} />
        </g>
      )
    case 'cta':
      return (
        <g>
          <rect x={8} y={y + 2} width={W - 16} height={h - 4} rx={r + 1} fill={p.primary} />
          {bar(46, mid - 3, 68, 3.5, p.onPrimary)}
          <rect x={68} y={mid + 2} width={24} height={4.5} rx={2.25} fill={p.onPrimary} />
        </g>
      )
    case 'footer':
      return (
        <g>
          <rect x={0} y={y} width={W} height={h} fill={p.surface} />
          {bar(12, y + 5, 20, 2.6, p.text)}
          {[0, 1, 2].map((i) => bar(90 + i * 22, y + 5, 14, 2))}
        </g>
      )
    default:
      return <g>{bar(30, mid - 1.5, 100, 3)}</g>
  }
}
