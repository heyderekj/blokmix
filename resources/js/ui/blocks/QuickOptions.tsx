import type { ReactNode } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ALargeSmall, BetweenHorizontalStart, Columns3, Scan, Minus, Plus, Rows3, Square, SquareDashed } from 'lucide-react'
import type { BlockAlign, BlockEdit, BlockInfo, BlockStyle, Slot } from '@/core/types'
import type { Quick } from '@/core/blocks/quick'
import { columnsOf } from '@/core/blocks/quick'
import { nudgeStep, TYPE_STEPS, type TypeStep } from '@/core/textStyles'
import { expandTokens } from '@/core/tokens'
import { slotClip } from '@/data/library'
import { useResolvedGuide } from '@/state/derived'
import { BAR_BUTTON } from '../frames/bar'
import { SPACE_STEPS, Steps } from './Spacing'
import { Segmented, Swatch, usePaint, usePaletteRefs } from './swatches'
import { useBlockPreview } from './preview'

/** The quick options that open a small menu under the bar; the rest work right on it. */
export const QUICK_MENUS = ['color', 'fill', 'shape', 'padding', 'gap', 'size', 'align'] as const
export type QuickMenu = (typeof QUICK_MENUS)[number]
export const isQuickMenu = (q: string | null): q is QuickMenu => !!q && (QUICK_MENUS as readonly string[]).includes(q)
/** These open right in the bar, in place of their button; the others open a small menu under it. */
export const OPENS_INLINE: ReadonlySet<QuickMenu> = new Set(['color', 'fill', 'size', 'align'])

interface Props {
  q: Quick
  slot: Slot
  block: BlockInfo
  /** What it shows now: its own picks over the page-wide look for its kind. */
  shown: BlockStyle
  apply: (patch: Partial<BlockEdit>) => void
  hover: (patch: Partial<BlockEdit> | null) => void
  open: boolean
  onOpen: () => void
}

const SMALL = 'grid h-8 w-7 shrink-0 cursor-pointer place-items-center text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:cursor-default disabled:opacity-30'

/** A quick option on the bar: the color, size, alignment, columns or direction right there, or a button for its menu. */
export function QuickInline(p: Props) {
  const paint = usePaint()
  const { q, shown, apply, hover } = p
  const refs = usePaletteRefs()
  if (p.open && (q === 'color' || q === 'fill')) {
    const prop = p.block.kind === 'icon' ? 'ink' : 'fill'
    return (
      <Opened>
        <div className="flex items-center gap-1" onMouseLeave={() => hover(null)}>
          {refs.map((r) => (
            <Swatch key={r.ref} small color={paint(r.ref)} label={r.label} on={shown[prop] === r.ref} onHover={() => hover({ style: { ...shown, [prop]: r.ref } })} onPick={() => (apply({ style: { [prop]: r.ref } }), p.onOpen())} />
          ))}
        </div>
      </Opened>
    )
  }
  if (p.open && q === 'size')
    return (
      <Opened>
        <SizeSteps size={shown.size} apply={apply} />
      </Opened>
    )
  if (p.open && q === 'align')
    return (
      <Opened>
        <AlignRow shown={shown} apply={(x) => (apply(x), p.onOpen())} hover={hover} />
      </Opened>
    )
  switch (q) {
    case 'color':
    case 'fill': {
      const prop = p.block.kind === 'icon' ? 'ink' : 'fill'
      const now = shown[prop]
      return (
        <Trigger open={p.open} onClick={p.onOpen} title={q === 'color' ? 'Color' : 'Fill'} square>
          <span className="size-4 rounded-full ring-1 ring-zinc-950/15" style={{ background: paint(now) ?? 'transparent', backgroundImage: now ? undefined : 'linear-gradient(135deg, transparent 45%, rgb(0 0 0 / 0.3) 46%, rgb(0 0 0 / 0.3) 54%, transparent 55%)' }} />
        </Trigger>
      )
    }
    case 'shape':
      return (
        <Trigger open={p.open} onClick={p.onOpen} title="Corners and shadow" square>
          {shown.radius === 'none' ? <SquareDashed size={15} className="text-zinc-500" /> : <Square size={15} className="text-zinc-500" />}
        </Trigger>
      )
    case 'padding':
    case 'gap': {
      const Icon = q === 'gap' ? BetweenHorizontalStart : Scan
      return (
        <Trigger open={p.open} onClick={p.onOpen} title={q === 'gap' ? 'Gap: space between what’s in it' : 'Padding: space inside it'}>
          <Icon size={15} className="text-zinc-500" />
          <span className={shown[q] === undefined ? 'text-zinc-500' : ''}>{shown[q] === undefined ? 'Auto' : label(shown[q]!)}</span>
        </Trigger>
      )
    }
    case 'size':
      return (
        <Trigger open={p.open} onClick={p.onOpen} title="Size">
          <ALargeSmall size={15} className="text-zinc-500" />
          <SizeNow size={shown.size} />
        </Trigger>
      )
    case 'align': {
      const Icon = shown.align === 'center' ? AlignCenter : shown.align === 'end' ? AlignRight : AlignLeft
      return (
        <Trigger open={p.open} onClick={p.onOpen} title="Align" square>
          <Icon size={15} className="text-zinc-500" />
        </Trigger>
      )
    }
    case 'columns':
      return <ColumnSteps slot={p.slot} block={p.block} columns={shown.columns} apply={apply} />
    case 'direction': {
      const stacked = shown.direction === 'column'
      return (
        <button
          type="button"
          title={stacked ? 'Stacked: put them side by side' : 'Side by side: stack them'}
          onMouseEnter={() => hover({ style: { ...shown, direction: stacked ? 'row' : 'column' } })}
          onMouseLeave={() => hover(null)}
          onClick={() => apply({ style: { direction: stacked ? 'row' : 'column' } })}
          aria-label={stacked ? 'Stacked' : 'Side by side'}
          className={`${BAR_BUTTON} w-8 text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900`}
        >
          {stacked ? <Rows3 size={15} className="text-zinc-500" /> : <Columns3 size={15} className="text-zinc-500" />}
        </button>
      )
    }
    default:
      return null
  }
}

