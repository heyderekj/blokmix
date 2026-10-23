import { useMemo, useState } from 'react'
import { Disc3, Eye, Plus } from 'lucide-react'
import { SECTION_TYPES } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { snapshotKey } from '@/core/versions'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { useResolvedGuide } from '@/state/derived'
import { MIX_ID, VIEW_W } from '../canvas/geometry'
import { FrameHeader, HeaderButton, HeaderTitle } from './FrameHeader'
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

      <AddSection width={W} />
    </div>
  )
}

function AddSection({ width }: { width: number }) {
  const [open, setOpen] = useState(false)
  const st = useStore.getState
  return (
    <div
      className="@container absolute left-0 top-full origin-top-left pt-3"
      style={{ width: `max(calc(${width}px * var(--z)), 48px)`, transform: 'scale(calc(1 / var(--z)))' }}
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
            title="Add a section"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-zinc-400/60 bg-white/60 px-4 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-zinc-500 hover:bg-white active:scale-95 @max-[150px]:px-2.5"
          >
            <Plus size={15} /> <span className="@max-[150px]:hidden">Add a section</span>
          </button>
        )}
      </div>
    </div>
  )
}
