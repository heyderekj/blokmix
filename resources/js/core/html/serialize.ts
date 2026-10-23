import type { HEl, HNode } from './parse'

/**
 * One serializer, two dialects:
 * - 'html' for Astro components and the reference build
 * - 'jsx'  for Next.js components
 *
 * Elements whose children are all elements are pretty-printed one child per
 * line. Elements with any text (mixed inline content) are written on a single
 * line exactly as they are, so no meaningful whitespace is lost in JSX.
 */
export type Dialect = 'html' | 'jsx'

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

const JSX_RENAME: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  playsinline: 'playsInline',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  enctype: 'encType',
  novalidate: 'noValidate',
  datetime: 'dateTime',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
  viewbox: 'viewBox',
  'xlink:href': 'xlinkHref',
  'xml:space': 'xmlSpace',
  'xmlns:xlink': 'xmlnsXlink',
  'accept-charset': 'acceptCharset',
  'http-equiv': 'httpEquiv',
}

const BOOLEAN = new Set(['checked', 'disabled', 'hidden', 'open', 'required', 'selected', 'multiple', 'autofocus', 'readonly', 'novalidate', 'defaultChecked', 'readOnly', 'noValidate', 'autoFocus', 'muted', 'loop', 'autoplay', 'autoPlay', 'playsinline', 'playsInline', 'controls'])

/** React types these as numbers, so `rows="5"` must become `rows={5}`. */
const NUMERIC = new Set(['rows', 'cols', 'size', 'span', 'start', 'tabIndex', 'colSpan', 'rowSpan', 'maxLength', 'minLength', 'width', 'height'])

export function jsxAttrName(name: string, tag: string): string {
  if (name === 'checked' && tag === 'input') return 'defaultChecked'
  if (name === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) return 'defaultValue'
  if (JSX_RENAME[name]) return JSX_RENAME[name]
  if (name.startsWith('aria-') || name.startsWith('data-')) return name
  if (name.includes('-') || name.includes(':')) return name.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase())
  return name
}

function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;')
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function attrs(el: HEl, d: Dialect): string {
  return el.attrs
    .map(([k, v]) => {
      const name = d === 'jsx' ? jsxAttrName(k, el.tag) : k
      if (v === '' && (BOOLEAN.has(k) || BOOLEAN.has(name))) return ` ${name}`
      if (d === 'jsx' && NUMERIC.has(name) && /^-?\d+$/.test(v)) return ` ${name}={${v}}`
      return ` ${name}="${escAttr(v)}"`
    })
    .join('')
}

const isBlank = (n: HNode) => n.t === 'text' && !n.v.trim()

function hasText(el: HEl): boolean {
  return el.kids.some((k) => k.t === 'text' && k.v.trim() !== '')
}

function inline(n: HNode, d: Dialect, pre: boolean): string {
  if (n.t === 'text') {
    if (pre) return d === 'jsx' ? `{${JSON.stringify(n.v)}}` : escText(n.v)
    return escText(n.v.replace(/\s+/g, ' '))
  }
  const open = `<${n.tag}${attrs(n, d)}`
  if (VOID.has(n.tag)) return d === 'jsx' ? `${open} />` : `${open}>`
  if (!n.kids.length && (d === 'jsx' || n.ns === 'svg')) return `${open} />`
  const inPre = pre || n.tag === 'pre'
  return `${open}>${n.kids.map((k) => inline(k, d, inPre)).join('')}</${n.tag}>`
}

function block(n: HNode, d: Dialect, depth: number, out: string[]) {
  const pad = '  '.repeat(depth)
  if (n.t === 'text') {
    const t = n.v.replace(/\s+/g, ' ').trim()
    if (t) out.push(pad + escText(t))
    return
  }
  const kids = n.kids.filter((k) => !isBlank(k))
  if (n.tag === 'pre' || hasText(n) || !kids.length || VOID.has(n.tag)) {
    // Mixed inline content: one line, collapsed whitespace, trimmed at the edges.
    const line = inline({ ...n, kids: trimEdges(n.kids, n.tag === 'pre') }, d, false)
    out.push(pad + line)
    return
  }
  out.push(`${pad}<${n.tag}${attrs(n, d)}>`)
  for (const k of kids) block(k, d, depth + 1, out)
  out.push(`${pad}</${n.tag}>`)
}

function trimEdges(kids: HNode[], pre: boolean): HNode[] {
  if (pre || !kids.length) return kids
  const out = [...kids]
  const first = out[0]
  const last = out[out.length - 1]
  if (first.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s+/, '') }
  if (last.t === 'text') out[out.length - 1] = { t: 'text', v: (out[out.length - 1] as { v: string }).v.replace(/\s+$/, '') }
  return out.filter((k) => !(k.t === 'text' && k.v === ''))
}

export function serialize(nodes: HNode[], d: Dialect, depth = 0): string {
  const out: string[] = []
  for (const n of nodes) if (!isBlank(n)) block(n, d, depth, out)
  return out.join('\n')
}