/** The small menu a quick option opens under the bar. */
export function QuickMenuBody({ q, block, shown, apply, hover }: Omit<Props, 'open' | 'onOpen' | 'slot' | 'q'> & { q: QuickMenu }) {
  const paint = usePaint()
  const refs = usePaletteRefs()
  if (q === 'color' || q === 'fill') {
    const prop = block.kind === 'icon' ? 'ink' : 'fill'
    return (
      <Menu>
        <div className="flex flex-wrap gap-1.5 p-1.5" onMouseLeave={() => hover(null)}>
          {refs.map((r) => (
            <Swatch key={r.ref} color={paint(r.ref)} label={r.label} on={shown[prop] === r.ref} onHover={() => hover({ style: { ...shown, [prop]: r.ref } })} onPick={() => apply({ style: { [prop]: r.ref } })} />
          ))}
        </div>
        {shown[prop] && (
          <button type="button" onClick={() => apply({ style: { [prop]: undefined } })} className="mx-1.5 mb-1 cursor-pointer text-[12px] font-medium text-zinc-500 hover:text-zinc-900">
            As the layout has it
          </button>
        )}
      </Menu>
    )
  }
  if (q === 'size')
    return (
      <Menu fit>
        <SizeSteps size={shown.size} apply={apply} />
      </Menu>
    )
  if (q === 'align')
    return (
      <Menu fit>
        <AlignRow shown={shown} apply={apply} hover={hover} />
      </Menu>
    )
  if (q === 'shape')
    return (
      <Menu>
        <div className="grid gap-2 p-1.5">
          <Segmented
            options={(['none', 'sm', 'md', 'lg', 'pill'] as const).map((v) => ({ v, label: { none: 'Square', sm: 'S', md: 'M', lg: 'L', pill: 'Round' }[v] }))}
            value={shown.radius}
            onHover={(v) => hover(v ? { style: { ...shown, radius: v } } : null)}
            onPick={(v) => apply({ style: { radius: v } })}
          />
          <Segmented
            options={(['none', 'soft', 'lifted', 'offset'] as const).map((v) => ({ v, label: { none: 'Flat', soft: 'Soft', lifted: 'Lifted', offset: 'Offset' }[v] }))}
            value={shown.shadow}
            onHover={(v) => hover(v ? { style: { ...shown, shadow: v } } : null)}
            onPick={(v) => apply({ style: { shadow: v } })}
          />
        </div>
      </Menu>
    )
  return (
    <Menu>
      <div className="p-1.5">
        <Steps options={SPACE_STEPS} value={shown[q]} onHover={(v) => hover(v === null ? null : { style: { ...shown, [q]: v } })} onPick={(v) => apply({ style: { [q]: v } })} />
      </div>
    </Menu>
  )
}

function Menu({ children, fit }: { children: ReactNode; fit?: boolean }) {
  return (
    <div className="glass-menu animate-pop rounded-2xl p-1" style={{ width: fit ? 'max-content' : 280 }}>
      {children}
    </div>
  )
}

