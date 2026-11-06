import type { BlockEdit, Clip, ListBinding, ListItemRef, MediaFill, Slot } from './types'
import { parseHtml } from './html/parse'
import { outline, type OutlineField, type OutlineList, type OutlineNode } from './outline'
import { layoutOrder, listMax, sectionClip, type SectionClip, extrasOf } from './lists'

/**
 * Collections: your content as entries with a schema, apart from any section (blog posts, team members, products),
 * the way Astro content collections and Sanity hold it. A schema starts from the section that first used it (its
 * list's item fields) and stays editable. Sections bind a list to a collection: the list shows one item per entry,
 * derived on the fly (`applyBindings`), never written back into the section. Pure, so the store, commands, frames
 * and exporters share it.
 */

export const FIELD_TYPES = ['text', 'longText', 'markdown', 'image', 'date', 'number', 'url', 'select', 'reference', 'list'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  longText: 'Long text',
  markdown: 'Rich text',
  image: 'Image',
  date: 'Date',
  number: 'Number',
  url: 'Link',
  select: 'Choice',
  reference: 'Reference',
  list: 'List',
}

export interface CollectionField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  /** select: the choices. */
  options?: string[]
  /** reference: the collection (by slug) it points to. */
  to?: string
}

export interface CollectionSchema {
  fields: CollectionField[]
  /** The field that names an entry (and its slug starts from). */
  titleField: string
}

/** A picture in an entry: the same fills an image block takes (an upload, a stock photo, a placeholder). */
export type MediaRef = Pick<MediaFill, 'source' | 'asset' | 'stock' | 'style' | 'seed' | 'alt'>
export type EntryValue = string | number | string[] | MediaRef | null

export interface Entry {
  id: string
  slug: string
  draft?: boolean
  /** Position in the collection's own order (lists sort by it unless told otherwise). */
  order: number
  data: Record<string, EntryValue>
  updatedAt: number
}

export interface Collection {
  id: string
  /** Its name in files and bindings: blog-posts → src/content/blog-posts/. */
  slug: string
  name: string
  schema: CollectionSchema
  entries: Entry[]
  /** Optimistic lock for saving to the server (as mixes have). */
  lock?: number
}

export class CollectionError extends Error {}

// ---------- names ----------

export function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'entry'
  )
}

/** A slug nobody in `taken` has yet: launch, launch-2, launch-3… */
export function uniqueSlug(want: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = slugify(want)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

const fieldKey = (label: string) => {
  const words = label.trim().replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('') || 'field'
}
const labelOf = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

export function entryTitle(c: Collection, e: Entry): string {
  const v = e.data[c.schema.titleField]
  return typeof v === 'string' && v.trim() ? v : e.slug
}

// ---------- values ----------

const isMedia = (v: EntryValue): v is MediaRef => !!v && typeof v === 'object' && !Array.isArray(v)
const DATE_RE = /^\d{4}-\d{2}-\d{2}/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Markdown down to its words, for places that show one line (a card's excerpt). */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** An entry's value as the words a section shows. */
export function displayValue(field: CollectionField | undefined, v: EntryValue): string {
  if (v == null || isMedia(v)) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'number') return String(v)
  if (field?.type === 'markdown') return plainText(v)
  if (field?.type === 'date' && DATE_RE.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number)
    return `${MONTHS[m - 1]} ${d}, ${y}`
  }
  return v
}

/**
 * An entry's value at a path: a field key, or `body#2` for a rich-text field's second paragraph (how a prose
 * section's paragraphs show an article).
 */
export function entryValue(c: Collection | undefined, e: Entry, path: string): string {
  const [key, nth] = path.split('#')
  const field = c?.schema.fields.find((f) => f.key === key)
  const v = e.data[key] ?? null
  if (!nth) return displayValue(field, v)
  const paras = typeof v === 'string' ? v.split(/\n\s*\n/).map(plainText).filter(Boolean) : []
  return paras[Number(nth) - 1] ?? ''
}

