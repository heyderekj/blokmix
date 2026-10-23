import { useCallback, useMemo, useState } from 'react'
import { Disc3, Eye, Plus } from 'lucide-react'
import { snapshotKey } from '@/core/versions'
import { useStore } from '@/state/store'
import { useLayout } from '@/state/layout'
import { useResolvedGuide } from '@/state/derived'
import { MIX_ID, VIEW_W } from '../canvas/geometry'
import { FrameHeader, HeaderButton, HeaderTitle } from './FrameHeader'
import { SlotRow } from './SlotRow'
import { AddSectionMenu } from '../shell/AddSection'

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

  const [addAt, setAddAt] = useState<number | null>(null)
  const closeAdd = useCallback(() => setAddAt(null), [])
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
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-key-soft">
          <Disc3 size={18} className={`text-key-ink ${dirty ? 'animate-[spin_3s_linear_infinite]' : ''}`} strokeWidth={2} />
        </span>
        <HeaderTitle title="Working mix" meta={`${label} · ${dirty ? 'edited' : 'saved'} · ${slots.length} sections`} />
        <span className="@max-[220px]:hidden">
        <HeaderButton
          icon={Eye}
          label={previewing ? 'Stop interacting' : 'Interact with the page'}
          active={previewing}
          onClick={() => st().setUi({ previewFrameId: previewing ? null : MIX_ID })}
        />
        </span>
      </FrameHeader>

      <div
        className="frame-r relative shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.06)] transition-shadow"
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
          />
        ))}
        {!slots.length && (
          <div className="grid place-items-center py-40 text-center" style={{ fontSize: 'calc(16px / var(--z))' }}>
            <p className="text-zinc-400">Nothing here yet. Add a section to start mixing.</p>
          </div>
        )}
      </div>

      {!previewing && <Seams onAdd={setAddAt} />}
      {addAt !== null && <AddAt at={addAt} onClose={closeAdd} />}
      <AddSection width={W} onAdd={() => setAddAt(slots.length)} />
    </div>
  )
}

/** The "+" at each gap between sections, in the gutter beside the rail. Opens Add section there. */
function Seams({ onAdd }: { onAdd: (at: number) => void }) {
  const slots = useStore((s) => s.slots)
  const rows = useLayout((s) => s.rows)
  const last = slots.length ? rows[slots[slots.length - 1].id] : undefined
  const ys = slots.map((s) => rows[s.id]?.top)
  if (last) ys.push(last.top + last.height)
  return (
    <>
      {ys.map((y, at) =>
        y === undefined ? null : (
          <div
            key={at}
            className="group/seam absolute right-full z-30"
            style={{ top: y, width: 'calc(40px / var(--z))', height: 'calc(20px / var(--z))', marginTop: 'calc(-10px / var(--z))' }}
            data-chrome
          >
            <button
              type="button"
              title="Add a section here"
              aria-label="Add a section here"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onAdd(at)
              }}
              className="absolute top-1/2 grid size-5 place-items-center rounded-full border border-zinc-950/12 bg-white text-zinc-700 opacity-0 shadow-sm transition-opacity duration-150 hover:text-zinc-950 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 group-hover/seam:opacity-100"
              style={{ right: 'calc(9px / var(--z))', transform: 'translate(50%, -50%) scale(min(calc(1 / var(--z)), 3.4))' }}
            >
              <Plus size={12} strokeWidth={2.6} />
            </button>
          </div>
        ),
      )}
    </>
  )
}

/** The Add section menu, pinned at the gap it was opened from. */
function AddAt({ at, onClose }: { at: number; onClose: () => void }) {
  const slots = useStore((s) => s.slots)
  const rows = useLayout((s) => s.rows)
  const frameH = slots.length ? (rows[slots[slots.length - 1].id]?.top ?? 0) + (rows[slots[slots.length - 1].id]?.height ?? 0) : 0
  const y = at < slots.length ? (rows[slots[at].id]?.top ?? 0) : frameH
  const below = at >= slots.length
  return (
    <div
      className="absolute left-0 z-40 origin-top-left"
      style={{ top: y, transform: `scale(min(calc(1 / var(--z)), 3.4))${below ? ' translateY(56px)' : ''}` }}
    >
      <div className="m-2">
        <AddSectionMenu at={at} onClose={onClose} />
      </div>
    </div>
  )
}

function AddSection({ width, onAdd }: { width: number; onAdd: () => void }) {
  return (
    <div
      className="@container absolute left-0 top-full origin-top-left pt-3"
      style={{ width: `max(calc(${width}px * var(--z)), 48px)`, transform: 'scale(calc(1 / var(--z)))' }}
      data-chrome
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          title="Add a section"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-zinc-400/60 bg-white/60 px-4 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-zinc-500 hover:bg-white active:scale-95 @max-[150px]:px-2.5"
        >
          <Plus size={15} /> <span className="@max-[150px]:hidden">Add a section</span>
        </button>
      </div>
    </div>
  )
}
