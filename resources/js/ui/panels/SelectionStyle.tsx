import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { ArrowUp, X } from 'lucide-react'
import type { BlockInfo, Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { BLOCK_LABEL } from '@/core/blocks'
import { slotClip } from '@/data/library'
import { useStore, currentSlots } from '@/state/store'
import { frameBeside } from '../canvas/inView'
import { setInset } from '../canvas/insets'
import { StyleTab } from '../frames/SectionPill'
import { BlockStyleBody } from '../blocks/BlockBar'
import { setStylePanel, useStylePanel } from './stylePanel'

/**
 * The Style panel: docked at the window's side, it shows how whatever is selected looks (the section, or a block in
 * it) and follows the selection, so a section and its blocks are styled in one place. The canvas moves the section
 * into the space beside it, so every change shows live.
 */
export function SelectionStyle() {
  const open = useStylePanel((s) => s.open)
  const sheet = useStore((s) => s.ui.sheet)
  const slot = useStore((s) => currentSlots(s).find((x) => x.id === s.ui.focusedSlotId))
  const blockId = useStore((s) => s.ui.selectedBlockId)
  const has = !!slot
  // A sheet opening, or letting go of every section, closes it; moving to another section or block keeps it.
  useEffect(() => {
    if (open && (sheet !== 'none' || !has)) setStylePanel(false)
  }, [open, sheet, has])
  if (!open || !slot || sheet !== 'none') return null
  const block = blockId ? slotClip(slot).blocks.find((b) => b.id === blockId) : undefined
  return <Panel slot={slot} block={block} />
}

/** The panel's width beside the canvas (on phones it's a sheet along the bottom and takes none). */
const PANEL_INSET = 340

function Panel({ slot, block }: { slot: Slot; block?: BlockInfo }) {
  const panel = useRef<HTMLDivElement>(null)
  // While docked, the page fits the space left of it.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 640px)')
    const update = () => setInset('right', wide.matches ? PANEL_INSET : 0)
    update()
    wide.addEventListener('change', update)
    return () => {
      wide.removeEventListener('change', update)
      setInset('right', 0)
    }
  }, [])
  // Frame the section when you arrive, and again when a change of layout or width changes its shape (after the row
  // settles). Moving between its blocks leaves the canvas alone.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const row = document.querySelector(`[data-slot="${CSS.escape(slot.id)}"]`)
      if (!row || !panel.current) return
      frameBeside(row, panel.current)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [slot.id, slot.clipId, slot.width, slot.slider])

  const blocks = slotClip(slot).blocks
  const crumbs: BlockInfo[] = []
  for (let b: BlockInfo | undefined = block; b; b = b.parent ? blocks.find((x) => x.id === b!.parent) : undefined) crumbs.unshift(b)
  const name = (b: BlockInfo) => b.label.split(' · ').at(-1) ?? BLOCK_LABEL[b.kind]
  const parent = crumbs.at(-2)
  const st = useStore.getState

  return createPortal(
    <motion.div
      ref={panel}
      data-chrome
      data-style-sheet
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      style={{ backgroundColor: 'var(--lift)', boxShadow: '0 0 0 1px rgb(0 0 0 / 0.08), 0 16px 40px -16px rgb(0 0 0 / 0.35)' }}
      // Below the top bar (Save, Share, Export stay reachable); on phones a sheet that sits above the dock.
      className="fixed right-3 top-[68px] z-40 flex max-h-[calc(100dvh-80px)] w-[340px] flex-col overflow-hidden rounded-2xl max-sm:inset-x-3 max-sm:bottom-[72px] max-sm:top-auto max-sm:max-h-[42vh] max-sm:w-auto"
      data-layer-host
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`${block ? name(block) : TYPE_LABEL[slot.type]} style`}
    >
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-zinc-950/6 pl-1.5 pr-1.5">
        {/* What's styled, by name, and what it sits in: one step up at a time (the bar's name menu has the whole path). */}
        {block && (
          <button
            type="button"
            title={`Up to ${parent ? name(parent) : `the ${TYPE_LABEL[slot.type].toLowerCase()} section`} (esc)`}
            aria-label="Select what it sits in"
            onClick={() => st().selectBlock(parent?.id ?? null)}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-500 transition active:scale-[0.97] hover:bg-zinc-950/5 hover:text-zinc-900"
          >
            <ArrowUp size={16} />
          </button>
        )}
        <div className={`flex min-w-0 flex-1 items-baseline gap-1.5 ${block ? '' : 'pl-1.5'}`} title={[TYPE_LABEL[slot.type], ...crumbs.map(name)].join(' › ')}>
          <span className="truncate text-[14px] font-semibold text-zinc-900">{block ? name(block) : `${TYPE_LABEL[slot.type]} section`}</span>
          <span className="shrink-0 truncate text-[12.5px] text-zinc-500">{block ? `in ${parent ? name(parent) : TYPE_LABEL[slot.type]}` : 'style'}</span>
        </div>
        <button type="button" aria-label="Close" onClick={() => setStylePanel(false)} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-600 transition active:scale-[0.97] hover:bg-zinc-950/5">
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">{block ? <BlockStyleBody key={block.id} slot={slot} block={block} /> : <StyleTab slot={slot} />}</div>
    </motion.div>,
    document.body,
  )
}
