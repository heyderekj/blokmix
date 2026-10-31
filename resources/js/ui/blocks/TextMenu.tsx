import { Minus, Plus } from 'lucide-react'
import type { BlockStyle } from '@/core/types'
import { expandTokens } from '@/core/tokens'
import { nudgeStep, resolveTextStyles, TEXT_STYLE_LABEL, TEXT_STYLES, TYPE_STEPS, type TextStyleDef, type TextStyleId, type TypeStep } from '@/core/textStyles'
import { useResolvedGuide } from '@/state/derived'
import { useStore } from '@/state/store'

/**
 * A text block's type, Figma's way: a text style from the guide (each previewed in your fonts), automatic (the style it
 * reads as, once you edit that style), or the clip's own; and its own size, a step up or down the type scale.
 */
export function TextMenu({
  style,
  auto,
  onHover,
  onPick,
}: {
  /** The block's own picks: its text style and size. */
  style: BlockStyle | undefined
  /** The style the block reads as. */
  auto: TextStyleId | undefined
  onHover: (s: Partial<BlockStyle> | null) => void
  onPick: (s: Partial<BlockStyle>) => void
}) {
  const tokens = useResolvedGuide().tokens
  const edits = useStore((s) => s.guide.textStyles)
  const styles = resolveTextStyles(edits)
  const px = expandTokens(tokens)
  const sizePx = (step: TypeStep) => parseFloat(px[`--mx-text-${step}`] ?? '16')
  const picked = style?.text
  const current = picked && picked !== 'none' ? picked : auto
  const size = style?.size
  const baseSize = current ? styles[current].size : 'base'

  const row = ({ id, def, note, on, value }: { id: string; def?: TextStyleDef; note: string; on: boolean; value: BlockStyle['text'] }) => (
    <button
      key={id}
      type="button"
      onMouseEnter={() => onHover({ text: value })}
      onMouseLeave={() => onHover(null)}
      onClick={() => onPick({ text: value })}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors ${on ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`}
    >
      <span
        className="min-w-0 flex-1 truncate text-zinc-900"
        style={
          def
            ? {
                fontFamily: tokens[`font.${def.font}` as 'font.display'],
                fontWeight: def.weight === 'display' ? Number(tokens['type.displayWeight']) || 700 : def.weight,
                fontSize: Math.min(26, Math.max(11, sizePx(def.size) * 0.55)),
                letterSpacing: `${def.tracking}em`,
                textTransform: def.upper ? 'uppercase' : undefined,
                lineHeight: 1.2,
              }
            : { fontSize: 13, fontWeight: 500 }
        }
      >
        {id}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{note}</span>
    </button>
  )

  return (
    <div className="glass-menu animate-pop rounded-2xl p-1.5" style={{ width: 300 }}>
      {row({ id: 'Automatic', note: auto ? `as ${TEXT_STYLE_LABEL[auto]}` : 'clip’s own', on: !picked, value: undefined })}
      <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
      <div className="max-h-[300px] overflow-y-auto">
        {TEXT_STYLES.map((id) =>
          row({ id: TEXT_STYLE_LABEL[id], def: styles[id], note: `${Math.round(sizePx(styles[id].size))}px`, on: picked === id, value: id }),
        )}
      </div>
      <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
      {row({ id: 'Keep the clip’s type', note: '', on: picked === 'none', value: 'none' })}
      <div className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5">
        <span className="flex-1 text-[12px] font-semibold text-zinc-500">Size</span>
        <button
          type="button"
          aria-label="Smaller"
          disabled={size === TYPE_STEPS[0]}
          onClick={() => onPick({ size: nudgeStep(size ?? baseSize, -1) })}
          className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-600 hover:bg-zinc-950/5 disabled:opacity-30"
        >
          <Minus size={13} />
        </button>
        <span className="w-14 text-center text-[12px] font-medium tabular-nums text-zinc-800">{size ? `${Math.round(sizePx(size))}px` : 'Style'}</span>
        <button
          type="button"
          aria-label="Bigger"
          disabled={size === TYPE_STEPS[TYPE_STEPS.length - 1]}
          onClick={() => onPick({ size: nudgeStep(size ?? baseSize, 1) })}
          className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-600 hover:bg-zinc-950/5 disabled:opacity-30"
        >
          <Plus size={13} />
        </button>
        {size && (
          <button type="button" onClick={() => onPick({ size: undefined })} className="cursor-pointer text-[11.5px] font-medium text-zinc-500 hover:text-zinc-900">
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
