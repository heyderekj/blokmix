import type { Clip, Slot, SliderChoice } from '@/core/types'
import { useStore } from '@/state/store'
import { useBlockPreview } from '../blocks/preview'

/** A picture in a drawing, and lines standing in for words. */
const Pic = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => <rect x={x} y={y} width={w} height={h} rx="2.5" fill="currentColor" opacity="0.2" />
const Words = ({ x, y, w, align = 'left' }: { x: number; y: number; w: number; align?: 'left' | 'center' }) => (
  <>
    <rect x={x} y={y} width={w} height="3" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x={align === 'center' ? x + w * 0.15 : x} y={y + 5.5} width={w * 0.7} height="2.5" rx="1.25" fill="currentColor" opacity="0.4" />
  </>
)

/** How each slide is composed, drawn. */
const SLIDE_ART: Record<string, React.ReactNode> = {
  caption: (<><Pic x={10} y={5} w={52} h={25} /><Words x={10} y={34} w={40} /></>),
  picture: <Pic x={10} y={5} w={52} h={38} />,
  over: (
    <>
      <Pic x={10} y={5} w={52} h={38} />
      <rect x={14} y={25} width={44} height={14} rx="2" fill="var(--lift, #fff)" />
      <Words x={17} y={28} w={30} />
    </>
  ),
  beside: (<><Pic x={8} y={8} w={32} h={32} /><Words x={44} y={18} w={20} /><rect x={44} y={29} width={12} height="2.5" rx="1.25" fill="currentColor" opacity="0.4" /></>),
  open: (<><Words x={14} y={12} w={44} align="center" /><Words x={18} y={24} w={36} align="center" /><circle cx="36" cy="39" r="3" fill="currentColor" opacity="0.3" /></>),
  left: (<><Words x={10} y={12} w={46} /><Words x={10} y={24} w={38} /><circle cx="13" cy="39" r="3" fill="currentColor" opacity="0.3" /></>),
  card: (<><rect x={10.5} y={5.5} width={51} height={37} rx="3" fill="none" stroke="currentColor" opacity="0.4" /><Words x={17} y={14} w={38} align="center" /><circle cx="36" cy="33" r="3" fill="currentColor" opacity="0.3" /></>),
}

/** Where the section's own words sit against the slider, drawn. */
const INTRO_ART: Record<string, React.ReactNode> = {
  side: (<><Words x={7} y={14} w={22} /><rect x={7} y={27} width={14} height="5" rx="2.5" fill="currentColor" opacity="0.7" /><Pic x={34} y={8} w={31} h={32} /></>),
  above: (<><Words x={18} y={5} w={36} align="center" /><Pic x={14} y={19} w={44} h={24} /></>),
}

/** How many show at once, drawn: that many slides across, with the next peeking in. */
function ShowArt({ n }: { n: number }) {
  const gap = 2
  const each = (58 - gap * (n - 1)) / n
  return (
    <>
      {Array.from({ length: n }, (_, i) => <Pic key={i} x={7 + i * (each + gap)} y={12} w={each} h={24} />)}
      <rect x={67} y={12} width={5} height={24} rx="1.5" fill="currentColor" opacity="0.1" />
    </>
  )
}

function Tile({ label, art, on, onHover, onPick }: { label: string; art: React.ReactNode; on: boolean; onHover: (entering: boolean) => void; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      className="grid min-w-0 cursor-pointer gap-1 text-center transition-[scale] duration-150 active:scale-[0.97]"
    >
      <span className={`block overflow-hidden rounded-lg bg-lift transition-[box-shadow,color] duration-150 ${on ? 'text-zinc-900 shadow-[0_0_0_1.5px_rgb(24_24_27)]' : 'text-zinc-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-zinc-800 hover:shadow-[0_0_0_1px_rgb(0_0_0/0.22)]'}`}>
        <svg viewBox="0 0 72 48" className="block w-full" aria-hidden>
          {art}
        </svg>
      </span>
      <span className={`truncate text-[11px] leading-tight ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-500'}`}>{label}</span>
    </button>
  )
}

/** A slider's arrangement, picked by sight: point at one to see it on the section, click to keep it. */
export function SliderPicker({ slot, options }: { slot: Slot; options: NonNullable<Clip['slider']> }) {
  const shown = slot.slider ?? {}
  const preview = useBlockPreview((s) => s.showSlider)
  const set = useStore.getState().setSlider
  /** The first of each is how the layout comes, which needs no attribute at all. */
  const value = <K extends keyof SliderChoice>(key: K, v: SliderChoice[K], first: SliderChoice[K]) => ({ [key]: v === first ? undefined : v }) as Partial<SliderChoice>
  const tile = <K extends keyof SliderChoice>(key: K, v: SliderChoice[K], first: SliderChoice[K]) => ({
    on: (shown[key] ?? first) === v,
    onHover: (entering: boolean) => preview(entering ? { slotId: slot.id, value: { ...shown, ...value(key, v, first) } } : null),
    onPick: () => {
      preview(null)
      set(slot.id, value(key, v, first))
    },
  })
  const head = 'mb-1.5 text-[11px] font-semibold text-zinc-400'
  return (
    <div className="mt-3 grid gap-3 border-t border-zinc-950/6 pt-3">
      {options.slide && (
        <div>
          <div className={head}>Each slide</div>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="How each slide is composed">
            {options.slide.map((o) => (
              <Tile key={o.id} label={o.label} art={SLIDE_ART[o.id]} {...tile('slide', o.id, options.slide![0].id)} />
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: options.intro ? `${options.show?.length ?? 3}fr 2fr` : '1fr' }}>
        {options.show && (
          <div>
            <div className={head}>Slides showing</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.intro ? options.show.length : 4}, minmax(0, 1fr))` }} role="radiogroup" aria-label="How many slides show at once">
              {options.show.map((n) => (
                <Tile key={n} label={String(n)} art={<ShowArt n={n} />} {...tile('show', n, options.show![0])} />
              ))}
            </div>
          </div>
        )}
        {options.intro && (
          <div>
            <div className={head}>Your words</div>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Where the section’s words sit">
              {options.intro.map((o) => (
                <Tile key={o.id} label={o.label} art={INTRO_ART[o.id]} {...tile('intro', o.id, options.intro![0].id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
