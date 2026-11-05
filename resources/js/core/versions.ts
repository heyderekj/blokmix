import type { Library, Note, Slot, MixSnapshot, VersionNode } from './types'
import { isEmptyContract } from './contract'
import { stableStringify } from './hash'
import { slotOf } from './notes'

export function letterFor(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

export function nextLetter(versions: Record<string, VersionNode>, parentId: string | null): string {
  const all = Object.values(versions)
  if (!parentId) return letterFor(all.filter((v) => !v.parentId).length)
  const parent = versions[parentId]
  const kids = all.filter((v) => v.parentId === parentId).length
  return `${parent?.letter ?? '?'}.${kids + 1}`
}

/** Depth-first order (A, A.1, A.1.1, A.2, B…), which is also left-to-right canvas order. */
export function dfsOrder(versions: Record<string, VersionNode>): { node: VersionNode; depth: number }[] {
  const all = Object.values(versions).sort((a, b) => a.createdAt - b.createdAt)
  const out: { node: VersionNode; depth: number }[] = []
  const visit = (parentId: string | null, depth: number) => {
    for (const v of all.filter((x) => (x.parentId ?? null) === parentId)) {
      out.push({ node: v, depth })
      visit(v.id, depth + 1)
    }
  }
  visit(null, 0)
  return out
}

export function descendants(versions: Record<string, VersionNode>, id: string): string[] {
  const kids = Object.values(versions).filter((v) => v.parentId === id)
  return kids.flatMap((k) => [k.id, ...descendants(versions, k.id)])
}

export function snapshotKey(s: Pick<MixSnapshot, 'site' | 'guide' | 'content' | 'contract'>): string {
  return stableStringify({ site: s.site, guide: s.guide, content: s.content, contract: isEmptyContract(s.contract) ? null : s.contract })
}

export function slotNotesFor(slots: Slot[], notes: Note[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const n of notes) {
    if (n.kind || n.anchor.kind !== 'slot' || !n.text.trim()) continue
    if (!slots.some((s) => s.id === (n.anchor as { slotId: string }).slotId)) continue
    ;(out[n.anchor.slotId] ??= []).push(n.text.trim())
  }
  return out
}

/** Sticky notes on the canvas but not on a section: they still reach the agent, as general notes. */
export function generalNotesFor(notes: Note[]): string[] {
  return notes.filter((n) => !n.kind && n.anchor.kind === 'world' && n.text.trim()).map((n) => n.text.trim())
}

/** Marks that belong to these sections (or the whole page). */
export function marksFor(slots: Slot[], notes: Note[]): Note[] {
  const ids = new Set(slots.map((s) => s.id))
  return notes.filter((n) => {
    const slot = slotOf(n.anchor)
    return n.kind && (n.anchor.kind === 'page' || (slot !== undefined && ids.has(slot)))
  })
}

/** A short, playful auto-title from the sources used, e.g. "Monolith × Marginalia × Puffin". */
export function autoTitle(slots: Slot[], lib: Library): string {
  const names: string[] = []
  for (const s of slots) {
    const clip = lib.clips[s.clipId]
    const name = clip ? lib.sources[clip.sourceId]?.name.split(' ')[0] : null
    if (name && !names.includes(name)) names.push(name)
  }
  return names.length ? names.join(' × ') : 'Empty mix'
}