function Trigger({ open, onClick, title, children, square }: { open: boolean; onClick: () => void; title: string; children: ReactNode; square?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={square ? title : undefined}
      aria-expanded={open}
      onClick={onClick}
      className={`${BAR_BUTTON} gap-1 ${square ? 'w-8 justify-center' : 'px-2'} ${open ? 'bg-zinc-950/[0.07] text-zinc-900' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
    >
      {children}
    </button>
  )
}

const label = (n: number) => SPACE_STEPS.find((s) => s.v === n)?.label ?? String(n)

/** Smaller and bigger, a step on the type scale at a time, from the size it shows now. */
function SizeSteps({ size, apply }: { size?: TypeStep; apply: Props['apply'] }) {
  const px = expandTokens(useResolvedGuide().tokens)
  const shownPx = useBlockPreview((s) => s.selRect?.font)
  const sizePx = (step: TypeStep) => parseFloat(px[`--mx-text-${step}`] ?? '16')
  const nearest = (target: number) => TYPE_STEPS.reduce((best, s) => (Math.abs(sizePx(s) - target) < Math.abs(sizePx(best) - target) ? s : best), TYPE_STEPS[0])
  const base: TypeStep = size ?? (shownPx ? nearest(shownPx) : 'base')
  return (
    <div className="flex items-center" role="group" aria-label="Size">
      <button type="button" title="Smaller" aria-label="Smaller" disabled={base === TYPE_STEPS[0]} onClick={() => apply({ style: { size: nudgeStep(base, -1) } })} className={`${SMALL} rounded-l-full`}>
        <Minus size={14} />
      </button>
      <button
        type="button"
        title={size ? 'Back to its own size' : 'Its size'}
        onClick={() => size && apply({ style: { size: undefined } })}
        className={`h-8 min-w-9 px-0.5 text-center text-[12px] font-medium tabular-nums ${size ? 'cursor-pointer text-zinc-900' : 'cursor-default text-zinc-500'}`}
      >
        {Math.round(size ? sizePx(size) : (shownPx ?? sizePx(base)))}
      </button>
      <button type="button" title="Bigger" aria-label="Bigger" disabled={base === TYPE_STEPS[TYPE_STEPS.length - 1]} onClick={() => apply({ style: { size: nudgeStep(base, 1) } })} className={`${SMALL} rounded-r-full`}>
        <Plus size={14} />
      </button>
    </div>
  )
}

/** How many across, one at a time, from what the layout shows. */
function ColumnSteps({ slot, block, columns, apply }: { slot: Slot; block: BlockInfo; columns?: number; apply: Props['apply'] }) {
  const own = columnsOf(slotClip(slot).html, block.id)
  const n = columns ?? own ?? 3
  const set = (v: number) => apply({ style: { columns: v === own ? undefined : Math.max(1, Math.min(6, v)) } })
  return (
    <div className="flex items-center" role="group" aria-label="Columns">
      <button type="button" title="Fewer across" aria-label="Fewer columns" disabled={n <= 1} onClick={() => set(n - 1)} className={`${SMALL} rounded-l-full`}>
        <Minus size={14} />
      </button>
      <span className="flex h-8 items-center gap-1 px-1 text-[12.5px] font-medium tabular-nums text-zinc-700">
        <Columns3 size={14} className="text-zinc-400" />
        {n} across
      </span>
      <button type="button" title="More across" aria-label="More columns" disabled={n >= 6} onClick={() => set(n + 1)} className={`${SMALL} rounded-r-full`}>
        <Plus size={14} />
      </button>
    </div>
  )
}

/** Left, center, right: its words and what's in it line up there; the one that's on turns it off again. */
function AlignRow({ shown, apply, hover }: Pick<Props, 'shown' | 'apply' | 'hover'>) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Align" onMouseLeave={() => hover(null)}>
      {(
        [
          ['start', AlignLeft, 'Left'],
          ['center', AlignCenter, 'Center'],
          ['end', AlignRight, 'Right'],
        ] as [BlockAlign, typeof AlignLeft, string][]
      ).map(([v, Icon, title]) => (
        <button
          key={v}
          type="button"
          title={title}
          aria-label={title}
          aria-pressed={shown.align === v}
          onMouseEnter={() => hover({ style: { ...shown, align: v } })}
          onClick={() => apply({ style: { align: shown.align === v ? undefined : v } })}
          className={`grid size-7 cursor-pointer place-items-center rounded-full transition active:scale-[0.97] ${shown.align === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

/** The size it shows now, in px, for the bar's Size button. */
function SizeNow({ size }: { size?: TypeStep }) {
  const px = expandTokens(useResolvedGuide().tokens)
  const shownPx = useBlockPreview((s) => s.selRect?.font)
  const n = size ? parseFloat(px[`--mx-text-${size}`] ?? '16') : shownPx
  return n ? <span className="text-[12.5px] font-medium tabular-nums text-zinc-600">{Math.round(n)}</span> : null
}

/** A quick option opened in the bar: its choices on a soft pill, where its button was. */
function Opened({ children }: { children: ReactNode }) {
  return <div className="flex h-8 items-center rounded-full bg-zinc-950/[0.05] px-1">{children}</div>
}
