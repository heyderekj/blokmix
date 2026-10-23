/**
 * Mixtape's app tile: the family's squircle tile with one bold flat mark
 * (Koati weaves a K, ReviseMy frames a bubble) — here, a cassette in the key pink.
 */
export function LogoTile({ size = 28, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg border border-[color-mix(in_srgb,var(--key),black_22%)] bg-key text-key-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.12)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M7 19l1.6-3.2h6.8L17 19" />
        <g className={spinning ? 'origin-[8.5px_10.5px] animate-[spin_2.4s_linear_infinite]' : ''}>
          <circle cx="8.5" cy="10.5" r="2.2" />
          <path d="M8.5 9.1v2.8" />
        </g>
        <g className={spinning ? 'origin-[15.5px_10.5px] animate-[spin_2.4s_linear_infinite]' : ''}>
          <circle cx="15.5" cy="10.5" r="2.2" />
          <path d="M15.5 9.1v2.8" />
        </g>
      </svg>
    </span>
  )
}
