import type { ReactNode } from 'react'
import { SwatchBook } from 'lucide-react'
import { useStore } from '@/state/store'

/** Design exploration: the style guide button's count badge. Open with ?lab=badge. */
export default function LabBadge() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const variants: { letter: string; name: string; notes: string; B: () => ReactNode; pad?: string }[] = [
    { letter: 'A', name: 'Tucked corner', notes: 'A smaller 14px badge tucked inside the button’s corner, with a ring in the bar colour so it reads as cut out of the icon.', B: BadgeA },
    { letter: 'B', name: 'Corner, more room', notes: 'Today’s badge, but the bar gets extra padding on the right so the badge never crowds the edge.', B: BadgeB, pad: 'pr-2.5' },
    { letter: 'C', name: 'Dot', notes: 'Just a honey dot on the corner; the number lives in the tooltip and inside the panel. The quietest.', B: BadgeC },
    { letter: 'D', name: 'Bottom corner', notes: 'The badge hangs off the bottom-right, like a status badge on an avatar, away from the bar’s top edge.', B: BadgeD },
    { letter: 'E', name: 'Superscript', notes: 'A small bold number set up and to the right of the icon, no circle. Light, typographic.', B: BadgeE },
  ]
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Style guide badge: five placements</h1>
        <p className="mt-1 text-sm text-zinc-500">Each at actual size, then at 3× to judge the details.</p>
        <div className="mt-8 space-y-4">
          {variants.map(({ letter, name, notes, B, pad }) => (
            <section key={letter} className="flex items-center gap-8 rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="w-64 shrink-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
                  <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-500">{notes}</p>
              </div>
              <Bar pad={pad}>
                <B />
              </Bar>
              <div className="origin-left scale-[3]">
                <Bar pad={pad}>
                  <B />
                </Bar>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bar({ children, pad = '' }: { children: ReactNode; pad?: string }) {
  return (
    <div className={`glass-panel flex h-11 w-fit shrink-0 items-center gap-1 rounded-2xl px-1 ${pad}`}>
      <div className="flex h-8 items-center gap-0.5 rounded-lg bg-well p-0.5 text-[13px] font-medium">
        <span className="px-2.5 text-muted-foreground">Original</span>
        <span className="rounded-md bg-lift px-2.5 py-1 shadow-sm">Your style</span>
      </div>
      <div className="mx-0.5 h-5 w-px bg-zinc-950/10" />
      {children}
    </div>
  )
}

const btn = 'relative grid size-8 place-items-center rounded-full text-zinc-600'

function BadgeA() {
  return (
    <span className={btn}>
      <SwatchBook size={16} />
      <span className="absolute right-0.5 top-0.5 grid size-3.5 place-items-center rounded-full bg-attention text-[8.5px] font-bold text-white ring-[1.5px] ring-[var(--lift)]">3</span>
    </span>
  )
}

function BadgeB() {
  return (
    <span className={btn}>
      <SwatchBook size={16} />
      <span className="absolute -right-1 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-attention px-1 text-[10px] font-bold text-white ring-2 ring-[var(--lift)]">3</span>
    </span>
  )
}

function BadgeC() {
  return (
    <span className={btn}>
      <SwatchBook size={16} />
      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-attention ring-2 ring-[var(--lift)]" />
    </span>
  )
}

function BadgeD() {
  return (
    <span className={btn}>
      <SwatchBook size={16} />
      <span className="absolute -bottom-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-attention px-1 text-[10px] font-bold text-white ring-2 ring-[var(--lift)]">3</span>
    </span>
  )
}

function BadgeE() {
  return (
    <span className="relative flex h-8 items-center rounded-full pl-2 pr-2.5 text-zinc-600">
      <SwatchBook size={16} />
      <span className="-mt-3 ml-0.5 text-[10.5px] font-bold tabular-nums text-attention-ink">3</span>
    </span>
  )
}
