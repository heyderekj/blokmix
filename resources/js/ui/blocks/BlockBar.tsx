import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { Link2, LayoutTemplate, Check, Copy, ListRestart, Minus, ChevronDown, ChevronLeft, ChevronRight, EyeOff, Eye, Smartphone, MoreHorizontal, Palette, Plus, RotateCcw, Type, Users, MessageSquarePlus, Image as ImageIcon, Smile, Database } from 'lucide-react'
import type { BlockEdit, BlockInfo, BlockKind, BlockStyle, ColorRef, MobileSpacing, Slot } from '@/core/types'
import { BLOCK_LABEL, COMPOSITE } from '@/core/blocks'
import { defaultFor, effectiveEdit } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { advise, type Advice } from '@/core/advise'
import { resolveFields, TYPE_LABEL } from '@/core/content'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { useLinkScope, useResolvedGuide } from '@/state/derived'
import { useBlockPreview } from './preview'
import type { FrameRect } from '@/frame/bridge'
import { keepInView } from '../canvas/inView'
import { draftForBlock, useMarkDraft } from '../notes/Marks'
import { DeviceSwitch, MobileHint, RowLabel, SPACE_STEPS, Steps, useDevice } from './Spacing'
import { useLayout } from '@/state/layout'
import { MEASURE_WIDTHS, useMeasuredPage } from '@/lib/measure'
import { MotionMenu } from './MotionMenu'
import { ImageMenu } from './ImageMenu'
import { IconMenu } from './IconMenu'
import { blockIconName } from '@/core/icons'
import { listContext } from '@/core/lists'
import { sectionLinks } from '@/core/links'
import { WordsCycler, WordsMenu } from './WordsMenu'
import { LinkLabel, LinkMenu } from './LinkMenu'
import { CollectionMenu } from './CollectionMenu'
import { TextMenu } from './TextMenu'
import { autoTextStyle } from '@/core/textStyles'
import { LooksPicker, stepLook } from './LooksPicker'
import { setStylePanel, useStylePanel } from '../panels/stylePanel'

/** Icons that read as included or not. */
const MARK_ON = ['check', 'check-circle']
const MARK_OFF = ['minus', 'x']
type Menu = 'crumbs' | 'image' | 'icon' | 'words' | 'link' | 'more' | 'collection' | null

const PLURAL: Record<BlockKind, string> = {
  heading: 'headings',
  text: 'text blocks',
  button: 'buttons',
  link: 'links',
  badge: 'badges',
  icon: 'icons',
  image: 'images',
  input: 'fields',
  banner: 'banners',
  card: 'cards',
  item: 'items',
  list: 'lists',
}

/**
 * The selected block's bar, slim like the section's: what it is (its parents a click away), its look a step at a time,
 * then what it says and where it goes. Everything about how it looks (text style, color and shape, motion) is in the
 * Style panel at the window's side, the same panel a section uses.
 */
