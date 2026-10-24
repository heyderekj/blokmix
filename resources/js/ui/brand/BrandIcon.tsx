import { TILE } from './shapes'

/**
 * The Blokmix app icon, flat: the version for 24–63 px (blokmix-icon-simple), in the
 * chrome's light or dark colors. The pink block is lifted out of its slot, as in the
 * render; `dropped` sets it down in the slot. Only the block moves.
 */
export function BrandIcon({ size = 28, dropped = false, title }: { size?: number; dropped?: boolean; title?: string }) {
  // Into the slot: undo the -9° tilt and shrink the 392 px block onto the 352 px slot.
  const pose = dropped ? 'translate(-216px, 190px) rotate(9deg) scale(0.898)' : 'none'
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} className="shrink-0" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={TILE} fill="var(--bm-tile)" />
      <rect x="208" y="472" width="352" height="352" rx="66" fill="var(--bm-slot)" />
      <rect x="228" y="494" width="332" height="330" rx="52" fill="var(--bm-slot-floor)" />
      <g className="bm-block" style={{ transform: pose }}>
        <g transform="rotate(-9 600 458)">
          <rect className="bm-lift" x="444" y="332" width="392" height="392" rx="74" fill="var(--bm-shadow)" style={{ opacity: dropped ? 0 : 1 }} />
        </g>
        <g transform="rotate(-9 600 458)">
          <rect className="bm-lift" x="404" y="296" width="392" height="392" rx="74" fill="#C2185B" style={{ opacity: dropped ? 0 : 1 }} />
          <rect x="404" y="262" width="392" height="392" rx="74" fill="#FF5CB0" />
          <rect x="436" y="284" width="328" height="96" rx="48" fill="#FF8CC6" />
        </g>
      </g>
    </svg>
  )
}
