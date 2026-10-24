// The working tree a capture is built on: the snapshot's elements with their
// full computed styles restored (the snapshot only stores differences), plus
// the marks capture adds as it goes (fields, blocks, lists, classes).

import type { BlockKind } from '@/core/types'
import type { HEl } from '@/core/html/parse'
import type { Decls, SnapEl, Snapshot } from './types'

export const INHERITED = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'white-space',
  'font-variant-numeric',
  'list-style-type',
  'cursor',
  'visibility',
  'fill',
  'stroke',
  'stroke-width',
])

export interface WText {
  t: 'text'
  v: string
}

export interface WEl {
  t: 'el'
  id: number
  tag: string
  ns: 'html' | 'svg'
  /** The page's own attributes (class, aria-*, alt…), read for hints; output attributes are built later. */
  hints: [string, string][]
  /** Full computed style. */
  s: Decls
  /** What the tag looks like with no author styles (browser defaults). */
  def: Decls
  rect: [number, number, number, number]
  parent: WEl | null
  kids: WNode[]
  before?: Decls
  after?: Decls
  hover?: Decls
  groupHover?: { target: number; decls: Decls }[]
  svg?: string
  /** The sanitized <svg>, ready to write out. */
  svgNode?: HEl
  /** A multi-color illustration's colors, by the class each color's shapes carry. */
  svgPaints?: { cls: string; prop: 'fill' | 'stroke'; color: string }[]
  media?: SnapEl['media']

  /** A leaf holding copy (its text is in `text`, kids are empty). */
  text?: string
  field?: string
  mirror?: string
  block?: BlockKind
  label?: string
  list?: string
  mediaName?: string
  ratio?: string
  icon?: string
  /** A picture that fills the section behind its copy (a hero photo): filled, not illustrated. */
  backdrop?: boolean
  /** <details> made from an accordion row: the chevron that turns, and how it looks when open. */
  openTurn?: WEl
  openStyle?: Decls
  /** Made by capture: a wrapper or a placeholder, with no styles of its own on the page. */
  synthetic?: 'wrap' | 'contents' | 'art' | 'wordmark'
  /** Declarations capture adds or overrides (a flex fix, a placeholder's look). */
  extra?: Decls
  /** Computed properties capture decided not to write. */
  skip?: Set<string>
  /** Output attributes, besides class and the data-mx-* marks. */
  out?: [string, string][]
  cls?: string
  /** Its role on Blokmix's layout primitives ("container", "head center", "btn primary"): its class name. */
  role?: string
}

export type WNode = WEl | WText

/** A class name as a selector: `btn primary` → `.btn.primary`. */
export const sel = (cls: string) => '.' + cls.trim().split(/\s+/).join('.')

export const isEl = (n: WNode | undefined): n is WEl => !!n && n.t === 'el'
export const els = (n: WEl) => n.kids.filter(isEl)

export function hint(el: WEl, name: string): string | undefined {
  return el.hints.find(([k]) => k === name)?.[1]
}

/** Rebuild full styles from the snapshot's diffs. */
export function buildTree(snap: Snapshot): WEl {
  const div = snap.defaults.div ?? {}
  const visit = (n: SnapEl, parent: WEl | null): WEl => {
    const def = snap.defaults[n.tag] ?? div
    const s: Decls = {}
    for (const p of new Set([...Object.keys(def), ...Object.keys(n.style)])) {
      if (p in n.style) s[p] = n.style[p]
      else if (INHERITED.has(p)) s[p] = parent ? parent.s[p] : def[p]
      else s[p] = def[p]
    }
    const el: WEl = {
      t: 'el',
      id: n.id,
      tag: n.tag,
      ns: n.ns,
      hints: n.attrs,
      s,
      def,
      rect: n.rect,
      parent,
      kids: [],
      before: n.before,
      after: n.after,
      hover: n.hover,
      groupHover: n.groupHover,
      svg: n.svg,
      media: n.media,
    }
    el.kids = n.kids.map((k) => (k.t === 'text' ? { t: 'text', v: k.v } : visit(k, el)))
    return el
  }
  return visit(snap.root, null)
}

export function walkEls(el: WEl, fn: (e: WEl) => void) {
  fn(el)
  for (const k of el.kids) if (isEl(k)) walkEls(k, fn)
}

export function allEls(root: WEl): WEl[] {
  const out: WEl[] = []
  walkEls(root, (e) => out.push(e))
  return out
}

export const px = (v: string | undefined) => parseFloat(v ?? '') || 0

/** All the text under an element, whitespace collapsed. */
export function textOf(n: WNode): string {
  if (n.t === 'text') return n.v
  if (n.text !== undefined) return n.text
  return n.kids.map(textOf).join('')
}

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Leaves (copy-holding elements) under an element, in document order. */
export function leavesOf(el: WEl): WEl[] {
  const out: WEl[] = []
  walkEls(el, (e) => {
    if (e.text !== undefined) out.push(e)
  })
  return out
}

export function contains(a: WEl, b: WEl): boolean {
  for (let p: WEl | null = b; p; p = p.parent) if (p === a) return true
  return false
}

export function closest(el: WEl, test: (e: WEl) => boolean): WEl | null {
  for (let p: WEl | null = el; p; p = p.parent) if (test(p)) return p
  return null
}

export function setParents(el: WEl) {
  for (const k of el.kids) if (isEl(k)) {
    k.parent = el
    setParents(k)
  }
}

/** A new element made by capture, inheriting its parent's text styles. */
export function synth(tag: string, parent: WEl, kind: WEl['synthetic'], kids: WNode[] = []): WEl {
  const s: Decls = {}
  for (const [k, v] of Object.entries(parent.s)) s[k] = INHERITED.has(k) ? v : ''
  return { t: 'el', id: -1, tag, ns: 'html', hints: [], s, def: {}, rect: parent.rect, parent, kids, synthetic: kind }
}