export function BlockBar({ slot, block, rect }: { slot: Slot; block: BlockInfo; rect: FrameRect | null }) {
  const blocks = slotClip(slot).blocks
  const components = useStore((s) => s.guide.components)
  const own = slot.edits?.[slot.clipId]?.[block.id]
  const def = defaultFor(components, block)
  const edit = effectiveEdit(own, def)
  const variants = variantsFor(block.kind)
  const [menu, setMenu] = useState<Menu>(null)
  const ref = useRef<HTMLDivElement>(null)
  const st = useStore.getState
  const preview = useBlockPreview()
  const styling = useStylePanel((s) => s.open)

  useEffect(() => {
    setMenu(null)
    useBlockPreview.getState().setKeepNext(null)
  }, [block.id])
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

  const mark = (() => {
    if (block.kind !== 'icon') return null
    const original = blockIconName(slotClip(slot).html, block.id)
    const now = own?.icon ?? original
    if (!now || ![...MARK_ON, ...MARK_OFF].includes(now)) return null
    const on = MARK_ON.includes(now)
    // Back to the clip's own drawing when it was the other kind of mark (a cross stays a cross).
    const next = on ? (original && MARK_OFF.includes(original) ? original : 'minus') : original && MARK_ON.includes(original) ? original : 'check'
    return { on, next, original }
  })()
  const apply = (patch: Partial<BlockEdit>) => {
    preview.clear()
    st().editBlock(slot.id, block.id, patch)
  }
  const hover = (patch: Partial<BlockEdit> | null) => (patch ? preview.show(slot.id, block.id, patch) : preview.clear())
  const current = variants.find((v) => v.id === edit?.variant)
  // The Style panel measures the page for its suggestions; while it's closed, the bar does, for the dot on Style.
  const advice = useAdvice(slot, block, rect, !styling)
  const list = listContext(slotClip(slot), slot, block.id)

  return (
    <div ref={ref} className="flex w-max flex-col items-start gap-1.5" data-chrome onPointerDown={(e) => e.stopPropagation()}>
      <div className="glass-panel flex h-11 items-center gap-1 whitespace-nowrap rounded-2xl pl-1.5 pr-1.5 text-[13px]">
        {/* what it is; its parents (up to the section) are a click away */}
        <button
          type="button"
          aria-expanded={menu === 'crumbs'}
          title={crumbs.map(name).join(' › ')}
          onClick={() => setMenu(menu === 'crumbs' ? null : 'crumbs')}
          className={`flex h-8 cursor-pointer items-center gap-1 rounded-full pl-2.5 pr-2 text-[14px] font-semibold transition active:scale-[0.97] ${menu === 'crumbs' ? 'bg-zinc-950/[0.06] text-zinc-900' : 'text-zinc-900 hover:bg-zinc-950/5'}`}
        >
          <span className="max-w-[140px] truncate">{name(block)}</span>
          <ChevronDown size={13} className="text-zinc-400" />
        </button>
        {variants.length > 0 && (
          // Its looks a step at a time (← → too); the name opens them all in the Style panel.
          <div className="flex items-center">
            <button type="button" title="Previous look (←)" aria-label="Previous look" onClick={() => stepLook(slot.id, block.id, -1)} className={STEP + ' rounded-l-full'}>
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              title="See every look in the Style panel"
              onClick={() => setStylePanel(!styling)}
              className="flex h-8 max-w-[150px] cursor-pointer items-center truncate px-1.5 text-[12.5px] font-medium text-zinc-600 transition hover:text-zinc-900 active:scale-[0.97]"
            >
              {current?.label ?? 'Original'}
            </button>
            <button type="button" title="Next look (→)" aria-label="Next look" onClick={() => stepLook(slot.id, block.id, 1)} className={STEP + ' rounded-r-full'}>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
        <Sep />
        {block.field && (
          <BarButton onClick={() => preview.requestEditText(block.id)} icon={Type} title="Edit the words (double-click or ↵)">
            Edit
          </BarButton>
        )}
        {block.field && <WordsCycler slot={slot} field={block.field} open={menu === 'words'} onOpen={() => setMenu(menu === 'words' ? null : 'words')} />}
        {block.kind === 'image' && (
          <BarButton active={menu === 'image'} onClick={() => setMenu(menu === 'image' ? null : 'image')} icon={ImageIcon} title="Picture or video">
            Picture
            {edit?.media ? <span className="size-1.5 rounded-full bg-key" /> : null}
          </BarButton>
        )}
        {block.kind === 'icon' && !mark && (
          <BarButton active={menu === 'icon'} onClick={() => setMenu(menu === 'icon' ? null : 'icon')} icon={Smile} title="Choose the icon">
            Icon
          </BarButton>
        )}
        {mark && (
          // A check or a dash (a comparison cell, a plan's feature): one click switches it.
          <BarButton onClick={() => apply({ icon: mark.next === mark.original ? undefined : mark.next })} icon={mark.on ? Check : Minus} title="Included or not: click to switch">
            {mark.on ? 'Included' : 'Not included'}
          </BarButton>
        )}
        {block.linkable && (
          <BarButton active={menu === 'link'} onClick={() => setMenu(menu === 'link' ? null : 'link')} icon={Link2} title="Where it goes">
            <LinkLabel slot={slot} block={block} />
          </BarButton>
        )}
        {list && <ListControls slotId={slot.id} ctx={list} />}
        {list && (
          <BarButton active={menu === 'collection'} onClick={() => setMenu(menu === 'collection' ? null : 'collection')} icon={Database} title="Collection: show your content here">
            {slot.bind?.lists?.[list.list.listKey ?? ''] ? <span className="size-1.5 rounded-full bg-key" /> : null}
          </BarButton>
        )}
        <Sep />
        <button
          type="button"
          aria-expanded={styling}
          title={advice.length ? `Style · ${advice.length} suggestion${advice.length > 1 ? 's' : ''}` : 'Style: its look, text, color, shape and motion'}
          onClick={() => setStylePanel(!styling)}
          className={`relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 font-medium transition-[background-color,color,scale] active:scale-[0.97] ${styling ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-900'}`}
        >
          <Palette size={15} /> Style
          {advice.length > 0 && !styling && (
            <span className={`absolute right-1 top-1 size-2 rounded-full ring-2 ring-white ${advice.some((a) => a.level === 'problem') ? 'bg-problem' : 'bg-attention'}`} />
          )}
        </button>
        <BarButton
          onClick={() => {
            const clip = slotClip(slot)
            const words = resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
            const d = rect && draftForBlock(slot, block.id, rect, words)
            if (d) useMarkDraft.getState().open(d)
          }}
          icon={MessageSquarePlus}
          title="Leave a note on this block (N)"
        />
        <BarButton active={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')} icon={MoreHorizontal} title="More" />
      </div>

      {menu === 'crumbs' && (
        <Popover width={220}>
          <MenuItem icon={LayoutTemplate} onClick={() => st().selectBlock(null)} kbd="esc">
            {TYPE_LABEL[slot.type]} section
          </MenuItem>
          {crumbs.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => (b.id === block.id ? setMenu(null) : st().selectBlock(b.id))}
              className={`flex min-h-8 w-full cursor-pointer items-center rounded-lg pr-2.5 text-left text-[13px] transition-colors ${b.id === block.id ? 'bg-zinc-950/[0.06] font-semibold text-zinc-900' : 'text-zinc-700 hover:bg-zinc-950/[0.04]'}`}
              style={{ paddingLeft: 10 + (i + 1) * 12 }}
            >
              {name(b)}
            </button>
          ))}
        </Popover>
      )}
      {menu === 'icon' && (
        <IconMenu
          current={own?.icon}
          original={blockIconName(slotClip(slot).html, block.id)}
          onHover={(n) => hover(n ? { icon: n } : null)}
          onPick={(n) => apply({ icon: n ?? undefined })}
        />
      )}
      {menu === 'image' && (
        <ImageMenu block={block} fill={own?.media} onHover={(m) => hover(m ? { media: m } : null)} onPick={(m) => apply({ media: m ?? undefined })} />
      )}
      {menu === 'link' && <LinkMenu slot={slot} block={block} />}
      {menu === 'collection' && list && <CollectionMenu slot={slot} list={list.list} onClose={() => setMenu(null)} />}
      {menu === 'words' && block.field && <WordsMenu slot={slot} field={block.field} blockId={block.id} onClose={() => setMenu(null)} />}
      {menu === 'more' && (
        <Popover width={248}>
          {list?.changed && (
            <MenuItem
              icon={ListRestart}
              onClick={() => {
                st().editList(slot.id, { op: 'reset', listId: list.list.id })
                st().selectBlock(list.list.id)
                st().showFlash('Back to the layout’s own items', { undo: true })
              }}
            >
              Back to the layout’s items
            </MenuItem>
          )}
          {own?.mobile?.hidden ? (
            <MenuItem
              icon={Eye}
              onClick={() => {
                st().editBlock(slot.id, block.id, { mobile: { hidden: false } })
                setMenu(null)
              }}
            >
              Show on mobile
            </MenuItem>
          ) : (
            <MenuItem
              icon={Smartphone}
              onClick={() => {
                st().editBlock(slot.id, block.id, { mobile: { hidden: true } })
                // On a phone-width canvas it's gone from view, so let go of it.
                if (st().ui.viewport === 'mobile') st().selectBlock(null)
                else setMenu(null)
                st().showFlash('Hidden on mobile; still there on desktop', { undo: true })
              }}
            >
              Hide on mobile
            </MenuItem>
          )}
          <MenuItem
            icon={EyeOff}
            onClick={() => {
              st().editBlock(slot.id, block.id, { hidden: true })
              st().selectBlock(null)
              st().showFlash('Block hidden', { undo: true })
            }}
            kbd="⌫"
          >
            Hide everywhere
          </MenuItem>
        </Popover>
      )}
    </div>
  )
}

