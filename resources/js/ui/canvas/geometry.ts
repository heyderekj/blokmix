import type { VersionNode } from '@/core/types'
import { dfsOrder } from '@/core/versions'
import { draftList, type Draft } from '@/core/drafts'
import type { Viewport } from '@/state/store'

export const VIEW_W: Record<Viewport, number> = { desktop: 1280, mobile: 390 }

export const MIX_ID = 'mix'

export function versionsX0(v: Viewport) {
  return VIEW_W[v] + (v === 'desktop' ? 480 : 220)
}

export interface FramePlacement {
  id: string
  node: VersionNode
  depth: number
  x: number
  y: number
  w: number
}

/** What placing frames reads from the store. */
export interface FrameState {
  versions: Record<string, VersionNode>
  framePos: Record<string, { x: number; y: number }>
  drafts?: Record<string, Draft>
  draftId?: string
  notes?: { anchor: { kind: string; frameId?: string; versionId?: string } }[]
  ui: { viewport: Viewport; pinnedVersions?: string[] }
}

export interface DraftPlacement {
  id: string
  draft: Draft
  x: number
  y: number
  w: number
}

const gapFor = (v: Viewport) => (v === 'desktop' ? 320 : 160)

/** The drafts you're not in, side by side to the right of the open one (which is the mix at the origin), A, B, C. */
export function placeDrafts(st: FrameState): DraftPlacement[] {
  const w = VIEW_W[st.ui.viewport]
  const x0 = versionsX0(st.ui.viewport)
  return draftList(st.drafts ?? {})
    .filter((d) => d.id !== st.draftId && d.body)
    .map((draft, i) => ({ id: draft.id, draft, x: x0 + i * (w + gapFor(st.ui.viewport)), y: 0, w }))
}

/**
 * Version frames on the canvas: builds (they have a live preview and an agent at work), the versions you chose to show,
 * and any with notes on them. They sit in a lane after the drafts. A version's place is otherwise its draft's history.
 */
export function placeVersions(st: FrameState): FramePlacement[] {
  const w = VIEW_W[st.ui.viewport]
  const gap = gapFor(st.ui.viewport)
  const drafts = placeDrafts(st).length
  const x0 = versionsX0(st.ui.viewport) + drafts * (w + gap)
  const pinned = new Set(st.ui.pinnedVersions ?? [])
  const noted = new Set((st.notes ?? []).flatMap((n) => (n.anchor.kind === 'frame' ? [n.anchor.frameId] : n.anchor.kind === 'preview' ? [n.anchor.versionId] : [])))
  const shown = Object.fromEntries(Object.entries(st.versions).filter(([id, v]) => v.kind === 'build' || pinned.has(id) || noted.has(id)))
  return dfsOrder(shown).map(({ node, depth }, i) => {
    const o = st.framePos[node.id]
    return { id: node.id, node, depth, x: o?.x ?? x0 + i * (w + gap), y: o?.y ?? depth * 280, w }
  })
}

export interface Camera {
  x: number
  y: number
  z: number
}

export const MIN_Z = 0.04
export const MAX_Z = 2

export function clampZ(z: number) {
  return Math.min(MAX_Z, Math.max(MIN_Z, z))
}

export function zoomAt(c: Camera, sx: number, sy: number, nz: number): Camera {
  const z = clampZ(nz)
  const wx = (sx - c.x) / c.z
  const wy = (sy - c.y) / c.z
  return { x: sx - wx * z, y: sy - wy * z, z }
}

export function fitRect(
  rect: { x: number; y: number; w: number; h: number },
  view: { w: number; h: number; left: number; right: number; top: number; bottom: number },
  maxZ = 0.6,
): Camera {
  const availW = view.w - view.left - view.right
  const availH = view.h - view.top - view.bottom
  const z = clampZ(Math.min(availW / rect.w, availH / rect.h, maxZ))
  return {
    z,
    x: view.left + (availW - rect.w * z) / 2 - rect.x * z,
    y: view.top + Math.max(0, (availH - rect.h * z) / 2) - rect.y * z,
  }
}
