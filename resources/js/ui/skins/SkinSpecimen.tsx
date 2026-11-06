import type { CSSProperties } from 'react'
import type { GuideState, TokenSet } from '@/core/types'

const px = (v: string | undefined, fallback = 0) => (Number.isFinite(parseFloat(v ?? '')) ? parseFloat(v!) : fallback)
const isDark = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128
}

/** A card in its look, small: the card variants a skin can pick, drawn from its own colors. */
function cardStyle(t: TokenSet, variant: string | undefined, r: number): CSSProperties {
  const stroke = px(t['stroke.width'], 1)
  const hair = `color-mix(in oklab, ${t['color.text']} ${isDark(t['color.bg']) ? 22 : 16}%, transparent)`
  switch (variant) {
    case 'offset':
      return { background: t['color.surface'], borderRadius: r, boxShadow: `3px 3px 0 ${t['color.text']}`, outline: `${stroke}px solid ${t['color.text']}` }
    case 'bordered':
      return { background: t['color.surface'], borderRadius: r, outline: `1px solid ${hair}` }
    case 'rule':
      return { background: 'transparent', borderRadius: 0, borderTop: `1.5px solid ${t['color.text']}` }
    case 'raised':
      return { background: t['color.bg'], borderRadius: r, boxShadow: '0 4px 10px -2px rgb(30 27 58 / 0.18)' }
    case 'glass':
      return { background: `color-mix(in oklab, ${t['color.surface']} 80%, transparent)`, borderRadius: r, outline: '1px solid rgb(255 255 255 / 0.7)', boxShadow: `0 4px 10px -3px color-mix(in oklab, ${t['color.primary']} 30%, transparent)` }
    case 'glow':
      return { background: t['color.surface'], borderRadius: r, outline: `1px solid color-mix(in oklab, ${t['color.primary']} 35%, transparent)`, boxShadow: `0 0 8px color-mix(in oklab, ${t['color.primary']} 40%, transparent)` }
    default:
      return { background: t['color.surface'], borderRadius: r }
  }
}

/**
 * A theme at a glance: your site's name in its display face and weight, its main button and a card in its look, on its
 * background. Drawn from the guide a swap would really leave, so what you keep shows on every card. Decorative; the
 * button around it names the theme.
 */
export function SkinSpecimen({ tokens: t, components, name }: { tokens: TokenSet; components?: GuideState['components']; name: string }) {
  const r = px(t['radius.base'], 8)
  const caps = components?.button?.variant === 'caps'
  return (
    <span
      aria-hidden
      className="grid gap-2 overflow-hidden rounded-[11px] px-2.5 pb-2 pt-2.5 transition-[background-color] duration-200"
      style={{ background: t['color.bg'], boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${t['color.text']} 10%, transparent)` }}
    >
      <span className="truncate text-[16px] leading-[1.05] tracking-[-0.01em]" style={{ fontFamily: t['font.display'], fontWeight: Number(t['type.displayWeight']) || 700, color: t['color.text'] }}>
        {name}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="whitespace-nowrap px-2 py-[3px] text-[9.5px] font-semibold"
          style={{
            background: t['color.primary'],
            color: t['color.onPrimary'],
            fontFamily: t['font.body'],
            borderRadius: r >= 12 ? 999 : r,
            ...(caps ? { textTransform: 'uppercase', letterSpacing: '0.04em', outline: `${px(t['stroke.width'], 1)}px solid ${t['color.text']}` } : {}),
          }}
        >
          Get started
        </span>
        <span className="h-[15px] w-[26px] shrink-0" style={cardStyle(t, components?.card?.variant, Math.min(r, 8))} />
      </span>
    </span>
  )
}