const STEP = 'grid h-8 w-6 cursor-pointer place-items-center text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.94]'

/**
 * How the selected block looks, in the Style panel: suggestions, its looks, its text, its color and shape, its motion,
 * and whether that's for this one or every block of its kind.
 */
export function BlockStyleBody({ slot, block }: { slot: Slot; block: BlockInfo }) {
  const blocks = slotClip(slot).blocks
  const components = useStore((s) => s.guide.components)
  const own = slot.edits?.[slot.clipId]?.[block.id]
  const def = defaultFor(components, block)
  const edit = effectiveEdit(own, def)
  const rect = useBlockPreview((s) => s.selRect)
  const st = useStore.getState
  const preview = useBlockPreview.getState
  const apply = (patch: Partial<BlockEdit>) => {
    preview().clear()
    st().editBlock(slot.id, block.id, patch)
  }
  const hover = (patch: Partial<BlockEdit> | null) => (patch ? preview().show(slot.id, block.id, patch) : preview().clear())
  const typed = ['heading', 'text', 'button', 'link', 'badge'].includes(block.kind)
  const advice = useAdvice(slot, block, rect, true)
  const fix = (a: Advice) => {
    if (a.fix?.promote) {
      st().promoteBlock(slot.id, block.id)
      st().showFlash(`Every ${BLOCK_LABEL[block.kind].toLowerCase()} now uses this look`, { undo: true })
    } else if (a.fix?.edit) apply(a.fix.edit)
  }
  useEffect(() => () => preview().clear(), [block.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {advice.length > 0 && (
        <PanelGroup title="Suggestions">
          {advice.map((a, n) => (
            <div key={n} className="flex gap-2.5 py-1">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.level === 'problem' ? 'bg-problem' : 'bg-attention'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] leading-snug text-zinc-700">{a.message}</div>
                {a.fix && (
                  <button
                    type="button"
                    onMouseEnter={() => a.fix?.edit && hover(a.fix.edit)}
                    onMouseLeave={() => hover(null)}
                    onClick={() => fix(a)}
                    className="mt-1.5 cursor-pointer rounded-full bg-zinc-900 px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.97]"
                  >
                    {a.fix.label}
                  </button>
                )}
              </div>
            </div>
          ))}
        </PanelGroup>
      )}
      {variantsFor(block.kind).length > 0 && (
        <PanelGroup title="Look">
          <LooksPicker slot={slot} block={block} />
        </PanelGroup>
      )}
      {typed && (
        <PanelGroup title="Text">
          <TextMenu
            bare
            style={own?.style}
            auto={autoTextStyle(block, blocks)}
            shownPx={rect?.font}
            onHover={(t) => hover(t ? { style: { ...own?.style, ...t } } : null)}
            onPick={(t) => apply({ style: t })}
          />
        </PanelGroup>
      )}
      <PanelGroup title="Color and shape">
        <StyleMenu
          bare
          style={own?.style}
          inherited={def?.style}
          phone={own?.mobile?.style}
          composite={COMPOSITE.has(block.kind)}
          onHover={(s) => hover(s ? { style: s } : null)}
          onPick={(s) => apply({ style: s })}
          // Phone previews carry the whole phone edit, since a preview replaces it.
          onHoverPhone={(s) => hover(s ? { mobile: { ...own?.mobile, style: { ...own?.mobile?.style, ...s } } } : null)}
          onPickPhone={(s) => apply({ mobile: { style: s } })}
        />
      </PanelGroup>
      <PanelGroup title="Motion">
        <MotionMenu bare kind={block.kind} motion={edit?.motion} onHover={(m) => hover(m ? { motion: m } : null)} onPick={(m) => apply({ motion: m })} />
      </PanelGroup>
      <div className="grid gap-0.5 border-t border-zinc-950/6 pt-2">
        <MenuItem
          icon={Users}
          disabled={!own}
          onClick={() => {
            st().promoteBlock(slot.id, block.id)
            st().showFlash(`Every ${BLOCK_LABEL[block.kind].toLowerCase()} now uses this look`, { undo: true })
          }}
        >
          Use this look for all {PLURAL[block.kind]}
        </MenuItem>
        {def && (
          <MenuItem icon={RotateCcw} onClick={() => st().clearComponent(block.kind)}>
            Stop the look for all {PLURAL[block.kind]}
          </MenuItem>
        )}
        <MenuItem icon={RotateCcw} disabled={!own} onClick={() => st().editBlock(slot.id, block.id, null)}>
          Reset this {BLOCK_LABEL[block.kind].toLowerCase()}
        </MenuItem>
      </div>
    </div>
  )
}

