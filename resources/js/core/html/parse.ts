import { parseFragment } from 'parse5'

export type HEl = { t: 'el'; tag: string; ns: 'html' | 'svg'; attrs: [string, string][]; kids: HNode[] }
export type HText = { t: 'text'; v: string }
export type HNode = HEl | HText

const SVG_NS = 'http://www.w3.org/2000/svg'

type P5Node = {
  nodeName: string
  tagName?: string
  value?: string
  namespaceURI?: string
  attrs?: { name: string; value: string; prefix?: string }[]
  childNodes?: P5Node[]
  content?: { childNodes: P5Node[] }
}

/** Parse an HTML fragment into a small, serializable tree. Comments are dropped. */
export function parseHtml(html: string): HNode[] {
  const frag = parseFragment(html) as unknown as P5Node
  return convert(frag.childNodes ?? [])
}

function convert(nodes: P5Node[]): HNode[] {
  const out: HNode[] = []
  for (const n of nodes) {
    if (n.nodeName === '#text') out.push({ t: 'text', v: n.value ?? '' })
    else if (n.nodeName === '#comment' || n.nodeName === '#documentType') continue
    else if (n.tagName) {
      const attrs = (n.attrs ?? []).map((a) => [a.prefix ? `${a.prefix}:${a.name}` : a.name, a.value] as [string, string])
      const kids = n.tagName === 'template' ? convert(n.content?.childNodes ?? []) : convert(n.childNodes ?? [])
      out.push({ t: 'el', tag: n.tagName, ns: n.namespaceURI === SVG_NS ? 'svg' : 'html', attrs, kids })
    }
  }
  return out
}

export function attr(el: HEl, name: string): string | undefined {
  return el.attrs.find(([k]) => k === name)?.[1]
}

export function walk(nodes: HNode[], fn: (n: HNode, parent: HEl | null) => void, parent: HEl | null = null) {
  for (const n of nodes) {
    fn(n, parent)
    if (n.t === 'el') walk(n.kids, fn, n)
  }
}

export function mapTree(nodes: HNode[], fn: (el: HEl) => HEl): HNode[] {
  return nodes.map((n) => {
    if (n.t !== 'el') return n
    const mapped = fn(n)
    return { ...mapped, kids: mapTree(mapped.kids, fn) }
  })
}

export function textOf(node: HNode): string {
  return node.t === 'text' ? node.v : node.kids.map(textOf).join('')
}

/** Collect `data-mx-field` → text from a tree. */
export function extractFields(nodes: HNode[]): Record<string, string> {
  const fields: Record<string, string> = {}
  walk(nodes, (n) => {
    if (n.t !== 'el') return
    const f = attr(n, 'data-mx-field')
    if (f) fields[f] = textOf(n).replace(/\s+/g, ' ').trim()
  })
  return fields
}

/**
 * Replace the text of every `data-mx-field` element (and `data-mx-mirror` copies,
 * e.g. the second half of a seamless marquee) and strip `data-mx-*` attributes.
 */
export function applyFields(nodes: HNode[], fields: Record<string, string>, stripMx = true): HNode[] {
  return mapTree(nodes, (el) => {
    const f = attr(el, 'data-mx-field') ?? attr(el, 'data-mx-mirror')
    const attrs = stripMx ? el.attrs.filter(([k]) => !k.startsWith('data-mx-')) : el.attrs
    if (f && fields[f] != null) return { ...el, attrs, kids: [{ t: 'text', v: fields[f] }] }
    return { ...el, attrs }
  })
}
