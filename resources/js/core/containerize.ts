/**
 * Responsive rules that answer to the section's own width. Every section root is a size container (`.mx-section`,
 * `[data-mx-section]` in the base CSS), so a clip's width breakpoints become container queries and the layout fits
 * wherever it sits: a full page, a column, a preview. A container can't query itself, so whatever styles the root
 * (its own declarations, `&.reverse`, `&::before`) keeps its viewport media query.
 */

type Block = { t: 'block'; prelude: string; kids: Node[]; close: string }
type Node = { t: 'text'; raw: string } | Block

function parse(css: string): Node[] {
  let i = 0
  const read = (): Node[] => {
    const out: Node[] = []
    let buf = ''
    // Where the last declaration (or block) ended in buf, outside comments and strings: a prelude starts after it.
    let cut = 0
    const flushText = (upTo: string) => {
      if (upTo) out.push({ t: 'text', raw: upTo })
    }
    while (i < css.length) {
      const c = css[i]
      if (c === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2)
        const stop = end < 0 ? css.length : end + 2
        buf += css.slice(i, stop)
        i = stop
        continue
      }
      if (c === '"' || c === "'") {
        let j = i + 1
        while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1
        buf += css.slice(i, j + 1)
        i = j + 1
        continue
      }
      if (c === '{') {
        // The prelude is what follows the last declaration end (or the start) in the buffer.
        // A comment just before the prelude belongs to it.
        const lead = buf.slice(0, cut)
        const prelude = buf.slice(cut)
        flushText(lead)
        buf = ''
        cut = 0
        i++
        const kids = read()
        out.push({ t: 'block', prelude, kids, close: '}' })
        continue
      }
      if (c === '}') {
        flushText(buf)
        i++
        return out
      }
      buf += c
      i++
      if (c === ';') cut = buf.length
    }
    flushText(buf)
    return out
  }
  return read()
}

const print = (nodes: Node[]): string => nodes.map((n) => (n.t === 'text' ? n.raw : `${n.prelude}{${print(n.kids)}${n.close}`)).join('')

/** `@media (max-width: 760px)` and friends (after any comment about them): width conditions only, joined by `and`. */
const WIDTH_MEDIA = /^((?:\s|\/\*[\s\S]*?\*\/)*)@media\s+(\(\s*(?:max|min)-width\s*:[^)]*\)(?:\s+and\s+\(\s*(?:max|min)-width\s*:[^)]*\))*)(\s*)$/

/** A nested selector that styles the root itself (`&.reverse`, `&::before`, `&:hover`) rather than something inside it. */
function targetsRoot(prelude: string): boolean {
  const flat = prelude.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\([^()]*\)/g, '()').replace(/\([^()]*\)/g, '()')
  return flat.split(',').some((part) => /^&[^\s>+~]*$/.test(part.trim()))
}

/**
 * A section's container is its content box: the viewport less the root's gutters (`--mx-space-8` each side, 64px at the
 * default spacing) and any classic scrollbar (up to ~16px, which viewport media queries count and the box doesn't).
 * Breakpoints move in by that much, so a full-width section switches where it did on the viewport.
 */
export const GUTTERS = 144
// Wide breakpoints only lose the gutters, so a full-width section at exactly the old width still matches with a scrollbar.
const toSectionWidth = (cond: string) => cond.replace(/(\d+(?:\.\d+)?)px/g, (_, n: string) => `${Number(n) - (Number(n) > 900 ? 128 : GUTTERS)}px`)

const isAt = (prelude: string) => /^(?:\s|\/\*[\s\S]*?\*\/)*@/.test(prelude)
const hasDecls = (raw: string) => raw.replace(/\/\*[\s\S]*?\*\//g, '').trim().length > 0

function transform(nodes: Node[], ctx: 'root' | 'inside' | 'self'): Node[] {
  const out: Node[] = []
  for (const n of nodes) {
    if (n.t === 'text') {
      out.push(n)
      continue
    }
    const media = WIDTH_MEDIA.exec(n.prelude)
    if (media && ctx !== 'self') {
      const cond = toSectionWidth(media[2])
      const toContainer = (kids: Node[]): Block => ({ ...n, prelude: `${media[1]}@container ${cond}${media[3]}`, kids })
      if (ctx === 'inside') {
        out.push(toContainer(transform(n.kids, 'inside')))
        continue
      }
      // Directly in the root: its own declarations and root-targeting rules stay on the viewport, the rest move.
      const stay: Node[] = []
      const move: Node[] = []
      for (const k of n.kids) {
        if (k.t === 'text') (hasDecls(k.raw) ? stay : move).push(k)
        else if (isAt(k.prelude) || targetsRoot(k.prelude)) stay.push({ ...k, kids: transform(k.kids, 'self') })
        else move.push({ ...k, kids: transform(k.kids, 'inside') })
      }
      const real = (list: Node[]) => list.some((k) => k.t === 'block' || hasDecls(k.raw))
      if (!real(stay)) out.push(toContainer(move))
      else if (!real(move)) out.push({ ...n, kids: stay })
      else {
        // The viewport part closes on its own line, then the section part follows.
        const indent = media[1].slice(media[1].lastIndexOf('\n') + 1)
        const last = stay[stay.length - 1]
        if (last.t === 'text' && !/\n\s*$/.test(last.raw)) stay[stay.length - 1] = { t: 'text', raw: last.raw.replace(/\s*$/, '') + '\n' + indent }
        out.push({ ...n, kids: stay }, { ...toContainer(move), prelude: `\n${indent}@container ${cond}${media[3]}` })
      }
      continue
    }
    const next: 'root' | 'inside' | 'self' = ctx === 'root' ? (isAt(n.prelude) ? 'root' : targetsRoot(n.prelude) ? 'self' : 'inside') : ctx
    out.push({ ...n, kids: transform(n.kids, next) })
  }
  return out
}

/** A clip's CSS with its width breakpoints answering to the section instead of the viewport. */
export function toContainerQueries(css: string): string {
  return print(parse(css).map((n) => (n.t === 'block' && !isAt(n.prelude) ? { ...n, kids: transform(n.kids, 'root') } : n)))
}

/** How many width breakpoints still answer to the viewport but could answer to the section (for lint). */
export function viewportWidthRules(css: string): number {
  const count = (s: string) => s.match(/@container\b/g)?.length ?? 0
  return count(toContainerQueries(css)) - count(css)
}

/** For tests: parsing and printing gives back the same text. */
export const roundTrip = (css: string) => print(parse(css))