/** A titled group in the Style panel that folds away, Figma's way: click its title. What you fold stays folded. */
export function PanelGroup({ title, children }: { title?: string; children: ReactNode }) {
  const folded = useFolded((s) => (title ? !!s.folded[title] : false))
  return (
    <section className="border-t border-zinc-950/6 pt-1.5 first:border-t-0 first:pt-0">
      {title && (
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => toggleFolded(title)}
          className="group/fold -mx-1.5 flex h-8 w-[calc(100%+12px)] cursor-pointer items-center gap-1 rounded-lg px-1.5 text-left text-[12px] font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ChevronRight size={13} className={`shrink-0 text-zinc-400 transition-transform duration-150 ${folded ? '' : 'rotate-90'}`} />
          {title}
        </button>
      )}
      {!folded && <div className={title ? 'pb-1.5 pt-0.5' : 'py-1.5'}>{children}</div>}
    </section>
  )
}

const FOLD_KEY = 'blokmix:style-panel:folded'
const useFolded = create<{ folded: Record<string, boolean> }>()(() => {
  try {
    return { folded: JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}') }
  } catch {
    return { folded: {} }
  }
})
function toggleFolded(title: string) {
  const folded = { ...useFolded.getState().folded, [title]: !useFolded.getState().folded[title] }
  useFolded.setState({ folded })
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify(folded))
  } catch {
    /* private window: folding lasts this visit */
  }
}

