import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, EyeOff, Lightbulb, MoreHorizontal, Palette, Plus, RotateCcw, Shapes, Sparkles, Type, Users, MessageSquarePlus, Waves, Image as ImageIcon } from 'lucide-react'
import type { BlockEdit, BlockInfo, BlockKind, BlockStyle, ColorRef, Slot } from '@/core/types'
import { BLOCK_LABEL, COMPOSITE } from '@/core/blocks'
import { effectiveEdit } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { advise, suggestedVariants, type Advice } from '@/core/advise'
import { resolveFields } from '@/core/content'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { useBlockPreview } from './preview'
import type { FrameRect } from '@/frame/bridge'
import { keepInView } from '../canvas/inView'
import { draftForBlock, useMarkDraft } from '../notes/Marks'
import { SPACE_STEPS, Steps } from './Spacing'
import { MotionMenu } from './MotionMenu'
import { LookStyles, LookThumb } from './LookSamples'
import { ImageMenu } from './ImageMenu'

type Menu = 'variant' | 'style' | 'motion' | 'image' | 'more' | 'advice' | null

const PLURAL: Record<BlockKind, string> = {
  heading: 'headings',
  text: 'text blocks',
  button: 'buttons',
  link: 'links',
  badge: 'badges',
  icon: 'icons',
  image: 'images',
  input: 'fields',
  card: 'cards',
  item: 'items',
  list: 'lists',
}

/**
 * The selected block's controls, floating beside it on the page: where it sits
 * (a breadcrumb you can climb), its look (variant), its colours and shape, and
 * whether the change is just here or for every block of its kind.
 */
