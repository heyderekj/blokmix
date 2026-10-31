import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { TokenKey } from '@/core/types'
import { expandTokens } from '@/core/tokens'
import { editedTextStyles, leadingFor, resolveTextStyles, TEXT_STYLE_LABEL, TEXT_STYLES, TYPE_STEPS, type TextStyleDef, type TextStyleId, type TypeStep } from '@/core/textStyles'
import { useStore } from '@/state/store'

type Tokens = Record<TokenKey, string>

const sizePx = (tokens: Tokens) => {
  const px = expandTokens(tokens)
  return (step: TypeStep) => parseFloat(px[`--mx-text-${step}`] ?? '16')
}

/** How a style looks, in your fonts: the preview the list and the tile use. */
function specimen(t: Tokens, d: TextStyleDef, scale: number, max: number) {
  return {
    fontFamily: t[`font.${d.font}` as TokenKey],
    fontWeight: d.weight === 'display' ? Number(t['type.displayWeight']) || 700 : d.weight,
    fontSize: Math.min(max, Math.max(11, sizePx(t)(d.size) * scale)),
    letterSpacing: `${d.tracking}em`,
    textTransform: d.upper ? ('uppercase' as const) : undefined,
    lineHeight: 1.15,
  }
}

/** The closed tile: three styles, largest first, in your fonts. */
export function TextStylesArt({ tokens }: { tokens: Tokens }) {
  const styles = resolveTextStyles(useStore((s) => s.guide.textStyles))
  return (
    <span className="grid gap-1 text-zinc-900">
      <span className="truncate" style={specimen(tokens, styles.display, 0.42, 28)}>
        Display
      </span>
      <span className="truncate" style={specimen(tokens, styles.h2, 0.45, 20)}>
        Heading 2
      </span>
      <span className="truncate text-zinc-600" style={specimen(tokens, styles.body, 0.8, 13)}>
        Body text for reading
      </span>
    </span>
  )
}

/**
 * The text styles: each written in itself, with its size; open one to set its font, size (and on phones), weight, line
 * height, letter spacing and case. Editing a style restyles every block that uses it, and the blocks that read as it.
 */
export function TextStylesPanel({ tokens }: { tokens: Tokens }) {
  const edits = useStore((s) => s.guide.textStyles)
  const styles = resolveTextStyles(edits)
  const edited = editedTextStyles(edits)
  const px = sizePx(tokens)
  const [open, setOpen] = useState<TextStyleId | null>(null)
  return (
    <div className="grid gap-0.5">
      <p className="px-1 pb-2 text-[11.5px] leading-snug text-zinc-500">
        Edit a style and every block that reads as it follows: headlines are Display, section headings Heading 2, item titles Heading 4, eyebrows Label.
      </p>
      {TEXT_STYLES.map((id) => (
        <div key={id} className={`rounded-xl ${open === id ? 'bg-zinc-950/[0.04]' : ''}`}>
          <button
            type="button"
            onClick={() => setOpen(open === id ? null : id)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-zinc-950/[0.04]"
          >
            <span className="min-w-0 flex-1 truncate text-zinc-900" style={specimen(tokens, styles[id], 0.5, 26)}>
              {TEXT_STYLE_LABEL[id]}
            </span>
            {edited.has(id) && <span className="size-1.5 shrink-0 rounded-full bg-key" title="Edited" />}
            <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
              {Math.round(px(styles[id].size))}
              {styles[id].phone && styles[id].phone !== styles[id].size ? ` / ${Math.round(px(styles[id].phone!))}` : ''}px
            </span>
          </button>
          {open === id && <StyleEditor id={id} def={styles[id]} edited={edited.has(id)} px={px} />}
        </div>
      ))}
    </div>
  )
}

const sel = 'h-8 w-full cursor-pointer rounded-lg bg-white px-2 text-[12.5px] text-zinc-800 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] outline-none'

function StyleEditor({ id, def, edited, px }: { id: TextStyleId; def: TextStyleDef; edited: boolean; px: (s: TypeStep) => number }) {
  const set = (patch: Partial<TextStyleDef>) => useStore.getState().setTextStyle(id, patch)
  const field = (label: string, el: React.ReactNode) => (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold text-zinc-500">{label}</span>
      {el}
    </label>
  )
  const steps = (value: TypeStep, on: (s: TypeStep) => void) => (
    <select value={value} onChange={(e) => on(e.target.value as TypeStep)} className={sel}>
      {TYPE_STEPS.map((s) => (
        <option key={s} value={s}>
          {Math.round(px(s))}px · {s}
        </option>
      ))}
    </select>
  )
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-2.5 pb-3 pt-1">
      {field(
        'Font',
        <select value={def.font} onChange={(e) => set({ font: e.target.value as TextStyleDef['font'] })} className={sel}>
          <option value="display">Display font</option>
          <option value="body">Body font</option>
          <option value="mono">Mono</option>
        </select>,
      )}
      {field(
        'Weight',
        <select value={String(def.weight)} onChange={(e) => set({ weight: e.target.value === 'display' ? 'display' : Number(e.target.value) })} className={sel}>
          <option value="display">Display weight</option>
          {[300, 400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>,
      )}
      {field(
        'Size',
        // The line height follows the size until you set it yourself.
        steps(def.size, (s) => set({ size: s, ...(useStore.getState().guide.textStyles?.[id]?.leading === undefined ? { leading: leadingFor(s) } : {}) })),
      )}
      {field('On phones', steps(def.phone ?? def.size, (s) => set({ phone: s })))}
      {field(
        `Line height · ${def.leading.toFixed(2)}`,
        <input type="range" min={0.9} max={2} step={0.05} value={def.leading} onChange={(e) => set({ leading: Number(e.target.value) })} />,
      )}
      {field(
        `Letter spacing · ${def.tracking.toFixed(2)}em`,
        <input type="range" min={-0.06} max={0.2} step={0.01} value={def.tracking} onChange={(e) => set({ tracking: Number(e.target.value) })} />,
      )}
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-zinc-700">
        <input type="checkbox" checked={!!def.upper} onChange={(e) => set({ upper: e.target.checked })} />
        Capitals
      </label>
      {edited && (
        <button
          type="button"
          onClick={() => useStore.getState().setTextStyle(id, null)}
          className="col-span-2 flex cursor-pointer items-center gap-1.5 justify-self-start text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
        >
          <RotateCcw size={12} /> Back to the default (blocks return to their own type)
        </button>
      )}
    </div>
  )
}