/** Add, duplicate and remove a list's items, right where they are (they move by their grip, or ⌥ + arrows). */
function ListControls({ slotId, ctx }: { slotId: string; ctx: NonNullable<ReturnType<typeof listContext>> }) {
  const st = useStore.getState
  const full = ctx.count >= ctx.max
  const select = (r: { itemId: string | null } | null) => r?.itemId && st().selectBlock(r.itemId)
  if (!ctx.item)
    return (
      <BarButton icon={Plus} title={full ? `This layout holds up to ${ctx.max} items` : 'Add an item (it copies the first one)'} onClick={() => select(st().editList(slotId, { op: 'add', listId: ctx.list.id }))}>
        Add item
      </BarButton>
    )
  const item = ctx.item.id
  return (
    <div className="flex items-center">
      <IconButton icon={Copy} title={full ? `This layout holds up to ${ctx.max} items` : 'Duplicate (⌘D)'} disabled={full} onClick={() => select(st().editList(slotId, { op: 'duplicate', itemId: item }))} />
      <IconButton
        icon={Minus}
        title={ctx.count <= 1 ? 'A list keeps at least one item' : 'Remove (⌫)'}
        disabled={ctx.count <= 1}
        onClick={() => {
          if (!st().editList(slotId, { op: 'remove', itemId: item })) return
          st().selectBlock(ctx.list.id)
          st().showFlash('Item removed', { undo: true })
        }}
      />
    </div>
  )
}

