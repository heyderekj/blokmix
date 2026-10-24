import type { BlockEdit } from '../types'
import { describeBlockMotion } from '../motion'

/** A block's changes in words, for the build notes. */
export function describeEdit(e: BlockEdit): string {
  if (e.hidden) return 'hidden; leave it out'
  const parts: string[] = []
  if (e.variant) parts.push(`${e.variant} look`)
  const m = describeBlockMotion(e.motion)
  if (m) parts.push(m)
  for (const [k, v] of Object.entries(e.style ?? {}) as [string, string | undefined][]) if (v) parts.push(`${k} ${v.replace('x:', 'brand colour ')}`)
  return `${parts.join(', ')} (the section CSS has it in @layer blocks)`
}
