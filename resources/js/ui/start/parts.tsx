// Pieces the guided start draws with: its button styles and the score ring.
export const PINK = '#FF69B4'
export const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:'
export const PRESS = 'cursor-pointer transition-[background-color,box-shadow,scale,color] duration-150 active:scale-[0.97]'
// The app's lit pink button, the step's one main action.
export const PRIMARY = `btn-lit flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold disabled:pointer-events-none disabled:opacity-45 ${PRESS}`
export const QUIET = `flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-[#6B5F68] ${HOVER}bg-zinc-950/5 ${PRESS}`

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