export function BlockBar({ slot, block, rect }: { slot: Slot; block: BlockInfo; rect: FrameRect | null }) {
  const blocks = library.clips[slot.clipId].blocks
  const components = useStore((s) => s.guide.components)
  const own = slot.edits?.[slot.clipId]?.[block.id]
  const def = components?.[block.kind]
  const edit = effectiveEdit(own, def)
  const variants = variantsFor(block.kind)
  const [menu, setMenu] = useState<Menu>(null)
  const ref = useRef<HTMLDivElement>(null)
  const st = useStore.getState
  const preview = useBlockPreview()

  useEffect(() => setMenu(null), [block.id])
  // A menu that opens near the bottom of the screen slides the page up so it's all in view.
  useLayoutEffect(() => {
    if (menu) keepInView(ref.current)
  }, [menu])
  useEffect(() => {
    if (!menu) return
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(null)
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [menu])
  useEffect(() => () => preview.clear(), [block.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const crumbs: BlockInfo[] = []
  for (let b: BlockInfo | undefined = block; b; b = b.parent ? blocks.find((x) => x.id === b!.parent) : undefined) crumbs.unshift(b)
  const name = (b: BlockInfo) => b.label.split(' · ').at(-1) ?? BLOCK_LABEL[b.kind]

  const apply = (patch: Partial<BlockEdit>) => {
    preview.clear()
    st().editBlock(slot.id, block.id, patch)
  }
  const hover = (patch: Partial<BlockEdit> | null) => (patch ? preview.show(slot.id, block.id, patch) : preview.clear())
  const current = variants.find((v) => v.id === edit?.variant)
  const advice = useAdvice(slot, block, rect)
  const sampleText = useMemo(() => {
    const clip = library.clips[slot.clipId]
    const fields = resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
    const inner = block.field ?? blocks.find((b) => b.parent === block.id && b.field && (b.kind === 'heading' || b.kind === 'text'))?.field
    return (inner && fields[inner]) || BLOCK_LABEL[block.kind]
  }, [block, blocks, slot])
  const suggested = useMemo(() => {
    const clip = library.clips[slot.clipId]
    return suggestedVariants(block, { blocks, fields: resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields })
  }, [block, blocks, slot])
  const fix = (a: Advice) => {
    if (a.fix?.promote) {
      st().promoteBlock(slot.id, block.id)
      st().showFlash(`Every ${BLOCK_LABEL[block.kind].toLowerCase()} now uses this look`, { undo: true })
    } else if (a.fix?.edit) apply(a.fix.edit)
    setMenu(null)
  }

  return (
    <div ref={ref} className="flex flex-col items-start gap-1.5" data-chrome onPointerDown={(e) => e.stopPropagation()}>
      <div className="glass-panel flex h-10 items-center gap-0.5 rounded-[14px] pl-2 pr-1 text-[12.5px]">
        {/* where you are: climb by clicking a crumb */}
        <div className="flex min-w-0 items-center gap-0.5 pr-1">
          {crumbs.map((b, i) => (
            <span key={b.id} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight size={12} className="shrink-0 text-zinc-300" />}
              <button
                type="button"
                onClick={() => st().selectBlock(b.id)}
                className={`max-w-[120px] truncate rounded-md px-1 py-0.5 transition ${b.id === block.id ? 'font-semibold text-zinc-900' : 'text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-800'}`}
              >
                {name(b)}
              </button>
            </span>
          ))}
        </div>
        <Sep />
        {variants.length > 0 && (
          <BarButton active={menu === 'variant'} onClick={() => setMenu(menu === 'variant' ? null : 'variant')} icon={Shapes} title="Look">
            {current?.label ?? 'Original'}
            <ChevronDown size={12} className="text-zinc-400" />
          </BarButton>
        )}
        <BarButton active={menu === 'style'} onClick={() => setMenu(menu === 'style' ? null : 'style')} icon={Palette} title="Colour and shape">
          <StyleDots style={edit?.style} />
        </BarButton>
        {block.kind === 'image' && (
          <BarButton active={menu === 'image'} onClick={() => setMenu(menu === 'image' ? null : 'image')} icon={ImageIcon} title="Picture">
            {edit?.media ? <span className="size-1.5 rounded-full bg-tape" /> : 'Image'}
          </BarButton>
        )}
        <BarButton active={menu === 'motion'} onClick={() => setMenu(menu === 'motion' ? null : 'motion')} icon={Waves} title="Motion">
          {edit?.motion ? <span className="size-1.5 rounded-full bg-tape" /> : null}
        </BarButton>
        {block.field && (
          <BarButton onClick={() => preview.requestEditText(block.id)} icon={Type} title="Edit text (double-click or ↵)">
            Edit
          </BarButton>
        )}
        <BarButton
          onClick={() => {
            const clip = library.clips[slot.clipId]
            const words = resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
            const d = rect && draftForBlock(slot, block.id, rect, words)
            if (d) useMarkDraft.getState().open(d)
          }}
          icon={MessageSquarePlus}
          title="Leave a note on this block (N)"
        />
        <Sep />
        {advice.length > 0 && (
          <button
            type="button"
            title={advice[0].message}
            onClick={() => setMenu(menu === 'advice' ? null : 'advice')}
            className={`relative grid size-8 shrink-0 place-items-center rounded-[10px] transition ${menu === 'advice' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-950/5'}`}
            aria-label={`${advice.length} suggestion${advice.length > 1 ? 's' : ''}`}
          >
            <Lightbulb size={15} />
            <span className={`absolute right-1 top-1 size-2 rounded-full ring-2 ring-white ${advice.some((a) => a.level === 'problem') ? 'bg-problem' : 'bg-attention'}`} />
          </button>
        )}
        <BarButton active={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')} icon={MoreHorizontal} title="More" />
      </div>

      {menu === 'variant' && (
        <Popover width={340}>
          <LookStyles />
          <div onMouseLeave={() => hover(null)}>
            {suggested.length > 0 && (
              <div className="flex items-center gap-1 px-2 pb-1 pt-1 text-[11px] font-semibold text-zinc-400">
                <Sparkles size={11} /> Suggested here
              </div>
            )}
            <LookRow kind={block.kind} text={sampleText} label="Original" hint="As clipped" on={!edit?.variant} onHover={() => hover({ variant: undefined })} onPick={() => apply({ variant: undefined })} />
            {variants
              .filter((v) => suggested.includes(v.id))
              .sort((a, b) => rank(suggested, a.id) - rank(suggested, b.id))
              .map((v) => (
                <LookRow key={v.id} kind={block.kind} look={v.id} text={sampleText} label={v.label} hint={v.hint} on={edit?.variant === v.id} onHover={() => hover({ variant: v.id })} onPick={() => apply({ variant: v.id })} />
              ))}
            {variants.some((v) => !suggested.includes(v.id)) && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-zinc-400">{suggested.length ? 'More' : 'Looks'}</div>}
            {variants
              .filter((v) => !suggested.includes(v.id))
              .map((v) => (
                <LookRow key={v.id} kind={block.kind} look={v.id} text={sampleText} label={v.label} hint={v.hint} on={edit?.variant === v.id} onHover={() => hover({ variant: v.id })} onPick={() => apply({ variant: v.id })} />
              ))}
          </div>
        </Popover>
      )}
      {menu === 'advice' && (
        <Popover width={300}>
          {advice.map((a, n) => (
            <div key={n} className="flex gap-2.5 rounded-xl px-2.5 py-2">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.level === 'problem' ? 'bg-problem' : 'bg-attention'}`} />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">{a.lens}</div>
                <div className="text-[12.5px] leading-snug text-zinc-700">{a.message}</div>
                {a.fix && (
                  <button
                    type="button"
                    onMouseEnter={() => a.fix?.edit && hover(a.fix.edit)}
                    onMouseLeave={() => hover(null)}
                    onClick={() => fix(a)}
                    className="mt-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-zinc-700"
                  >
                    {a.fix.label}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="px-2.5 pb-1 pt-0.5 text-[11px] leading-snug text-zinc-400">
            Suggestions, not rules: our distillations of IIDS, Laws of UX and Emil Kowalski’s design-engineering craft, not endorsed by them.
          </div>
        </Popover>
      )}
      {menu === 'style' && <StyleMenu style={own?.style} inherited={def?.style} composite={COMPOSITE.has(block.kind)} onHover={(s) => hover(s ? { style: s } : null)} onPick={(s) => apply({ style: s })} />}
      {menu === 'image' && (
        <ImageMenu block={block} fill={own?.media} onHover={(m) => hover(m ? { media: m } : null)} onPick={(m) => apply({ media: m ?? undefined })} />
      )}
      {menu === 'motion' && <MotionMenu kind={block.kind} motion={edit?.motion} onHover={(m) => hover(m ? { motion: m } : null)} onPick={(m) => apply({ motion: m })} />}
      {menu === 'more' && (
        <Popover width={248}>
          <MenuItem
            icon={Users}
            disabled={!own}
            onClick={() => {
              st().promoteBlock(slot.id, block.id)
              st().showFlash(`Every ${BLOCK_LABEL[block.kind].toLowerCase()} now uses this look`, { undo: true })
              setMenu(null)
            }}
          >
            Use for all {PLURAL[block.kind]}
          </MenuItem>
          {def && (
            <MenuItem
              icon={RotateCcw}
              onClick={() => {
                st().clearComponent(block.kind)
                setMenu(null)
              }}
            >
              Stop the look for all {PLURAL[block.kind]}
            </MenuItem>
          )}
          <MenuItem
            icon={RotateCcw}
            disabled={!own}
            onClick={() => {
              st().editBlock(slot.id, block.id, null)
              setMenu(null)
            }}
          >
            Reset this block
          </MenuItem>
          <MenuItem
            icon={EyeOff}
            onClick={() => {
              st().editBlock(slot.id, block.id, { hidden: true })
              st().selectBlock(null)
              st().showFlash('Block hidden', { undo: true })
            }}
            kbd="⌫"
          >
            Hide
          </MenuItem>
        </Popover>
      )}
    </div>
  )
}

function Sep() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-zinc-950/10" />
}

function BarButton({
  icon: Icon,
  children,
  active,
  title,
  onClick,
}: {
  icon: typeof Type
  children?: ReactNode
  active?: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2 font-medium transition ${active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5'}`}
    >
      <Icon size={14} className={active ? 'text-white' : 'text-zinc-500'} />
      {children}
    </button>
  )
}

function Popover({ children, width = 320 }: { children: ReactNode; width?: number }) {
  return (
    <div className="glass-menu animate-pop rounded-2xl p-1.5" style={{ width }}>
      {children}
    </div>
  )
}

function MenuItem({ icon: Icon, children, onClick, disabled, kbd }: { icon: typeof Type; children: ReactNode; onClick: () => void; disabled?: boolean; kbd?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-950/5 disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon size={14} className="shrink-0 text-zinc-400" />
      <span className="flex-1">{children}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  )
}

const rank = (list: string[], id: string) => (list.includes(id) ? list.indexOf(id) : 99)

/** One look: the block drawn in it, with its name and when to reach for it. */
function LookRow({ kind, look, text, label, hint, on, onHover, onPick }: { kind: BlockKind; look?: string; text: string; label: string; hint: string; on: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition active:scale-[0.99] ${on ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`}
    >
      <LookThumb kind={kind} look={look} text={text} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-zinc-900">{label}</span>
        <span className="block truncate text-[11.5px] text-zinc-500">{hint}</span>
      </span>
      {on && <span className="size-1.5 shrink-0 rounded-full bg-tape" />}
    </button>
  )
}

/* ---------- colour and shape ---------- */

const CORE: { ref: ColorRef; key: string; label: string }[] = [
  { ref: 'primary', key: 'color.primary', label: 'Primary' },
  { ref: 'accent', key: 'color.accent', label: 'Accent' },
  { ref: 'text', key: 'color.text', label: 'Text' },
  { ref: 'muted', key: 'color.muted', label: 'Muted' },
  { ref: 'surface', key: 'color.surface', label: 'Surface' },
  { ref: 'bg', key: 'color.bg', label: 'Page' },
]

/** Resolve a palette ref to something the browser can paint in the chrome. */
function usePaint() {
  const tokens = useResolvedGuide().tokens as Record<string, string>
  const swatches = useStore((s) => s.guide.swatches) ?? []
  return (ref: ColorRef | undefined) => {
    if (!ref) return undefined
    const [name, mix] = ref.split('/')
    const base = name.startsWith('x:') ? swatches.find((w) => w.name === name.slice(2))?.value : tokens[`color.${name}`]
    if (!base) return undefined
    return mix ? `color-mix(in oklab, ${base} ${mix}%, ${tokens['color.bg']})` : base
  }
}

function StyleDots({ style }: { style?: BlockStyle }) {
  const paint = usePaint()
  if (!style?.fill && !style?.ink) return <span className="text-zinc-500">Style</span>
  return (
    <span className="flex items-center -space-x-1">
      {style.fill && <span className="size-3.5 rounded-full ring-2 ring-white" style={{ background: paint(style.fill) }} />}
      {style.ink && <span className="size-3.5 rounded-full ring-2 ring-white" style={{ background: paint(style.ink) }} />}
    </span>
  )
}

const SPACE_PROPS: { k: 'padding' | 'above' | 'below' | 'gap'; label: string }[] = [
  { k: 'padding', label: 'Padding' },
  { k: 'above', label: 'Above' },
  { k: 'below', label: 'Below' },
  { k: 'gap', label: 'Gap' },
]

function StyleMenu({
  style,
  inherited,
  composite,
  onHover,
  onPick,
}: {
  style?: BlockStyle
  inherited?: BlockStyle
  /** Lists, cards and items also get a gap between their children. */
  composite: boolean
  onHover: (s: BlockStyle | null) => void
  onPick: (s: BlockStyle) => void
}) {
  const paint = usePaint()
  const swatches = useStore((s) => s.guide.swatches) ?? []
  const shown = { ...inherited, ...style }
  const refs: { ref: ColorRef; label: string }[] = [...CORE, ...swatches.map((w) => ({ ref: `x:${w.name}`, label: w.name }))]
  const base = shown.fill?.split('/')[0]
  const [adding, setAdding] = useState(false)

  const Row = ({ prop, label }: { prop: 'fill' | 'ink'; label: string }) => (
    <div className="px-2 py-1.5">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-400">
        {label}
        {style?.[prop] && (
          <button type="button" className="font-medium text-zinc-500 hover:text-zinc-900" onClick={() => onPick({ [prop]: undefined })}>
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" onMouseLeave={() => onHover(null)}>
        {refs.map((r) => (
          <Swatch key={r.ref} color={paint(r.ref)} label={r.label} on={shown[prop] === r.ref} onHover={() => onHover({ [prop]: r.ref })} onPick={() => onPick({ [prop]: r.ref })} />
        ))}
        {prop === 'fill' && (
          <button
            type="button"
            title="New colour"
            onClick={() => setAdding(true)}
            className="grid size-7 place-items-center rounded-full border border-dashed border-zinc-300 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-900"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <Popover width={300}>
      <Row prop="fill" label="Fill" />
      {base && (
        // Explore around the chosen colour: lighter mixes of it towards the page.
        <div className="flex items-center gap-1.5 px-2 pb-1.5" onMouseLeave={() => onHover(null)}>
          <span className="w-12 text-[11px] font-medium text-zinc-400">Explore</span>
          {[12, 24, 45, 70].map((m) => {
            const ref = `${base}/${m}`
            return <Swatch key={m} small color={paint(ref)} label={`${m}%`} on={shown.fill === ref} onHover={() => onHover({ fill: ref })} onPick={() => onPick({ fill: ref })} />
          })}
        </div>
      )}
      {adding && <NewSwatch onDone={(name) => (setAdding(false), name && onPick({ fill: `x:${name}` }))} />}
      <Row prop="ink" label="Text" />
      <div className="px-2 py-1.5">
        <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Corners</div>
        <Segmented
          options={(['none', 'sm', 'md', 'lg', 'pill'] as const).map((v) => ({ v, label: { none: 'None', sm: 'S', md: 'M', lg: 'L', pill: 'Pill' }[v] }))}
          value={shown.radius}
          onHover={(v) => onHover(v ? { radius: v } : null)}
          onPick={(v) => onPick({ radius: v })}
        />
      </div>
      <div className="px-2 py-1.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-400">
          Spacing
          {(style?.padding !== undefined || style?.above !== undefined || style?.below !== undefined || style?.gap !== undefined) && (
            <button type="button" className="font-medium text-zinc-500 hover:text-zinc-900" onClick={() => onPick({ padding: undefined, above: undefined, below: undefined, gap: undefined })}>
              Reset
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {SPACE_PROPS.filter((p) => p.k !== 'gap' || composite).map((p) => (
            <div key={p.k} className="flex items-center gap-2">
              <span className="w-14 text-[11.5px] font-medium text-zinc-500">{p.label}</span>
              <div className="flex-1">
                <Steps options={SPACE_STEPS} value={shown[p.k]} onHover={(v) => onHover(v === null ? null : { [p.k]: v })} onPick={(v) => onPick({ [p.k]: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-2 pb-2 pt-1.5">
        <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Shadow</div>
        <Segmented
          options={(['none', 'soft', 'lifted', 'offset'] as const).map((v) => ({ v, label: { none: 'None', soft: 'Soft', lifted: 'Lifted', offset: 'Offset' }[v] }))}
          value={shown.shadow}
          onHover={(v) => onHover(v ? { shadow: v } : null)}
          onPick={(v) => onPick({ shadow: v })}
        />
      </div>
    </Popover>
  )
}

function Swatch({ color, label, on, onHover, onPick, small }: { color?: string; label: string; on: boolean; onHover: () => void; onPick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      onMouseEnter={onHover}
      onClick={onPick}
      className={`${small ? 'size-6' : 'size-7'} rounded-full ring-offset-2 transition hover:scale-110 ${on ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/10'}`}
      style={{ background: color }}
    />
  )
}

function Segmented<T extends string>({ options, value, onHover, onPick }: { options: { v: T; label: string }[]; value?: T; onHover: (v: T | null) => void; onPick: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-chip p-0.5" onMouseLeave={() => onHover(null)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onMouseEnter={() => onHover(o.v)}
          onClick={() => onPick(o.v)}
          className={`h-6 flex-1 rounded-full text-[11.5px] font-semibold transition ${value === o.v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Add a brand colour to the palette; it becomes a swatch everywhere. */
function NewSwatch({ onDone }: { onDone: (name: string | null) => void }) {
  const [value, setValue] = useState('#7c5cff')
  const [name, setName] = useState('')
  const save = () => {
    const n = name.trim() || `Colour ${(useStore.getState().guide.swatches?.length ?? 0) + 1}`
    useStore.getState().addSwatch(n, value)
    onDone(n)
  }
  return (
    <div className="mx-2 mb-1.5 flex items-center gap-2 rounded-xl bg-zinc-950/[0.04] p-1.5">
      <input type="color" value={value} onChange={(e) => setValue(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Colour" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onDone(null)
        }}
        placeholder="Name, e.g. Sunset"
        className="h-7 min-w-0 flex-1 rounded-lg bg-white px-2 text-[12.5px] outline-none ring-1 ring-zinc-950/10 focus:ring-zinc-400"
      />
      <button type="button" onClick={save} className="btn-lit btn-ink h-7 rounded-lg px-2.5 text-[12px] font-semibold">
        Add
      </button>
    </div>
  )
}

/** Checklist suggestions for the selected block, in context of its section and the page. */
function useAdvice(slot: Slot, block: BlockInfo, rect: { w: number; h: number } | null): Advice[] {
  const guide = useResolvedGuide()
  const swatches = useStore((s) => s.guide.swatches)
  const components = useStore((s) => s.guide.components)
  const content = useStore((s) => s.content)
  const slots = useStore((s) => s.slots)
  return useMemo(() => {
    const clip = library.clips[slot.clipId]
    const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
    // Every distinct one-off look per kind across the page.
    const pageStyles: Partial<Record<BlockKind, string[]>> = {}
    for (const s of slots) {
      const c = library.clips[s.clipId]
      for (const [id, e] of Object.entries(s.edits?.[s.clipId] ?? {})) {
        const k = c?.blocks.find((b) => b.id === id)?.kind
        if (!k || (!e.variant && !e.style)) continue
        const key = JSON.stringify([e.variant, e.style])
        pageStyles[k] = [...new Set([...(pageStyles[k] ?? []), key])]
      }
    }
    return advise({
      blocks: clip.blocks,
      sectionType: clip.type,
      edits: slot.edits?.[slot.clipId],
      components,
      tokens: guide.tokens,
      swatches,
      fields,
      rects: rect ? { [block.id]: rect } : undefined,
      pageStyles,
    }).filter((a) => a.blockId === block.id)
  }, [slot, block.id, rect, guide.tokens, swatches, components, content, slots])
}
