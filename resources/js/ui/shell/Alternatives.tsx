import { memo, useMemo } from 'react'
import { Library } from 'lucide-react'
import type { Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { frameStateFor, useResolvedGuide } from '@/state/derived'
import { ClipFrame } from '@/frame/ClipFrame'

const THUMB_W = 168
const SCALE = THUMB_W / 1280

/**
 * The focused track's alternatives, as live thumbnails in your style: the way
 * Figma shows a component's variants. Click one to swap it onto the page.
 */
export function Alternatives({ slot }: { slot: Slot }) {
  const ids = library.byType[slot.type]
  const pos = ids.indexOf(slot.clipId) + 1
  const st = useStore.getState
  return (
    <div className="px-3 pb-2 pt-2.5">
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="text-[13px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
        <span className="text-[12px] tabular-nums text-zinc-500">
          {pos} of {ids.length}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] text-zinc-400">
          <span className="kbd">←</span>
          <span className="kbd">→</span>
        </span>
        <button
          type="button"
          onClick={() => st().setUi({ sheet: 'crate', crateFilter: 'all' })}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-950/5 hover:text-zinc-900"
        >
          <Library size={13} /> All clips
        </button>
      </div>
      <div className="flex gap-2">
        {ids.map((id) => (
          <Thumb key={id} clipId={id} slot={slot} current={id === slot.clipId} />
        ))}
      </div>
    </div>
  )
}

const Thumb = memo(function Thumb({ clipId, slot, current }: { clipId: string; slot: Slot; current: boolean }) {
  const clip = library.clips[clipId]
  const source = library.sources[clip.sourceId]
  const mode = useStore((s) => s.ui.mode)
  const content = useStore((s) => s.content)
  const guide = useResolvedGuide()
  const state = useMemo(() => frameStateFor(clip, slot, mode, guide.tokens, content, 'desktop'), [clip, slot, mode, guide.tokens, content])
  return (
    <button
      type="button"
      onClick={() => useStore.getState().setClip(slot.id, clipId)}
      className="group shrink-0 text-left"
      title={`${source.name}: ${clip.title}`}
      aria-pressed={current}
    >
      <div
        className={`relative overflow-hidden rounded-lg ring-2 transition ${current ? 'ring-tape' : 'ring-zinc-950/8 group-hover:ring-zinc-950/25'}`}
        style={{ width: THUMB_W, height: THUMB_W * 0.56 }}
      >
        <div className="pointer-events-none origin-top-left" style={{ transform: `scale(${SCALE})`, width: 1280 }}>
          <ClipFrame clip={clip} width={1280} state={state} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
        <span className={`truncate text-[12px] ${current ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'}`}>{source.name}</span>
        {current && <span className="size-1.5 shrink-0 rounded-full bg-tape" />}
      </div>
    </button>
  )
})
