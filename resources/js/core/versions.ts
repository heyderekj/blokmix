import type { Library, Note, Slot, TapeSnapshot, VersionNode } from './types'
import { stableStringify } from './hash'

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

export function snapshotKey(s: Pick<TapeSnapshot, 'slots' | 'guide' | 'content'>): string {
  return stableStringify({ slots: s.slots, guide: { candidates: s.guide.candidates, choices: s.guide.choices }, content: s.content })
}

export function slotNotesFor(slots: Slot[], notes: Note[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const n of notes) {
    if (n.anchor.kind !== 'slot' || !n.text.trim()) continue
    if (!slots.some((s) => s.id === (n.anchor as { slotId: string }).slotId)) continue
    ;(out[n.anchor.slotId] ??= []).push(n.text.trim())
  }
  return out
}

/** A short, playful auto-title from the sources used, e.g. "Monolith × Marginalia × Puffin". */
export function autoTitle(slots: Slot[], lib: Library): string {
  const names: string[] = []
  for (const s of slots) {
    const clip = lib.clips[s.clipId]
    const name = clip ? lib.sources[clip.sourceId]?.name.split(' ')[0] : null
    if (name && !names.includes(name)) names.push(name)
  }
  return names.length ? names.join(' × ') : 'Empty tape'
}
