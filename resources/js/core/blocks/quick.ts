// What you change most about a kind of thing, shown on it: the block bar draws these, in this order, and the Style
// panel (on ask) has the rest. The same list tells agents what's worth offering (get_options). Pure.

import type { BlockInfo, BlockStyle } from '../types'
import { variantsFor } from './variants'
import { attr, parseHtml, type HEl, type HNode } from '../html/parse'

export const QUICK = ['look', 'words', 'link', 'picture', 'icon', 'color', 'size', 'align', 'shape', 'fill', 'padding', 'columns', 'direction', 'gap', 'add'] as const
export type Quick = (typeof QUICK)[number]

type Info = Pick<BlockInfo, 'kind' | 'role' | 'grid' | 'field' | 'linkable' | 'list'>

/** The few things you change most about this block, in the order the bar shows them. */
export function quickOptions(b: Info): Quick[] {
  const look: Quick[] = variantsFor(b.kind).length ? ['look'] : []
  const words: Quick[] = b.field ? ['words'] : []
  const link: Quick[] = b.linkable ? ['link'] : []
  switch (b.kind) {
    case 'button':
      return [...look, 'color', 'size', ...words, ...link]
    case 'link':
      return [...look, 'size', ...words, ...link]
    case 'badge':
      return [...look, 'color', ...words, ...link]
    case 'heading':
      return [...look, 'size', 'align', ...words, ...link]
    case 'text':
      return [...look, 'size', 'align', ...words, ...link]
    case 'icon':
      return ['icon', 'color', ...link]
    case 'image':
      return ['picture', 'shape', ...link]
    case 'input':
      return [...look, ...words]
    case 'card':
    case 'item':
      return [...look, 'fill', 'padding', 'align', ...link]
    case 'list':
      return [...(b.grid ? (['columns'] as Quick[]) : []), 'gap', 'add']
    case 'banner':
      return [...look, 'fill']
    case 'group':
      if (b.role === 'buttons') return ['direction', 'align', 'gap']
      if (b.role === 'header') return ['align', 'gap']
      return ['fill', 'padding', 'align']
  }
}

/** Which of the Style panel's color, shape and spacing rows mean anything for this block (fill on a list does nothing). */
export type StyleRow = keyof Pick<BlockStyle, 'fill' | 'ink' | 'radius' | 'shadow' | 'padding' | 'above' | 'below' | 'gap'>

export function styleRows(b: Info): StyleRow[] {
  const spacing: StyleRow[] = ['above', 'below']
  switch (b.kind) {
    case 'list':
      return [...spacing, 'gap']
    case 'heading':
    case 'text':
      return ['ink', ...spacing]
    case 'icon':
      return ['ink', ...spacing]
    case 'image':
      return ['radius', 'shadow', ...spacing]
    case 'group':
      if (b.role === 'buttons' || b.role === 'header') return ['ink', ...spacing, 'gap']
      return ['fill', 'ink', 'radius', 'shadow', 'padding', ...spacing, 'gap']
    case 'card':
    case 'item':
    case 'banner':
      return ['fill', 'ink', 'radius', 'shadow', 'padding', ...spacing, 'gap']
    default:
      return ['fill', 'ink', 'radius', 'shadow', 'padding', ...spacing]
  }
}

/** How many across a grid list shows as the layout made it (its first item's `col-N` on the 12-column rail). */
export function columnsOf(html: string, listId: string): number | undefined {
  let found: number | undefined
  const visit = (nodes: HNode[]) => {
    for (const n of nodes) {
      if (found !== undefined || n.t !== 'el') continue
      if (attr(n, 'data-mx-b') === listId) {
        const first = n.kids.find((k): k is HEl => k.t === 'el')
        const span = Number((attr(first ?? n, 'class') ?? '').match(/(?:^|\s)col-(\d+)(?:\s|$)/)?.[1])
        found = span ? Math.max(1, Math.round(12 / span)) : 0
        return
      }
      visit(n.kids)
    }
  }
  visit(parseHtml(html))
  return found || undefined
}
