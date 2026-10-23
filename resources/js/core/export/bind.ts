// Components that read their words from a content file. Each field's element
// shows {content.heading}; a list whose items are all built the same way
// renders with {content.features.map((item, i) => …)}, so adding an item to
// the JSON adds it to the page. Lists whose items differ (their own icons,
// pictures or looks) are written item by item, each reading its own entry.
//
// Elements carry data-mx-src="src/content/hero.json#heading" (Koati's
// data-koati-src idea), so pickers and agents can trace words to their file.

import { EXPR_ATTR, attr, type HEl, type HNode } from '../html/parse'
import { fieldPointers, type OutlineNode } from '../outline'
import { counterWidth, firstOnly, itemShape, setCounter } from '../lists'

interface ListInfo {
  ptr: string
  listKey: string
}

interface MapCtx {
  ptr: string
  item: string
  index: string
  /** Which item the template was drawn from (its fields point there). */
  tpl: number
}

const IDENT = /^[A-Za-z_$][\w$]*$/

/** "features/2/title" from a base expression: content.features[2].title */
function path(base: string, ptr: string): string {
  if (!ptr) return base
  return ptr.split('/').reduce((e, seg) => (/^\d+$/.test(seg) ? `${e}[${seg}]` : IDENT.test(seg) ? `${e}.${seg}` : `${e}[${JSON.stringify(seg)}]`), base)
}

/** The expression for a pointer, inside whichever lists are being mapped. */
function access(ptr: string, maps: MapCtx[]): string {
  for (let k = maps.length - 1; k >= 0; k--) {
    const pre = `${maps[k].ptr}/${maps[k].tpl}`
    if (ptr === pre) return maps[k].item
    if (ptr.startsWith(`${pre}/`)) return path(maps[k].item, ptr.slice(pre.length + 1))
  }
  return path('content', ptr)
}

/** data-mx-src for a pointer: a plain string, or a template literal inside mapped lists. */
function src(file: string, ptr: string, maps: MapCtx[]): string {
  let p = ptr
  let dynamic = false
  for (let k = maps.length - 1; k >= 0; k--) {
    const pre = `${maps[k].ptr}/${maps[k].tpl}`
    if (p === pre || p.startsWith(`${pre}/`)) {
      p = `${maps[k].ptr}/\${${maps[k].index}}${p.slice(pre.length)}`
      dynamic = true
    }
  }
  return dynamic ? `${EXPR_ATTR}\`${file}#${p}\`` : `${file}#${p}`
}

function listsOf(nodes: OutlineNode[], base = '', out = new Map<string, ListInfo>()): Map<string, ListInfo> {
  for (const n of nodes) {
    if (n.t !== 'list') continue
    out.set(n.id, { ptr: `${base}${n.key}`, listKey: n.listKey })
    n.items.forEach((it, i) => listsOf(it.nodes, `${base}${n.key}/${i}/`, out))
  }
  return out
}

const isEl = (n: HNode): n is HEl => n.t === 'el'
const isItem = (n: HNode): n is HEl => isEl(n) && attr(n, 'data-mx-block') === 'item'
const isMirror = (n: HNode): n is HEl => isEl(n) && attr(n, 'data-mx-mirror') !== undefined
const fieldOf = (el: HEl) => attr(el, 'data-mx-field') ?? attr(el, 'data-mx-mirror')

/** Root attributes that differ for the first item become expressions on the position: open={i === 0}. */
function firstAttrs(attrs: [string, string][], special: { first: [string, string][]; rest: [string, string][] }, index: string): [string, string][] {
  const names = new Set([...special.first, ...special.rest].map(([k]) => k))
  const out = attrs.filter(([k]) => !names.has(k))
  for (const k of names) {
    const a = special.first.find(([x]) => x === k)?.[1]
    const b = special.rest.find(([x]) => x === k)?.[1]
    if (a === b) {
      out.push([k, a!])
      continue
    }
    // A boolean attribute only the first has: open={i === 0}.
    if (a === '' && b === undefined) out.push([k, `${EXPR_ATTR}${index} === 0`])
    else out.push([k, `${EXPR_ATTR}${index} === 0 ? ${a == null ? 'undefined' : JSON.stringify(a)} : ${b == null ? 'undefined' : JSON.stringify(b)}`])
  }
  return out
}

