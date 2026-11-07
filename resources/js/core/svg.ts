// SVG files people add as pictures and logos: kept as vectors (a logo stays crisp at any size), with everything that
// could run or reach out taken away first. Pure, so the browser, tests and exports share it; the server cleans again
// with the same rules (app/Support/SvgCleaner.php), since it serves the file from the app's own address.

/** Larger than this isn't a logo or an illustration; it's a document. */
export const SVG_MAX_BYTES = 2 * 1024 * 1024

export interface CleanSvg {
  svg: string
  /** Its drawn size, from width/height or the viewBox (300×150 when it gives neither, as browsers do). */
  width: number
  height: number
}

/** Whether a piece of text is SVG code (a file's contents, or markup pasted from a design tool). */
export const looksLikeSvg = (text: string) => /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)

/** Elements that run code, embed other documents or play sound: dropped with everything inside them. */
const DROP = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'handler', 'listener']

/** A link may point inside the drawing or at an embedded picture; nothing else. */
const SAFE_LINK = /^\s*(#|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i

const num = (v: string | undefined) => {
  const m = v && /^\s*([\d.]+)\s*(px)?\s*$/.exec(v)
  return m ? Number(m[1]) : undefined
}

/**
 * The SVG with scripts, event handlers, outside links, imports and outside url() references removed, and its size;
 * null when it isn't an SVG or is too big. Always carries the SVG namespace and a size, so it draws as an <img>.
 */
export function cleanSvg(text: string): CleanSvg | null {
  if (new TextEncoder().encode(text).length > SVG_MAX_BYTES || !looksLikeSvg(text)) return null
  let s = text
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  for (const tag of DROP) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '').replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }
  // Animations that rewrite a link or a handler could bring one back.
  s = s.replace(/<(set|animate)\b[^>]*attributeName\s*=\s*["']?\s*(on\w+|(xlink:)?href)\b[^>]*\/?>(<\/\1\s*>)?/gi, '')
  // Event handlers, and links that leave the drawing.
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  s = s.replace(/\s+((?:xlink:)?href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (whole, _k, _v, a, b, c) => (SAFE_LINK.test(a ?? b ?? c ?? '') ? whole : ''))
  // Styles may not import or fetch anything, nor run script through old URL schemes.
  s = s.replace(/@import[^;]*;?/gi, '')
  s = s.replace(/url\(\s*(['"]?)(?!\s*#)[^)]*\1\s*\)/gi, 'none')
  s = s.replace(/(javascript|vbscript)\s*:/gi, '')

  const open = /<svg\b([^>]*)>/i.exec(s)
  if (!open) return null
  let attrs = open[1]
  const get = (k: string) => new RegExp(`\\s${k}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs)?.[1]
  const view = get('viewBox')?.trim().split(/[\s,]+/).map(Number)
  const vw = view?.length === 4 && view[2] > 0 ? view[2] : undefined
  const vh = view?.length === 4 && view[3] > 0 ? view[3] : undefined
  let width = num(get('width')) ?? vw
  let height = num(get('height')) ?? vh
  if (width && !height && vw && vh) height = (width * vh) / vw
  if (height && !width && vw && vh) width = (height * vw) / vh
  width = Math.round(width || 300)
  height = Math.round(height || 150)
  // A size in %, em or none at all: give it the drawn size so it has one as a picture.
  if (num(get('width')) === undefined) attrs = attrs.replace(/\swidth\s*=\s*["'][^"']*["']/i, '') + ` width="${width}"`
  if (num(get('height')) === undefined) attrs = attrs.replace(/\sheight\s*=\s*["'][^"']*["']/i, '') + ` height="${height}"`
  if (!/\sxmlns\s*=/i.test(attrs)) attrs = ` xmlns="http://www.w3.org/2000/svg"${attrs}`
  s = s.slice(0, open.index) + `<svg${attrs}>` + s.slice(open.index + open[0].length)
  return { svg: s.trim(), width, height }
}

/** As a data URL a frame and an export can both read (base64, so exports write it as public/media/….svg). */
export function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `data:image/svg+xml;base64,${btoa(bin)}`
}
