import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import type { Slot, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'

/** What the focused track's pill unfolds into: where the clip came from, and sending its look to the guide. */
export function TrackDetails({ slot }: { slot: Slot }) {
  const guide = useStore((s) => s.guide)
  const [groups, setGroups] = useState<TokenGroup[]>(['color', 'type'])
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip.sourceId]
  const promoted = new Set(guide.candidates.filter((c) => c.clipId === clip.id).map((c) => c.group))
  const st = useStore.getState
  const k = slot.keep
  const keeping = [k.layout && 'layout', k.style && 'its own style', k.content && 'source copy', k.motion && 'motion'].filter(Boolean).join(', ')
  const using = [!k.style && 'your style guide', !k.content && 'your copy'].filter(Boolean).join(' and ')

  return (
    <div className="w-[380px] space-y-3 px-2.5 pb-2.5 pt-2">
      <div>
        <div className="text-[13.5px] font-semibold leading-snug text-zinc-900">{clip.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-zinc-500">
          {source.name} · <span className="font-mono text-[11px]">{clip.capture.url.replace('https://', '')}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
          <span className="rounded-md bg-chip px-1.5 py-0.5 font-mono text-zinc-600">{clip.layoutPattern}</span>
          <span className="rounded-md bg-chip px-1.5 py-0.5 text-zinc-600">
            Clipped {new Date(clip.capture.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {clip.capture.viewport.width}px
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
          Keeping {keeping || 'nothing but the slot'}
          {using ? `; using ${using}.` : '.'}
          {k.motion && clip.motionNotes ? <span className="text-zinc-500"> {clip.motionNotes}</span> : null}
        </p>
      </div>
      <div className="rounded-xl bg-well p-2.5">
        <div className="mb-2 text-[12px] font-medium text-zinc-700">Send {source.name.split(' ')[0]}’s look to the style guide</div>
        <div className="mb-2.5 flex flex-wrap gap-1">
          {TOKEN_GROUPS.map((g) => {
            const on = groups.includes(g)
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => setGroups((x) => (on ? x.filter((y) => y !== g) : [...x, g]))}
                className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition active:scale-[0.97] ${
                  on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'
                }`}
              >
                <GroupPreview group={g} clipId={clip.id} />
                {GROUP_LABEL[g]}
                {promoted.has(g) && <span className="size-1.5 rounded-full bg-tape" title="Already a candidate" />}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!groups.length}
            onClick={() => {
              st().promoteClip(clip.id, groups)
              st().showFlash(`${source.name} is now a candidate for ${groups.map((g) => GROUP_LABEL[g].toLowerCase()).join(', ')}`, { undo: true })
            }}
            className="btn-quiet flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium"
          >
            <Plus size={14} /> Add as candidate
          </button>
          <button
            type="button"
            disabled={!groups.length}
            onClick={() => {
              st().adoptClipDesign(clip.id, groups)
              st().showFlash(`Style guide now uses ${source.name} for ${groups.map((g) => GROUP_LABEL[g].toLowerCase()).join(', ')}`, { undo: true })
            }}
            className="btn-lit flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold"
          >
            <Sparkles size={14} /> Use these
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupPreview({ group, clipId }: { group: TokenGroup; clipId: string }) {
  const t = library.clips[clipId].tokens
  if (group === 'color')
    return (
      <span className="flex -space-x-1">
        {(['color.bg', 'color.primary', 'color.accent'] as const).map((k) => (
          <span key={k} className="size-3 rounded-full ring-1 ring-zinc-950/15" style={{ background: t[k] }} />
        ))}
      </span>
    )
  if (group === 'type')
    return (
      <span style={{ fontFamily: t['font.display'] }} className="text-[12px] font-bold" title={primaryFamily(t['font.display'])}>
        Aa
      </span>
    )
  if (group === 'shape') return <span className="size-3 border-[1.5px] border-current" style={{ borderRadius: Math.min(6, parseFloat(t['radius.base'])) }} />
  if (group === 'space') return <span className="font-mono text-[10px] opacity-70">{t['space.section']}</span>
  return <span className="font-mono text-[10px] opacity-70">{t['motion.duration']}</span>
}