/**
 * The section's markup reading from its content file. `file` is the file's
 * path in the project (src/content/hero.json); `keyed` adds React's key to
 * mapped items.
 */
export function bindContent(tree: HNode[], nodes: OutlineNode[], file: string, keyed: boolean): HNode[] {
  const ptrs = fieldPointers(nodes)
  const lists = listsOf(nodes)

  const visit = (ns: HNode[], maps: MapCtx[]): HNode[] => ns.map((n) => (isEl(n) ? bindEl(n, maps) : n))

  const bindEl = (el: HEl, maps: MapCtx[]): HEl => {
    const listId = attr(el, 'data-mx-block') === 'list' ? attr(el, 'data-mx-b') : attr(el, 'data-mx-set')
    const list = listId ? lists.get(listId) : undefined
    const attrs = el.attrs.filter(([k]) => !k.startsWith('data-mx-'))
    const field = fieldOf(el)
    if (field && ptrs[field] != null) {
      const p = ptrs[field]
      // Only the real field says where its words live; a marquee's copy just repeats them.
      const withSrc: [string, string][] = attr(el, 'data-mx-field') ? [...attrs, ['data-mx-src', src(file, p, maps)]] : attrs
      return { ...el, attrs: withSrc, kids: [{ t: 'expr', v: access(p, maps) }] }
    }
    if (list) {
      const all = el.kids.filter(attr(el, 'data-mx-set') ? isMirror : isItem)
      // Numbers that count the items (01, 02…) come from the item's position.
      const width = counterWidth(all)
      const items = width == null ? all : all.map((it) => setCounter(it, () => ({ t: 'text', v: '#' })))
      // Built alike, or alike apart from what only the first item has (open, wide…).
      const special = attr(el, 'data-mx-set') ? null : firstOnly(items, list.listKey)
      const same = special != null || (items.length > 0 && items.every((it) => itemShape(it, list.listKey) === itemShape(items[0], list.listKey)))
      if (same) {
        const depth = maps.length
        const m: MapCtx = { ptr: list.ptr, item: depth ? `item${depth + 1}` : 'item', index: depth ? `i${depth + 1}` : 'i', tpl: special ? 1 : 0 }
        const first = el.kids.indexOf(all[0])
        const last = el.kids.indexOf(all[all.length - 1])
        const base = special ? all[1] : all[0]
        const counted = width == null ? base : setCounter(base, (v) => ({ t: 'expr', v: `String(${m.index} + 1).padStart(${width}, '0')${v.trim().replace(/^\d+/, '') ? ` + ${JSON.stringify(v.trim().replace(/^\d+/, ''))}` : ''}` }))
        let template = bindEl(counted, [...maps, m])
        if (special) template = { ...template, attrs: firstAttrs(template.attrs, special, m.index) }
        if (keyed) template = { ...template, attrs: [['key', `${EXPR_ATTR}${m.index}`], ...template.attrs] }
        const between = el.kids.slice(first, last + 1).filter((k) => isEl(k) && !all.includes(k as HEl))
        return {
          ...el,
          attrs,
          kids: [...visit(el.kids.slice(0, first), maps), { t: 'map', list: access(list.ptr, maps), item: m.item, index: m.index, kids: [template] }, ...visit(between, maps), ...visit(el.kids.slice(last + 1), maps)],
        }
      }
    }
    return { ...el, attrs, kids: visit(el.kids, maps) }
  }

  return visit(tree, [])
}
