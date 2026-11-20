import { useEffect, useRef, useState } from 'react'
import type { BlockInfo, Slot } from '@/core/types'
import type { FrameRect } from '@/frame/bridge'
import { useStore } from '@/state/store'
import { useBlockPreview } from '../blocks/preview'
import { SPACE_STEPS } from '../blocks/Spacing'

/** Screen pixels of drag for one step on the spacing scale. */
const PER_STEP = 14

/**
 * The space below what's selected, right where it is: a small handle on its bottom edge. Drag it down for more room,
 * up for less, a step on the spacing scale at a time (the step shows as you go); letting go keeps it as one undo step,
 * Escape puts it back. The same value as Space below in the Style panel.
 */
export function SpaceHandle({ slot, block, rect }: { slot: Slot; block: BlockInfo; rect: FrameRect }) {
  const own = slot.edits?.[slot.clipId]?.[block.id]?.style
  const now = own?.below
  const from = Math.max(0, SPACE_STEPS.findIndex((s) => s.v === (now ?? 0)))
  const [drag, setDrag] = useState<{ y: number; at: number } | null>(null)
  const live = useRef(drag)
  live.current = drag
  const preview = useBlockPreview.getState

  useEffect(() => {
    if (!drag) return
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      finish(false)
    }
    window.addEventListener('keydown', cancel, true)
    return () => window.removeEventListener('keydown', cancel, true)
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  // Letting go keeps the step it's on (one undo step); nothing changes if it's where it started.
  const finish = (keep: boolean) => {
    const d = live.current
    if (!d) return
    live.current = null
    setDrag(null)
    preview().clear()
    if (!keep || d.at === from) return
    // Back to nothing extra is the layout's own spacing again.
    const v = SPACE_STEPS[d.at].v
    useStore.getState().editBlock(slot.id, block.id, { style: { below: v === 0 && now === undefined ? undefined : v } })
  }

  const at = drag?.at ?? from
  const step = SPACE_STEPS[at]
  return (
    <div
      // Above the block bar's wrapper, whose clear top edge would otherwise cover it.
      className="absolute z-40"
      style={{ left: rect.x + rect.w / 2, top: rect.y + rect.h, width: 0, height: 0 }}
      data-chrome
    >
      <div className="absolute left-0 top-0" style={{ transform: 'translate(-50%, -50%) scale(min(calc(1 / var(--zl)), 3.4))' }}>
        <span
          role="slider"
          tabIndex={-1}
          aria-label="Space below"
          aria-valuemin={0}
          aria-valuemax={SPACE_STEPS.length - 1}
          aria-valuenow={at}
          aria-valuetext={step.label}
          title={`Space below: ${now === undefined ? 'as the layout has it' : SPACE_STEPS[from].label}. Drag to change`}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // A pointer the browser doesn't know (a test's) can't be captured; the moves still come here.
            }
            live.current = { y: e.clientY, at: from }
            setDrag(live.current)
          }}
          onPointerMove={(e) => {
            const d = live.current
            if (!d) return
            const next = Math.min(SPACE_STEPS.length - 1, Math.max(0, from + Math.round((e.clientY - d.y) / PER_STEP)))
            if (next === d.at) return
            live.current = { ...d, at: next }
            setDrag(live.current)
            preview().show(slot.id, block.id, { style: { ...own, below: SPACE_STEPS[next].v } })
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
            finish(true)
          }}
          // Whatever takes the pointer away (a frame, the window losing focus) ends the drag where it is.
          onLostPointerCapture={() => finish(true)}
          onPointerCancel={() => finish(false)}
          className={`grid h-3.5 w-7 cursor-ns-resize touch-none place-items-center rounded-full bg-key shadow-[0_0_0_1.5px_rgb(255_255_255/0.85),0_2px_6px_-1px_rgb(0_0_0/0.3)] transition-[scale] hover:scale-110 ${drag ? 'scale-110' : ''}`}
        >
          <span className="h-0.5 w-3 rounded-full bg-white/90" />
        </span>
        {drag && (
          // Beside the handle, so the handle never moves out from under the pointer.
          <span className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-[0_2px_8px_-2px_rgb(0_0_0/0.3)]">
            Space below · {step.label}
          </span>
        )}
      </div>
    </div>
  )
}
