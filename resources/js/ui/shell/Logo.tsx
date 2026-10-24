/**
 * Blokmix's app tile: the family's squircle tile with one bold flat mark
 * (Koati weaves a K, ReviseMy frames a bubble). Here, a sliding-tile puzzle:
 * three blocks and an empty slot, the way sections slide into place. While an
 * agent works, the loose block slides into the gap and back.
 */
export function LogoTile({ size = 28, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg border border-[color-mix(in_srgb,var(--key),black_22%)] bg-key text-key-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.12)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill="currentColor">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3.75" y="14.25" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.55" />
        <rect
          x="13.5"
          y="13.5"
          width="7.5"
          height="7.5"
          rx="2"
          className={spinning ? 'motion-safe:animate-[blok-slide_2.4s_cubic-bezier(0.23,1,0.32,1)_infinite]' : ''}
        />
      </svg>
    </span>
  )
}
