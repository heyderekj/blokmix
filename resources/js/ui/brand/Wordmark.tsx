import { LETTERS, WORDMARK_BLOCK as B, WORDMARK_TRANSFORM, WORDMARK_VIEWBOX } from './shapes'

function WordmarkShapes() {
  return (
    <g transform={WORDMARK_TRANSFORM}>
      <path d={LETTERS} fill="currentColor" />
      <rect x={B.x} y={B.y} width={B.size} height={B.size} rx={B.rx} fill="#FF69B4" />
    </g>
  )
}

/**
 * The Blokmix wordmark (outlined Archivo, never a live font). Our rule: wherever it fits,
 * show the wordmark alone; where it doesn't, the app icon (BrandIcon) instead. Not both. The letters take the
 * text color, so they're ink on light chrome and paper on dark; the block stays hot
 * pink. Keep it at least 80 px wide (height 13 px or more).
 */
export function Wordmark({ height = 18, className = '' }: { height?: number; className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} height={height} width={(height * 4595) / 737} className={`shrink-0 ${className}`} role="img" aria-label="Blokmix">
      <WordmarkShapes />
    </svg>
  )
}