function IconButton({ icon: Icon, title, onClick, disabled }: { icon: typeof Type; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-[10px] text-zinc-600 transition hover:bg-zinc-950/5 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-35"
    >
      <Icon size={14} />
    </button>
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

/* ---------- color and shape ---------- */

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

const SPACE_PROPS: { k: 'padding' | 'above' | 'below' | 'gap'; label: string }[] = [
  { k: 'padding', label: 'Padding' },
  { k: 'above', label: 'Space above' },
  { k: 'below', label: 'Space below' },
  { k: 'gap', label: 'Gap' },
]

export function StyleMenu({
  style,
  inherited,
  phone,
  composite,
  onHover,
  onPick,
  onHoverPhone,
  onPickPhone,
  bare,
}: {
  /** In a panel rather than a floating menu. */
  bare?: boolean
  style?: BlockStyle
  inherited?: BlockStyle
  /** Spacing that differs on phones. */
  phone?: MobileSpacing
  /** Lists, cards and items also get a gap between their children. */
  composite: boolean
  onHover: (s: BlockStyle | null) => void
  onPick: (s: BlockStyle) => void
  onHoverPhone: (s: MobileSpacing | null) => void
  onPickPhone: (s: MobileSpacing) => void
}) {
  const [device, setDevice] = useDevice()
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
            title="New color"
            onClick={() => setAdding(true)}
            className="grid size-7 place-items-center rounded-full border border-dashed border-zinc-300 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-900"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </div>
  )

  const body = (
    <>
      <Row prop="fill" label="Fill" />
      {base && (
        // Explore around the chosen color: lighter mixes of it towards the page.
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
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-400">
          <span className="flex items-center gap-2">
            Spacing
            {device === 'desktop' && SPACE_PROPS.some((p) => style?.[p.k] !== undefined) && (
              <button type="button" className="font-medium text-zinc-500 hover:text-zinc-900" onClick={() => onPick({ padding: undefined, above: undefined, below: undefined, gap: undefined })}>
                Reset
              </button>
            )}
          </span>
          <DeviceSwitch value={device} onChange={setDevice} />
        </div>
        <div className="space-y-1.5">
          {SPACE_PROPS.filter((p) => p.k !== 'gap' || composite).map((p) => {
            const own = phone?.[p.k]
            return device === 'desktop' ? (
              <div key={p.k} className="flex items-center gap-2">
                <RowLabel label={p.label} phone={own !== undefined} />
                <div className="flex-1">
                  <Steps options={SPACE_STEPS} value={shown[p.k]} onHover={(v) => onHover(v === null ? null : { [p.k]: v })} onPick={(v) => onPick({ [p.k]: v })} />
                </div>
              </div>
            ) : (
              // Phones: the desktop value shows faintly until you choose one for phones.
              <div key={p.k} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <RowLabel label={p.label} phone={own !== undefined} />
                  <div className="flex-1">
                    <Steps options={SPACE_STEPS} value={own ?? shown[p.k]} ghost={own === undefined} onHover={(v) => onHoverPhone(v === null ? null : { [p.k]: v })} onPick={(v) => onPickPhone({ [p.k]: v })} />
                  </div>
                </div>
                <MobileHint overridden={own !== undefined} onReset={() => onPickPhone({ [p.k]: undefined })} />
              </div>
            )
          })}
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
    </>
  )
  return bare ? <div className="-mx-2">{body}</div> : <Popover width={300}>{body}</Popover>
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

/** Add a brand color to the palette; it becomes a swatch everywhere. */
function NewSwatch({ onDone }: { onDone: (name: string | null) => void }) {
  const [value, setValue] = useState('#7c5cff')
  const [name, setName] = useState('')
  const save = () => {
    const n = name.trim() || `Color ${(useStore.getState().guide.swatches?.length ?? 0) + 1}`
    useStore.getState().addSwatch(n, value)
    onDone(n)
  }
  return (
    <div className="mx-2 mb-1.5 flex items-center gap-2 rounded-xl bg-zinc-950/[0.04] p-1.5">
      <input type="color" value={value} onChange={(e) => setValue(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Color" />
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
      <button type="button" onClick={save} className="btn-lit btn-ink cursor-pointer h-7 rounded-lg px-2.5 text-[12px] font-semibold">
        Add
      </button>
    </div>
  )
}

/**
 * Checklist suggestions for the selected block, in context of its section and
 * the page, at desktop (1280) and phone (390) widths. The page is measured at
 * both in hidden frames; until that's in, the canvas's own box stands in for
 * the width it shows.
 */
function useAdvice(slot: Slot, block: BlockInfo, rect: { w: number; h: number } | null, measure: boolean): Advice[] {
  useMeasuredPage(measure)
  const measured = useLayout((s) => s.blockRects)
  const viewport = useStore((s) => s.ui.viewport)
  const guide = useResolvedGuide()
  const swatches = useStore((s) => s.guide.swatches)
  const components = useStore((s) => s.guide.components)
  const content = useStore((s) => s.content)
  const slots = useStore(currentSlots)
  const linkScope = useLinkScope(slot.id)
  return useMemo(() => {
    const clip = slotClip(slot)
    const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
    // Every distinct one-off look per kind across the page.
    const pageStyles: Partial<Record<BlockKind, string[]>> = {}
    for (const s of slots) {
      const c = slotClip(s)
      for (const [id, e] of Object.entries(s.edits?.[s.clipId] ?? {})) {
        const k = c?.blocks.find((b) => b.id === id)?.kind
        if (!k || (!e.variant && !e.style)) continue
        const key = JSON.stringify([e.variant, e.style])
        pageStyles[k] = [...new Set([...(pageStyles[k] ?? []), key])]
      }
    }
    const links = sectionLinks(clip.blocks, slot.edits?.[slot.clipId], fields, linkScope, slot.id)
    const seen = new Set<string>()
    return [MEASURE_WIDTHS.desktop, MEASURE_WIDTHS.mobile].flatMap((width) => {
      const shownHere = (viewport === 'mobile') === (width === MEASURE_WIDTHS.mobile)
      const rects = measured[width]?.rects[slot.id] ?? (shownHere && rect ? { [block.id]: rect } : undefined)
      return advise({ blocks: clip.blocks, sectionType: clip.type, edits: slot.edits?.[slot.clipId], components, tokens: guide.tokens, swatches, fields, rects, width, pageStyles, links }).filter((a) => {
        // Advice that reads the same at both widths shows once.
        const key = `${a.rule}|${a.message}`
        if (a.blockId !== block.id || seen.has(key)) return false
        seen.add(key)
        return true
      })
    })
  }, [slot, block.id, rect, guide.tokens, swatches, components, content, slots, linkScope, measured, viewport])
}
