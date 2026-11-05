import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { BLOCK_LABEL } from '@/core/blocks'
import { defaultFor, effectiveEdit } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { suggestedVariants } from '@/core/advise'
import { resolveFields } from '@/core/content'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { useBlockPreview } from './preview'
import { LookSample, LookStyles } from './LookSamples'

/**
 * Looks for the selected block, in the dock: a row of live tiles (Suggested first, or All), so the block stays in view
 * on the canvas above while you browse. Pointing at a tile shows it on the block; a click keeps it; ← → step through
 * them (each step applies, one undo step like the bar's ‹ ›); Escape closes the tray.
 */
export function LooksTray() {
  const slot = useStore((s) => currentSlots(s).find((x) => x.id === s.ui.focusedSlotId))
  const blockId = useStore((s) => s.ui.selectedBlockId)
  const components = useStore((s) => s.guide.components)
  const content = useStore((s) => s.content)
  const [show, setShow] = useState<'suggested' | 'all'>('suggested')
  const preview = useBlockPreview()
  const clip = slot ? slotClip(slot) : null
  const block = clip?.blocks.find((b) => b.id === blockId)
  const variants = block ? variantsFor(block.kind) : []
  const edit = block && slot ? effectiveEdit(slot.edits?.[slot.clipId]?.[block.id], defaultFor(components, block)) : undefined
  const current = edit?.variant
  const fields = useMemo(() => (clip && slot ? resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields : {}), [clip, slot, content])
  const suggested = useMemo(() => (block && clip ? suggestedVariants(block, { blocks: clip.blocks, fields }) : []), [block, clip, fields])
  const text = useMemo(() => {
    if (!block || !clip) return ''
    const inner = block.field ?? clip.blocks.find((b) => b.parent === block.id && b.field && (b.kind === 'heading' || b.kind === 'text'))?.field
    return (inner && fields[inner]) || BLOCK_LABEL[block.kind]
  }, [block, clip, fields])

  // Original, then the suggested looks (in their order), then the rest when showing all.
  const order: (string | undefined)[] = useMemo(() => {
    const sug = suggested.filter((id) => variants.some((v) => v.id === id))
    const rest = variants.map((v) => v.id).filter((id) => !sug.includes(id))
    return [undefined, ...sug, ...(show === 'all' || !sug.length ? rest : [])]
  }, [variants, suggested, show])

  const apply = (look: string | undefined) => {
    if (!slot || !block) return
    preview.clear()
    useStore.getState().editBlock(slot.id, block.id, { variant: look })
  }
  // ← → step through the looks; Escape closes. Caught before the canvas's own arrow keys (which slide sections).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        preview.clear()
        useStore.getState().setUi({ sheet: 'none' })
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.metaKey && !e.altKey && !e.ctrlKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const i = order.indexOf(current)
        apply(order[(i + (e.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length])
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })
  useEffect(() => () => preview.clear(), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!slot || !block) return <p className="px-4 py-6 text-[12.5px] text-zinc-500">Select a block on the page to see its looks.</p>
  if (!variants.length) return <p className="px-4 py-6 text-[12.5px] text-zinc-500">{BLOCK_LABEL[block.kind]} blocks have no other looks.</p>
  const label = (look: string | undefined) => (look ? (variants.find((v) => v.id === look)?.label ?? look) : 'Original')
  const hint = (look: string | undefined) => (look ? variants.find((v) => v.id === look)?.hint : 'As clipped')
  return (
    <div className="pb-2 pt-3">
      <LookStyles />
      <div className="mb-2.5 flex items-center gap-3 px-3">
        <div className="flex rounded-full bg-chip p-0.5" role="tablist">
          {(['suggested', 'all'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={show === k}
              onClick={() => setShow(k)}
              className={`flex h-6 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition ${show === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {k === 'suggested' && <Sparkles size={11} />}
              {k === 'suggested' ? 'Suggested' : `All · ${variants.length + 1}`}
            </button>
          ))}
        </div>
        <span className="truncate text-[12px] text-zinc-500">
          Looks for <b className="font-semibold text-zinc-800">{block.label.split(' · ').slice(1).join(' · ') || BLOCK_LABEL[block.kind]}</b>
        </span>
        <span className="ml-auto hidden shrink-0 text-[11.5px] text-zinc-400 md:inline">
          <span className="kbd">←</span> <span className="kbd">→</span> to step through
        </span>
      </div>
      <div className="thin-scroll fade-x flex gap-2.5 overflow-x-auto scroll-px-3 px-3 pb-1.5 pt-1" onMouseLeave={() => preview.clear()}>
        {order.map((look) => {
          const on = look === current
          return (
            <button
              key={look ?? 'original'}
              type="button"
              aria-pressed={on}
              title={hint(look)}
              onMouseEnter={() => preview.show(slot.id, block.id, { variant: look })}
              onFocus={() => preview.show(slot.id, block.id, { variant: look })}
              onClick={() => apply(look)}
              className="group w-[150px] shrink-0 cursor-pointer text-left focus-visible:outline-none active:scale-[0.97] transition-[scale] duration-150"
            >
              <span
                className={`lv grid h-[92px] w-full place-items-center overflow-hidden rounded-xl ring-2 transition-[box-shadow] duration-150 group-focus-visible:ring-zinc-400 ${on ? 'ring-key' : 'ring-zinc-950/8 group-hover:ring-zinc-950/25'}`}
                style={{ background: 'var(--mx-color-bg)' }}
              >
                <span style={{ zoom: block.kind === 'card' || block.kind === 'item' || block.kind === 'heading' ? 0.75 : 0.9 }}>
                  <LookSample kind={block.kind} look={look} text={text} />
                </span>
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 px-0.5">
                <span className={`truncate text-[12px] ${on ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{label(look)}</span>
                {on && <span className="size-1.5 shrink-0 rounded-full bg-key" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
