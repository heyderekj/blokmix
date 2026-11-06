import { useEffect, useMemo, useRef, useState } from 'react'
import { MousePointer2 } from 'lucide-react'
import { useStore } from '@/state/store'
import { MixFrame } from '../frames/MixFrame'
import { VersionFrame } from '../frames/VersionFrame'
import { NotesLayer } from '../notes/NotesLayer'
import { MIX_ID, placeDrafts, placeVersions } from './geometry'
import { DraftFrame } from '../frames/DraftFrame'

/** Everything that lives in canvas space. */
export function World() {
  const versions = useStore((s) => s.versions)
  const viewport = useStore((s) => s.ui.viewport)
  const framePos = useStore((s) => s.framePos)
  const drafts = useStore((s) => s.drafts)
  const draftId = useStore((s) => s.draftId)
  const notes = useStore((s) => s.notes)
  const pinned = useStore((s) => s.ui.pinnedVersions)
  const placements = useMemo(
    () => placeVersions({ versions, framePos, drafts, draftId, notes, ui: { viewport, pinnedVersions: pinned } }),
    [versions, viewport, framePos, drafts, draftId, notes, pinned],
  )
  const draftsPlaced = useMemo(() => placeDrafts({ versions, framePos, drafts, draftId, ui: { viewport } }), [versions, framePos, drafts, draftId, viewport])
  return (
    <>
      <Connectors placements={placements} />
      <MixFrame />
      {draftsPlaced.map((p) => (
        <DraftFrame key={p.id} p={p} />
      ))}
      {placements.map((p) => (
        <VersionFrame key={p.id} p={p} />
      ))}
      <NotesLayer placements={placements} />
      <AgentCursor placements={placements} />
    </>
  )
}

function Connectors({ placements }: { placements: ReturnType<typeof placeVersions> }) {
  const byId = new Map(placements.map((p) => [p.id, p]))
  const paths: { d: string; key: string; dashed?: boolean; color?: string }[] = []
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(120, (x2 - x1) * 0.45)
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }
  for (const p of placements) {
    const parent = p.node.parentId ? byId.get(p.node.parentId) : null
    if (!parent) continue
    paths.push({ key: p.id, d: curve(parent.x + parent.w, parent.y - 30, p.x, p.y - 30), color: p.node.kind === 'build' ? 'var(--agent)' : undefined })
  }
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.color ?? 'currentColor'}
          className="text-zinc-400"
          strokeWidth={2}
          strokeDasharray={p.dashed ? '6 6' : undefined}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/** The agent's named cursor: it glides to whatever frame the agent is working on. */
function AgentCursor({ placements }: { placements: ReturnType<typeof placeVersions> }) {
  const agent = useStore((s) => s.agent)
  const target = placements.find((p) => p.id === agent.versionId)
  const parent = target?.node.parentId ? placements.find((p) => p.id === target.node.parentId) : null
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    if (!target) {
      const t = window.setTimeout(() => setPos(null), 1600)
      return () => window.clearTimeout(t)
    }
    if (!pos && parent) setPos({ x: parent.x + parent.w * 0.6, y: parent.y + 200 })
    raf.current = window.setTimeout(() => {
      const wiggle = agent.step % 2 ? 0.62 : 0.38
      setPos({ x: target.x + target.w * wiggle, y: target.y + 160 + agent.step * 140 })
    }, 80)
    return () => window.clearTimeout(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, agent.step])

  if (!pos) return null
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-40"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms', opacity: target ? 1 : 0 }}
    >
      <div className="origin-top-left" style={{ transform: 'scale(calc(1 / var(--z)))' }}>
        <MousePointer2 size={22} fill="var(--agent)" color="white" strokeWidth={1.5} className="drop-shadow" />
        <span className="ml-4 inline-block rounded-full rounded-tl-sm bg-agent px-2 py-0.5 text-[12px] font-semibold text-white shadow-md">
          {agent.name}
        </span>
      </div>
    </div>
  )
}

export { MIX_ID }
