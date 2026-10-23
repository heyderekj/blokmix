// A section's words as content: its fields and lists in page order, the way
// the Content view reads them and the way they're written to
// src/content/<section>.json. Lists become arrays; an item with one field
// becomes a string ("logos": ["Northwind", …]).

import { attr, type HEl, type HNode } from './html/parse'
import { itemsOf, listKeyOf, numberOf, ownFields } from './lists'

export type OutlineNode = OutlineField | OutlineList

export interface OutlineField {
  t: 'field'
  /** The field in the clip (f4Title). */
  field: string
  /** Its key in the content file: the field outside lists, the rest of it inside an item (title). */
  key: string
}

export interface OutlineList {
  t: 'list'
  /** Block id of the list. */
  id: string
  /** Its key in the content file (features, plans). */
  key: string
  /** What its fields are numbered by (f). */
  listKey: string
  items: OutlineItem[]
}

export interface OutlineItem {
  id: string
  n: number
  nodes: OutlineNode[]
  /** One field and nothing else: written as a plain string. */
  plain: boolean
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

/** Fields and lists in document order. Mirrors (marquee copies) and fixed lists' fields stay flat. */
export function outline(tree: HNode[]): OutlineNode[] {
  const visit = (nodes: HNode[], prefix: string | null, out: OutlineNode[], seen: Set<string>) => {
    for (const n of nodes) {
      if (n.t !== 'el') continue
      const key = attr(n, 'data-mx-block') === 'list' ? listKeyOf(n) : null
      if (key && itemsOf(n).every((it) => numberOf(it, key) != null)) {
        out.push(list(n, key, prefix, seen))
        // Anything else inside the list (a brand card beside footer columns) reads at this level.
        visit(n.kids.filter((k) => k.t === 'el' && attr(k, 'data-mx-block') !== 'item'), prefix, out, seen)
        continue
      }
      const f = attr(n, 'data-mx-field')
      if (f && !seen.has(f)) {
        seen.add(f)
        out.push({ t: 'field', field: f, key: prefix ? lowerFirst(f.slice(prefix.length)) || 'text' : f })
      }
      visit(n.kids, prefix, out, seen)
    }
  }
  const list = (el: HEl, key: string, prefix: string | null, seen: Set<string>): OutlineList => {
    const name = attr(el, 'data-mx-list') ?? 'items'
    const items = itemsOf(el).map((it): OutlineItem => {
      const n = numberOf(it, key)!
      const nodes: OutlineNode[] = []
      visit([it], `${key}${n}`, nodes, seen)
      const plain = nodes.length === 1 && nodes[0].t === 'field' && ownFields(it).length === 1 && nodes[0].field === `${key}${n}`
      return { id: attr(it, 'data-mx-b') ?? '', n, nodes, plain }
    })
    return { t: 'list', id: attr(el, 'data-mx-b') ?? '', key: prefix ? lowerFirst(name) : name, listKey: key, items }
  }
  const out: OutlineNode[] = []
  visit(tree, null, out, new Set())
  return dedupeKeys(out)
}

/** Two lists (or a list and a field) with the same key at one level: number the later ones. */
function dedupeKeys(nodes: OutlineNode[]): OutlineNode[] {
  const used = new Map<string, number>()
  return nodes.map((n) => {
    const c = (used.get(n.key) ?? 0) + 1
    used.set(n.key, c)
    const key = c > 1 ? `${n.key}${c}` : n.key
    return n.t === 'list' ? { ...n, key, items: n.items.map((it) => ({ ...it, nodes: dedupeKeys(it.nodes) })) } : { ...n, key }
  })
}

export type ContentValue = string | ContentValue[] | { [k: string]: ContentValue }

/** The section's content file: its words, with lists as arrays. */
export function contentJson(nodes: OutlineNode[], fields: Record<string, string>): Record<string, ContentValue> {
  const obj: Record<string, ContentValue> = {}
  for (const n of nodes) {
    if (n.t === 'field') obj[n.key] = fields[n.field] ?? ''
    else obj[n.key] = n.items.map((it) => (it.plain ? fields[(it.nodes[0] as OutlineField).field] ?? '' : contentJson(it.nodes, fields)))
  }
  return obj
}

/** Where each field lives in the content file, as a JSON pointer: heading → "heading", f2Title → "features/1/title". */
export function fieldPointers(nodes: OutlineNode[], base = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of nodes) {
    if (n.t === 'field') out[n.field] = `${base}${n.key}`
    else
      n.items.forEach((it, i) => {
        if (it.plain) out[(it.nodes[0] as OutlineField).field] = `${base}${n.key}/${i}`
        else Object.assign(out, fieldPointers(it.nodes, `${base}${n.key}/${i}/`))
      })
  }
  return out
}
