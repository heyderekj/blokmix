import { useMemo, useRef, useState } from 'react'
import { Disc3, Eye, Plus } from 'lucide-react'
import { SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { snapshotKey } from '@/core/versions'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { useResolvedGuide } from '@/state/derived'
import { canvasApi } from '../canvas/Canvas'
import { MIX_ID, VIEW_W } from '../canvas/geometry'
import { FrameHeader, HeaderButton } from './FrameHeader'
import { SlotRow } from './SlotRow'

export function MixFrame() {
  const slots = useStore((s) => s.slots)
  const viewport = useStore((s) => s.ui.viewport)
  const focused = useStore((s) => s.ui.focusedSlotId)
  const selected = useStore((s) => s.ui.selectedFrameId === MIX_ID)
  const previewing = useStore((s) => s.ui.previewFrameId === MIX_ID)
  const head = useStore((s) => (s.head ? s.versions[s.head] : null))
  const branchFrom = useStore((s) => (s.branchFrom ? s.versions[s.branchFrom] : null))
  const guide = useResolvedGuide()
  const W = VIEW_W[viewport]
  const guideState = useStore((s) => s.guide)
  const content = useStore((s) => s.content)
  const dirty = useMemo(
    () => !head || snapshotKey(head.snapshot) !== snapshotKey({ slots, guide: guideState, content }),
    [head, slots, guideState, content],
  )

  // Drag-to-reorder by the grip: rows follow the pointer, then the tape reorders on drop.
  const [drag, setDrag] = useState<{ slotId: string; dy: number } | null>(null)
  const dragRef = useRef<{ slotId: string; startY: number } | null>(null)
  const onDragStart = (slotId: string, e: React.PointerEvent) => {
    dragRef.current = { slotId, startY: e.clientY }
    setDrag({ slotId, dy: 0 })
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return
      setDrag({ slotId, dy: (ev.clientY - dragRef.current.startY) / canvasApi.get().z })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      const dy = (ev.clientY - d.startY) / canvasApi.get().z
      const rows = useLayout.getState().rows
      const st = useStore.getState()
      const me = rows[slotId]
      if (!me) return
      const center = me.top + me.height / 2 + dy
      const others = st.slots.filter((s) => s.id !== slotId)
      let to = others.findIndex((s) => {
        const r = rows[s.id]
        return r && center < r.top + r.height / 2
      })
      if (to < 0) to = others.length
      st.moveSlot(slotId, to)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const st = useStore.getState
  const label = branchFrom ? `Remixing ${branchFrom.letter}` : head ? `From ${head.letter}` : 'New tape'

  return (
    <div
      className="absolute left-0 top-0"
      style={{ width: W }}
      onPointerDown={() => st().setUi({ selectedFrameId: MIX_ID })}
      data-frame={MIX_ID}
    >
      <FrameHeader width={W} selected={selected} tint={undefined}>
        <span className="relative ml-1 grid size-6 place-items-center">
          <Disc3 size={18} className={`text-tape ${dirty ? 'animate-[spin_3s_linear_infinite]' : ''}`} strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="font-semibold text-zinc-900">Working mix</span>
          <span className="truncate text-zinc-500">
            {label}
            {dirty ? ' · edited' : ' · saved'}
          </span>
        </div>
        <HeaderButton
          icon={Eye}
          label={previewing ? 'Stop interacting' : 'Interact with the page'}
          active={previewing}
          onClick={() => st().setUi({ previewFrameId: previewing ? null : MIX_ID })}
        />
      </FrameHeader>

      <div
        className="relative shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)] transition-shadow"
        style={{ background: guide.tokens['color.bg'] }}
      >
        {slots.map((slot, i) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            index={i}
            count={slots.length}
            guide={guide.tokens}
            focused={focused === slot.id}
            onDragStart={onDragStart}
            dragOffset={drag?.slotId === slot.id ? drag.dy : 0}
          />
        ))}
        {!slots.length && (
          <div className="grid place-items-center py-40 text-center" style={{ fontSize: 'calc(16px / var(--z))' }}>
            <p className="text-zinc-400">Your tape is empty. Add a section to start mixing.</p>
          </div>
        )}
      </div>

      <AddSection width={W} />
    </div>
  )
}

function AddSection({ width }: { width: number }) {
  const [open, setOpen] = useState(false)
  const st = useStore.getState
  return (
    <div
      className="absolute left-0 top-full origin-top-left pt-3"
      style={{ width: `calc(${width}px * var(--z))`, transform: 'scale(calc(1 / var(--z)))' }}
      data-chrome
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center">
        {open ? (
          <div className="flex animate-pop flex-wrap items-center gap-1 rounded-2xl border border-zinc-950/10 bg-white p-1.5 shadow-lg">
            {SECTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!library.byType[t].length}
                onClick={() => {
                  st().addSlot(t, undefined, st().slots.length)
                  setOpen(false)
                }}
                className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-95 disabled:opacity-30"
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-zinc-400/60 bg-white/60 px-4 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-zinc-500 hover:bg-white active:scale-95"
          >
            <Plus size={15} /> Add a track
          </button>
        )}
      </div>
    </div>
  )
}
