import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { BlockInfo, Slot } from '@/core/types'
import { BLOCK_LABEL } from '@/core/blocks'
import { defaultFor, effectiveEdit, ORIGINAL } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { suggestedVariants } from '@/core/advise'
import { resolveFields } from '@/core/content'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { useBlockPreview } from './preview'
import { LookSample, LookStyles } from './LookSamples'
import { Strip } from '../panels/Strip'

/** Step the block's look: Original, then each look in turn (one undo step, like the bar's ‹ ›). */
export function stepLook(slotId: string, blockId: string, d: 1 | -1) {
  const st = useStore.getState()
  const slot = currentSlots(st).find((x) => x.id === slotId)
  const block = slot ? slotClip(slot).blocks.find((b) => b.id === blockId) : undefined
  if (!slot || !block) return false
  const variants = variantsFor(block.kind)
  if (!variants.length) return false
  const def = defaultFor(st.guide.components, block)
  const edit = effectiveEdit(slot.edits?.[slot.clipId]?.[block.id], def)
  // Over a skin's default look, Original has to be said outright (ORIGINAL), or it falls back to the default.
  const order = [def?.variant ? ORIGINAL : undefined, ...variants.map((v) => v.id)]
  const i = order.indexOf(edit?.variant)
  useBlockPreview.getState().clear()
  st.editBlock(slot.id, block.id, { variant: order[(i + d + order.length) % order.length] })
  return true
}

/**
 * The selected block's looks, in the Style panel: live tiles (Suggested first, or All). Pointing at a tile shows it on
 * the block; a click keeps it. ← → step through them from anywhere while the block is selected.
 */
export function LooksPicker({ slot, block }: { slot: Slot; block: BlockInfo }) {
  const components = useStore((s) => s.guide.components)
  const content = useStore((s) => s.content)
  const [show, setShow] = useState<'suggested' | 'all'>('suggested')
  const preview = useBlockPreview()
  const clip = slotClip(slot)
  const variants = variantsFor(block.kind)
  const def = defaultFor(components, block)
  const edit = effectiveEdit(slot.edits?.[slot.clipId]?.[block.id], def)
  const current = edit?.variant
  const original = def?.variant ? ORIGINAL : undefined
  const fields = useMemo(() => resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields, [clip, slot, content])
  const suggested = useMemo(() => suggestedVariants(block, { blocks: clip.blocks, fields }), [block, clip, fields])
  const text = useMemo(() => {
    const inner = block.field ?? clip.blocks.find((b) => b.parent === block.id && b.field && (b.kind === 'heading' || b.kind === 'text'))?.field
    return (inner && fields[inner]) || BLOCK_LABEL[block.kind]
  }, [block, clip, fields])

  // Original, then the suggested looks (in their order), then the rest when showing all.
  const order: (string | undefined)[] = useMemo(() => {
    const sug = suggested.filter((id) => variants.some((v) => v.id === id))
    const rest = variants.map((v) => v.id).filter((id) => !sug.includes(id))
    return [original, ...sug, ...(show === 'all' || !sug.length ? rest : [])]
  }, [variants, suggested, show, original])

  const apply = (look: string | undefined) => {
    preview.clear()
    useStore.getState().editBlock(slot.id, block.id, { variant: look })
  }
  useEffect(() => () => preview.clear(), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!variants.length) return <p className="px-4 py-6 text-[12.5px] text-zinc-500">{BLOCK_LABEL[block.kind]} blocks have no other looks.</p>
  const label = (look: string | undefined) => (look && look !== ORIGINAL ? (variants.find((v) => v.id === look)?.label ?? look) : 'Original')
  const hint = (look: string | undefined) => (look && look !== ORIGINAL ? variants.find((v) => v.id === look)?.hint : 'The look it came with')
  // Words show their look as a type specimen, "Aa"; buttons, badges and links keep a word or two of their own.
  const SPECIMEN = ['heading', 'text', 'card', 'item', 'banner']
  const two = text.split(/\s+/).slice(0, 2).join(' ')
  const short = SPECIMEN.includes(block.kind) ? 'Aa' : two.length > 12 ? BLOCK_LABEL[block.kind] : two
  return (
    <div>
      <LookStyles />
      <Strip
        label={`Looks for this ${BLOCK_LABEL[block.kind].toLowerCase()}`}
        watch={`${block.id}|${current}|${show}`}
        top={
          suggested.length > 0 && (
            <div className="flex w-max rounded-full bg-chip p-0.5" role="tablist">
              {(['suggested', 'all'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={show === k}
                  onClick={() => setShow(k)}
                  className={`flex h-6 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold transition ${show === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {k === 'suggested' && <Sparkles size={11} />}
                  {k === 'suggested' ? 'Suggested' : `All ${variants.length + 1}`}
                </button>
              ))}
            </div>
          )
        }
      >
        {order.map((look) => {
          const on = look === current
          return (
            <button
              key={look ?? 'original'}
              type="button"
              role="radio"
              aria-checked={on}
              data-on={on || undefined}
              title={hint(look)}
              onMouseEnter={() => preview.show(slot.id, block.id, { variant: look })}
              onMouseLeave={() => preview.clear()}
              onFocus={() => preview.show(slot.id, block.id, { variant: look })}
              onClick={() => apply(look)}
              className="group w-[96px] shrink-0 snap-start cursor-pointer text-left focus-visible:outline-none active:scale-[0.97] transition-[scale] duration-150"
            >
              <span
                className={`lv grid h-12 w-full place-items-center overflow-hidden rounded-xl px-2 ring-2 transition-[box-shadow] duration-150 group-focus-visible:ring-zinc-400 ${on ? 'ring-key' : 'ring-zinc-950/8 group-hover:ring-zinc-950/25'}`}
                // The page's color under a fine dot grid, like the canvas, so a tile reads as a piece of page against the panel.
                style={{
                  backgroundColor: 'var(--mx-color-bg)',
                  backgroundImage: 'radial-gradient(circle, color-mix(in oklab, var(--mx-color-text) 16%, transparent) 0.8px, transparent 1.15px)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '4px 4px',
                }}
              >
                <FitSample max={ZOOM[block.kind] ?? 0.7}>
                  <LookSample kind={block.kind} look={look} text={short} />
                </FitSample>
              </span>
              <span className="mt-1 flex items-center gap-1 px-0.5">
                <span className={`truncate text-[11.5px] ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{label(look)}</span>
                {on && <span className="size-1.5 shrink-0 rounded-full bg-key" />}
              </span>
            </button>
          )
        })}
      </Strip>
    </div>
  )
}

/** How small each kind's sample is drawn to fit a tile. */
const ZOOM: Partial<Record<string, number>> = { heading: 1, card: 0.55, item: 0.55, image: 0.62, banner: 0.55, input: 0.6, button: 0.72, badge: 0.8, link: 0.75, icon: 0.85, text: 1.5 }

/** A sample drawn as large as its kind allows, and smaller still if that's what it takes to fit the tile whole. */
function FitSample({ max, children }: { max: number; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [zoom, setZoom] = useState(max)
  useLayoutEffect(() => {
    const el = ref.current
    const room = el?.parentElement?.clientWidth
    if (!el || !room) return
    const was = el.style.zoom
    el.style.zoom = '1'
    const w = el.getBoundingClientRect().width
    el.style.zoom = was
    setZoom(w ? Math.min(max, (room - 16) / w) : max)
  })
  return (
    <span ref={ref} className="inline-block whitespace-nowrap" style={{ zoom }}>
      {children}
    </span>
  )
}
