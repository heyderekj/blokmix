import type { BlockEdit } from '../types'
import { describeBlockMotion } from '../motion'
import { MOBILE_MAX } from '../blocks/style'

/** A block's changes in words, for the build notes. */
export function describeEdit(e: BlockEdit): string {
  if (e.hidden) return 'hidden; leave it out'
  const parts: string[] = []
  if (e.variant) parts.push(`${e.variant} look`)
  const m = describeBlockMotion(e.motion)
  if (m) parts.push(m)
  for (const [k, v] of Object.entries(e.style ?? {}) as [string, string | number | undefined][]) if (v !== undefined) parts.push(`${k} ${String(v).replace('x:', 'brand colour ')}`)
  const phone = describeMobile(e.mobile)
  if (phone) parts.push(`on phones (≤${MOBILE_MAX}px): ${phone}`)
  return `${parts.join(', ')} (the section CSS has it in @layer blocks${phone ? `, phones in its @media (max-width: ${MOBILE_MAX}px)` : ''})`
}

function describeMobile(m: BlockEdit['mobile']): string {
  if (!m) return ''
  if (m.hidden) return 'hidden (keep it in the markup and the content file; CSS hides it)'
  return Object.entries(m.style ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')
}
