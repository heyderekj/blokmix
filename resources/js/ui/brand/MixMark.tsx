import type { SectionType } from '@/core/types'

/** Roughly how tall each kind of section is, so the mark reads as the page's silhouette. */
const WEIGHT: Record<SectionType, number> = {
  nav: 1,
  hero: 4,
  header: 2.5,
  logos: 1.25,
  features: 3,
  stats: 1.75,
  content: 3,
  team: 3,
  testimonials: 2.5,
  pricing: 3.5,
  blog: 3,
  faq: 2.5,
  contact: 2.5,
  cta: 2,
  footer: 1.75,
}

/**
 * The working mix's mark: the open page as a stack of blocks (its tracklist), each as
 * tall as its kind of section tends to be, on a blush card. The section you're on is
 * the pink block. Saved, it sits in its row; edited since, it lifts out of its slot,
 * tilted with a shadow: the brand's one motion, on your own page.
 */
export function MixMark({ types, active, edited, size = 32 }: { types: SectionType[]; active: number; edited: boolean; size?: number }) {
  // Long pages keep their first sections; the rest are implied.
  const shown = types.length ? types.slice(0, 8) : (['hero'] as SectionType[])
  const at = Math.max(0, Math.min(active, shown.length - 1))
  const top = 5
  const height = 22
  const gap = 1.25
  const total = shown.reduce((sum, t) => sum + WEIGHT[t], 0)
  const unit = (height - gap * (shown.length - 1)) / total
  const x = 6
  const w = 20
  let y = top
  const rows = shown.map((t) => {
    const h = WEIGHT[t] * unit
    const r = { y, h }
    y += h + gap
    return r
  })
  const a = rows[at]
  const rx = (h: number) => Math.min(1.75, h / 2)
  const lift = edited ? 'translate(1.25px, -2px) rotate(-9deg)' : 'none'
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--key-soft)" />
      {rows.map((r, i) => (
        // The active row is the slot the block came from: carved a little deeper.
        <rect key={i} x={x} y={r.y} width={w} height={r.h} rx={rx(r.h)} fill={`color-mix(in oklab, var(--key-ink) ${i === at ? 22 : 12}%, transparent)`} />
      ))}
      <g className="bm-mix-block" style={{ transform: lift, transformOrigin: `${x + w / 2}px ${a.y + a.h / 2}px` }}>
        <rect className="bm-lift" x={x + 1} y={a.y + 1.25} width={w} height={a.h} rx={rx(a.h)} fill="color-mix(in oklab, var(--key-ink) 20%, transparent)" style={{ opacity: edited ? 1 : 0 }} />
        <rect x={x} y={a.y} width={w} height={a.h} rx={rx(a.h)} fill="#FF69B4" />
      </g>
    </svg>
  )
}