/** Convert a value to another field type, keeping what can be kept (text ↔ long text, text → date when it parses). */
export function convertValue(v: EntryValue, to: FieldType): EntryValue {
  if (v == null) return null
  if (to === 'image') return isMedia(v) ? v : null
  if (isMedia(v)) return null
  if (to === 'list') return Array.isArray(v) ? v : String(v).split(/\s*[,\n]\s*/).filter(Boolean)
  const s = Array.isArray(v) ? v.join(', ') : String(v)
  if (to === 'number') {
    const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  if (to === 'date') {
    if (DATE_RE.test(s)) return s.slice(0, 10)
    const t = Date.parse(s)
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : s
  }
  return s
}

// ---------- inferring a schema from a section's list ----------

const TYPE_HINTS: [RegExp, FieldType][] = [
  [/^(cover|image|photo|picture|avatar|logo|thumb|media)/i, 'image'],
  [/^(date|published|when)$/i, 'date'],
  [/(excerpt|body|desc|description|quote|bio|answer|^a$|summary|text)$/i, 'longText'],
  [/(url|href|link)$/i, 'url'],
]

function guessType(key: string, sample: string): FieldType {
  for (const [re, t] of TYPE_HINTS) if (re.test(key)) return t
  if (DATE_RE.test(sample)) return 'date'
  if (sample.length > 90) return 'longText'
  return 'text'
}

/** Image blocks inside an item, in order (an item's cover, a member's photo, a quote's avatar). */
function itemImages(clip: SectionClip, itemId: string): string[] {
  const under = (id: string): string[] => clip.blocks.filter((b) => b.parent === id).flatMap((b) => [b.id, ...under(b.id)])
  return under(itemId).filter((id) => clip.blocks.find((b) => b.id === id)?.kind === 'image')
}

export function findList(nodes: OutlineNode[], listKey: string): OutlineList | undefined {
  for (const n of nodes) {
    if (n.t !== 'list') continue
    if (n.listKey === listKey) return n
    for (const it of n.items) {
      const inner = findList(it.nodes, listKey)
      if (inner) return inner
    }
  }
  return undefined
}

/**
 * A schema from a list's items: each item field becomes a field (key as in the content file: title, excerpt), typed
 * by its name and words; a nested list of words (a plan's features) becomes a list; a picture in the item, an image.
 */
export function inferSchema(clip: SectionClip, list: OutlineList, fields: Record<string, string>): CollectionSchema {
  const first = list.items[0]
  if (!first) throw new CollectionError('This list has no items to learn from.')
  const out: CollectionField[] = []
  const add = (key: string, type: FieldType) => {
    if (!out.some((f) => f.key === key)) out.push({ key, label: labelOf(key), type })
  }
  if (first.plain) add('name', 'text')
  else
    for (const node of first.nodes) {
      if (node.t === 'field') add(node.key, guessType(node.key, fields[node.field] ?? ''))
      else add(node.key, 'list')
    }
  if (itemImages(clip, first.id).length) add(out.some((f) => f.type === 'image') ? 'image2' : imageKey(clip, first.id, list.listKey, first.n), 'image')
  const titleField = out.find((f) => /^(title|name|q|heading|label)$/i.test(f.key))?.key ?? out.find((f) => f.type === 'text')?.key ?? out[0].key
  const title = out.find((f) => f.key === titleField)!
  title.required = true
  return { fields: out, titleField }
}

/** A picture's key from its media name: p1Cover → cover, m2Photo → photo, avatar1 → avatar. */
function imageKey(clip: SectionClip, itemId: string, listKey: string, n: number): string {
  const media = clip.blocks.find((b) => b.id === itemImages(clip, itemId)[0])?.media ?? ''
  const rest = media.startsWith(`${listKey}${n}`) ? media.slice(`${listKey}${n}`.length) : media.replace(/\d+$/, '')
  return rest ? rest[0].toLowerCase() + rest.slice(1) : 'image'
}

/** The words (and pictures) a list shows now, as entries: how "Make a collection from these items" starts one. */
export function entriesFromList(
  clip: SectionClip,
  list: OutlineList,
  fields: Record<string, string>,
  edits: Record<string, BlockEdit> | undefined,
  schema: CollectionSchema,
  now = Date.now(),
): Entry[] {
  const image = schema.fields.find((f) => f.type === 'image')
  const taken: string[] = []
  return list.items.map((item, i): Entry => {
    const data: Record<string, EntryValue> = {}
    if (item.plain) data[schema.fields[0].key] = fields[(item.nodes[0] as OutlineField).field] ?? ''
    for (const node of item.nodes) {
      if (node.t === 'field' && !item.plain) data[node.key] = convertValue(fields[node.field] ?? '', schema.fields.find((f) => f.key === node.key)?.type ?? 'text')
      if (node.t === 'list') data[node.key] = node.items.map((it) => (it.nodes[0]?.t === 'field' ? fields[(it.nodes[0] as OutlineField).field] ?? '' : '')).filter(Boolean)
    }
    if (image) {
      const block = itemImages(clip, item.id)[0]
      const fill = block ? edits?.[block]?.media : undefined
      data[image.key] = fill && (fill.source === 'upload' || fill.source === 'stock' || fill.source === 'placeholder') ? pickMedia(fill) : null
    }
    const title = data[schema.titleField]
    const slug = uniqueSlug(typeof title === 'string' && title ? title : `entry-${i + 1}`, taken)
    taken.push(slug)
    return { id: entryId(now, i), slug, order: i, data, updatedAt: now }
  })
}

const pickMedia = (m: MediaFill): MediaRef => {
  const out: MediaRef = { source: m.source }
  if (m.asset) out.asset = m.asset
  if (m.stock) out.stock = m.stock
  if (m.style) out.style = m.style
  if (m.seed != null) out.seed = m.seed
  if (m.alt) out.alt = m.alt
  return out
}

export const entryId = (now: number, i = 0) => `e_${(now + i).toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ---------- editing a collection (pure; the store keeps the history) ----------

export function addField(c: Collection, label: string, type: FieldType): Collection {
  const key = uniqueKey(fieldKey(label), c.schema.fields.map((f) => f.key))
  return { ...c, schema: { ...c.schema, fields: [...c.schema.fields, { key, label: label.trim() || labelOf(key), type }] } }
}

export function renameField(c: Collection, key: string, label: string): Collection {
  const f = c.schema.fields.find((x) => x.key === key)
  if (!f) throw new CollectionError(`No field “${key}”.`)
  const next = uniqueKey(fieldKey(label), c.schema.fields.filter((x) => x.key !== key).map((x) => x.key))
  return {
    ...c,
    schema: { fields: c.schema.fields.map((x) => (x.key === key ? { ...x, key: next, label: label.trim() } : x)), titleField: c.schema.titleField === key ? next : c.schema.titleField },
    entries: c.entries.map((e) => (key in e.data ? { ...e, data: renameKey(e.data, key, next) } : e)),
  }
}

export function retypeField(c: Collection, key: string, type: FieldType): Collection {
  if (!c.schema.fields.some((x) => x.key === key)) throw new CollectionError(`No field “${key}”.`)
  return {
    ...c,
    schema: { ...c.schema, fields: c.schema.fields.map((x) => (x.key === key ? { ...x, type } : x)) },
    entries: c.entries.map((e) => (key in e.data ? { ...e, data: { ...e.data, [key]: convertValue(e.data[key], type) } } : e)),
  }
}

export function removeField(c: Collection, key: string): Collection {
  if (key === c.schema.titleField) throw new CollectionError('The title field names each entry; rename it instead of removing it.')
  return {
    ...c,
    schema: { ...c.schema, fields: c.schema.fields.filter((x) => x.key !== key) },
    entries: c.entries.map((e) => {
      const { [key]: _gone, ...data } = e.data
      return { ...e, data }
    }),
  }
}

/** How many entries hold a value a retype would change (for "12 entries will convert"). */
export function retypeImpact(c: Collection, key: string, type: FieldType): number {
  return c.entries.filter((e) => e.data[key] != null && JSON.stringify(convertValue(e.data[key], type)) !== JSON.stringify(e.data[key])).length
}

export function addEntry(c: Collection, data: Record<string, EntryValue>, now = Date.now()): { collection: Collection; entry: Entry } {
  const title = data[c.schema.titleField]
  const entry: Entry = {
    id: entryId(now),
    slug: uniqueSlug(typeof title === 'string' && title ? title : 'entry', c.entries.map((e) => e.slug)),
    order: c.entries.length ? Math.max(...c.entries.map((e) => e.order)) + 1 : 0,
    data: cleanData(c, data),
    updatedAt: now,
  }
  return { collection: { ...c, entries: [...c.entries, entry] }, entry }
}

export function updateEntry(c: Collection, id: string, patch: { data?: Record<string, EntryValue>; slug?: string; draft?: boolean }, now = Date.now()): Collection {
  const e = c.entries.find((x) => x.id === id || x.slug === id)
  if (!e) throw new CollectionError(`No entry “${id}” in ${c.name}.`)
  const slug = patch.slug ? uniqueSlug(patch.slug, c.entries.filter((x) => x !== e).map((x) => x.slug)) : e.slug
  const next: Entry = { ...e, slug, draft: patch.draft ?? e.draft, data: patch.data ? { ...e.data, ...cleanData(c, patch.data) } : e.data, updatedAt: now }
  return { ...c, entries: c.entries.map((x) => (x === e ? next : x)) }
}

export function removeEntry(c: Collection, id: string): Collection {
  if (!c.entries.some((x) => x.id === id || x.slug === id)) throw new CollectionError(`No entry “${id}” in ${c.name}.`)
  return { ...c, entries: c.entries.filter((x) => x.id !== id && x.slug !== id) }
}

/** Put entries in this order (ids or slugs); any not named keep their place after them. */
export function reorderEntries(c: Collection, ids: string[]): Collection {
  const named = ids.map((id) => c.entries.find((e) => e.id === id || e.slug === id)).filter((e): e is Entry => !!e)
  const rest = sortedEntries(c).filter((e) => !named.includes(e))
  const order = new Map([...named, ...rest].map((e, i) => [e.id, i]))
  return { ...c, entries: c.entries.map((e) => ({ ...e, order: order.get(e.id)! })) }
}

/** Only the schema's fields, each converted to its type. */
function cleanData(c: Collection, data: Record<string, EntryValue>): Record<string, EntryValue> {
  const out: Record<string, EntryValue> = {}
  for (const [k, v] of Object.entries(data)) {
    const f = c.schema.fields.find((x) => x.key === k)
    if (!f) throw new CollectionError(`${c.name} has no field “${k}”. Its fields: ${c.schema.fields.map((x) => x.key).join(', ')}.`)
    out[k] = convertValue(v, f.type)
  }
  return out
}

const uniqueKey = (want: string, taken: string[]) => {
  if (!taken.includes(want)) return want
  for (let n = 2; ; n++) if (!taken.includes(`${want}${n}`)) return `${want}${n}`
}
const renameKey = (o: Record<string, EntryValue>, from: string, to: string) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k === from ? to : k, v]))

export const sortedEntries = (c: Collection) => [...c.entries].sort((a, b) => a.order - b.order)

/** The entries a binding shows, in its order: drafts left out, filtered, sorted, capped. */
export function boundEntries(c: Collection, b: Pick<ListBinding, 'sort' | 'filter' | 'limit'>, cap = Infinity): Entry[] {
  let list = sortedEntries(c).filter((e) => !e.draft)
  if (b.filter) list = list.filter((e) => displayValue(undefined, e.data[b.filter!.field] ?? null).toLowerCase() === b.filter!.equals.toLowerCase())
  if (b.sort) {
    const { field, dir } = b.sort
    list.sort((x, y) => {
      const a = x.data[field] ?? ''
      const z = y.data[field] ?? ''
      const cmp = typeof a === 'number' && typeof z === 'number' ? a - z : String(a).localeCompare(String(z), undefined, { numeric: true })
      return dir === 'desc' ? -cmp : cmp
    })
  }
  return list.slice(0, Math.min(b.limit ?? Infinity, cap))
}

/** Map a list's item keys to a collection's fields by name, then by type (title→title, excerpt→a long text…). */
export function autoMap(list: OutlineList, schema: CollectionSchema): { map: Record<string, string>; image?: string } {
  const first = list.items[0]
  const keys = first ? (first.plain ? ['text'] : first.nodes.map((n) => n.key)) : []
  const map: Record<string, string> = {}
  const used = new Set<string>()
  for (const k of keys) {
    const hit = schema.fields.find((f) => f.key.toLowerCase() === k.toLowerCase() && f.type !== 'image')
    if (hit) {
      map[k] = hit.key
      used.add(hit.key)
    }
  }
  for (const k of keys) {
    if (map[k]) continue
    const want: FieldType[] = k === 'text' ? ['text'] : /excerpt|body|desc|quote|a$/i.test(k) ? ['longText', 'markdown'] : ['text']
    const hit = schema.fields.find((f) => !used.has(f.key) && want.includes(f.type)) ?? (k === 'text' ? schema.fields.find((f) => f.key === schema.titleField) : undefined)
    if (hit) {
      map[k] = hit.key
      used.add(hit.key)
    }
  }
  return { map, image: schema.fields.find((f) => f.type === 'image')?.key }
}

// ---------- applying bindings: the section as its collections fill it ----------

export interface BindContext {
  collections: Record<string, Collection>
  /** On a template page: the entry it previews. */
  entry?: { collection: string; entry: Entry } | null
  /** Where an entry's own page is, when its collection has a template page (/blog/launch-week). */
  entryPath?: (collection: string, slug: string) => string | null
}

/**
 * The slot with its bound lists filled from entries (lists, words, pictures, each item's link to its entry's page)
 * and, on a template page, its bound fields from the page's entry. Derived only: the section keeps its own words for
 * when it's unbound.
 */
/** Which entry (and field) a bound section's field shows, and which entry each bound list item is. */
export interface BindTargets {
  fields: Map<string, { collection: string; entry: string; field: string }>
  /** List key → the entries its items show, in item order. */
  items: Map<string, { collection: string; entries: string[]; sorted: boolean }>
}

export function applyBindings(slot: Slot, clip: Clip, ctx: BindContext, targets?: BindTargets): Slot {
  const bind = slot.bind
  if (!bind || (!bind.lists && !bind.entry)) return slot
  let lists = { ...slot.lists }
  const words: Record<string, string> = { ...slot.words }
  const forClip: Record<string, BlockEdit> = { ...slot.edits?.[clip.id] }
  const base = sectionClip(clip, slot.lists, extrasOf(slot, clip.id))
  const tree = outline(parseHtml(base.html))

  for (const [key, b] of Object.entries(bind.lists ?? {})) {
    const c = ctx.collections[b.collection]
    const list = findList(tree, key)
    const listBlock = base.blocks.find((x) => x.kind === 'list' && x.listKey === key)
    if (!c || !list || !listBlock || !list.items.length) continue
    const own = layoutOrder(base, slot, listBlock.id, key)
    const entries = boundEntries(c, b, listMax(listBlock.list, key, own.length))
    // Item numbers: the layout's own first, then new ones copied from the first item.
    const tpl = list.items[0]
    const top = Math.max(...own, ...list.items.map((i) => i.n))
    const refs: ListItemRef[] = entries.map((_, i) => (i < own.length ? { n: own[i] } : { n: top + i - own.length + 1, from: tpl.n }))
    if (!refs.length) refs.push({ n: own[0] ?? tpl.n }) // a list keeps one item; it shows the layout's own words
    lists[key] = refs
    targets?.items.set(key, { collection: c.slug, entries: entries.map((e) => e.id), sorted: !!b.sort })
    // Field suffixes from the template item: title → "Title" in p1Title.
    const suffix = (k: string) => {
      const node = tpl.plain ? (tpl.nodes[0] as OutlineField) : tpl.nodes.find((n) => n.key === k)
      return node?.t === 'field' ? node.field.slice(`${key}${tpl.n}`.length) : node?.t === 'list' ? node.listKey.slice(`${key}${tpl.n}`.length) : null
    }
    entries.forEach((e, i) => {
      const n = refs[i].n
      for (const [itemKey, fk] of Object.entries(b.map)) {
        const field = c.schema.fields.find((f) => f.key === fk)
        const sfx = suffix(itemKey)
        if (sfx == null) continue
        const v = e.data[fk] ?? null
        const node = tpl.plain ? null : tpl.nodes.find((x) => x.key === itemKey)
        if (node?.t === 'list') {
          // A nested list of words (a plan's features): one item per value.
          const items = Array.isArray(v) ? v : v == null ? [] : [displayValue(field, v)]
          const nestedKey = `${key}${n}${sfx}`
          const innerTpl = node.items[0]
          if (!innerTpl) continue
          const innerOwn = node.items.map((it) => it.n)
          lists[nestedKey] = items.length ? items.map((_, j) => (j < innerOwn.length ? { n: innerOwn[j] } : { n: Math.max(...innerOwn) + j - innerOwn.length + 1, from: innerTpl.n })) : [{ n: innerOwn[0] }]
          items.forEach((text, j) => {
            const m = lists[nestedKey][j].n
            words[`${nestedKey}${m}`] = text
          })
        } else {
          words[`${key}${n}${sfx}`] = displayValue(field, v)
          targets?.fields.set(`${key}${n}${sfx}`, { collection: c.slug, entry: e.id, field: fk })
        }
      }
    })
    // Pictures and links need the items as they'll be drawn (copied items get new block ids).
    const drawn = sectionClip(clip, lists, extrasOf(slot, clip.id))
    const drawnList = drawn.blocks.find((x) => x.kind === 'list' && x.listKey === key)
    entries.forEach((e, i) => {
      const item = drawn.blocks.find((x) => x.kind === 'item' && x.parent === drawnList?.id && x.n === refs[i].n)
      if (!item) return
      if (b.image) {
        const img = itemImages(drawn, item.id)[0]
        const v = e.data[b.image]
        if (img && isMedia(v)) forClip[img] = { ...forClip[img], media: { ...v } as MediaFill }
      }
      const path = ctx.entryPath?.(c.slug, e.slug)
      if (path) {
        const linkable = [item, ...descendants(drawn, item.id)].find((x) => x.linkable)
        if (linkable) forClip[linkable.id] = { ...forClip[linkable.id], link: { to: 'page', path } }
      }
    })
  }

  if (bind.entry && ctx.entry) {
    const { collection, entry } = ctx.entry
    const c = ctx.collections[collection]
    for (const [field, fk] of Object.entries(bind.entry.fields ?? {})) {
      words[field] = entryValue(c, entry, fk)
      if (!fk.includes('#')) targets?.fields.set(field, { collection, entry: entry.id, field: fk })
    }
    const drawn = sectionClip(clip, lists, extrasOf(slot, clip.id))
    for (const [media, fk] of Object.entries(bind.entry.media ?? {})) {
      const img = drawn.blocks.find((x) => x.kind === 'image' && x.media === media)
      const v = entry.data[fk]
      if (img && isMedia(v)) forClip[img.id] = { ...forClip[img.id], media: { ...v } as MediaFill }
    }
  }

  if (!Object.keys(lists).length) lists = {}
  return { ...slot, lists: Object.keys(lists).length ? lists : undefined, words, edits: { ...slot.edits, [clip.id]: forClip } }
}

function descendants(clip: SectionClip, id: string): SectionClip['blocks'] {
  const kids = clip.blocks.filter((b) => b.parent === id)
  return kids.flatMap((k) => [k, ...descendants(clip, k.id)])
}

/** The fields of a bound list's items that come from a collection (so the canvas won't let you type into them). */
export function boundFields(slot: Slot, clip: Clip): Set<string> {
  const out = new Set<string>()
  if (!slot.bind) return out
  const base = sectionClip(clip, slot.lists, extrasOf(slot, clip.id))
  const tree = outline(parseHtml(base.html))
  for (const [key, b] of Object.entries(slot.bind.lists ?? {})) {
    const list = findList(tree, key)
    for (const it of list?.items ?? []) {
      const walk = (nodes: OutlineNode[]) => {
        for (const n of nodes) {
          if (n.t === 'field' && (it.plain || Object.keys(b.map).includes(n.key))) out.add(n.field)
          if (n.t === 'list') n.items.forEach((x) => walk(x.nodes))
        }
      }
      walk(it.nodes)
    }
  }
  for (const f of Object.keys(slot.bind.entry?.fields ?? {})) out.add(f)
  return out
}

export const emptyTargets = (): BindTargets => ({ fields: new Map(), items: new Map() })
