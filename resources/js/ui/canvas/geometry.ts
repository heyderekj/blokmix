import type { VersionNode } from '@/core/types'
import { dfsOrder } from '@/core/versions'
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

export function placeVersions(
  versions: Record<string, VersionNode>,
  viewport: Viewport,
  overrides: Record<string, { x: number; y: number }>,
): FramePlacement[] {
  const w = VIEW_W[viewport]
  const gap = viewport === 'desktop' ? 320 : 160
  const x0 = versionsX0(viewport)
  return dfsOrder(versions).map(({ node, depth }, i) => {
    const o = overrides[node.id]
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
