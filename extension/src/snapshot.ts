import type { Decls, Keyframe, SnapEl, SnapNode, Snapshot, SnapshotOptions } from './capture/types'

/**
 * Read a picked section off the live page: its DOM, the computed styles that
 * matter for re-creating it, hover rules, keyframes and font links.
 *
 * Runs in the page (the content script, or a test browser via toString()), so it
 * is ONE self-contained function: no imports, every helper inside.
 */
export function snapshotSection(root: Element, opts: SnapshotOptions = {}): Snapshot {
  const doc = root.ownerDocument
  const win = doc.defaultView!
  const notes: string[] = []

  const INHERITED = [
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
  ]
  const BOX = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'flex-direction',
    'flex-wrap',
    'justify-content',
    'align-items',
    'align-content',
    'align-self',
    'justify-items',
    'justify-self',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'order',
    'row-gap',
    'column-gap',
    'grid-template-columns',
    'grid-column-start',
    'grid-column-end',
    'grid-row-start',
    'grid-row-end',
    'grid-auto-flow',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'aspect-ratio',
    'box-sizing',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
    'background-color',
    'background-image',
    'background-size',
    'background-position',
    'background-repeat',
    'background-clip',
    '-webkit-text-fill-color',
    'box-shadow',
    'text-shadow',
    'opacity',
    'overflow-x',
    'overflow-y',
    'transform',
    'filter',
    'backdrop-filter',
    'mix-blend-mode',
    'isolation',
    'object-fit',
    'text-decoration-line',
    'text-decoration-color',
    'text-decoration-thickness',
    'text-underline-offset',
    'pointer-events',
    'transition-property',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
    'animation-name',
    'animation-duration',
    'animation-timing-function',
    'animation-delay',
    'animation-iteration-count',
    'animation-direction',
    'animation-fill-mode',
    'animation-timeline',
  ]
  const PROPS = [...INHERITED, ...BOX]
  const SKIP = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'base', 'title', 'slot'])
  const MEDIA = new Set(['img', 'picture', 'video', 'iframe', 'canvas', 'object', 'embed'])
  const KEEP_ATTRS = /^(class|id|href|alt|role|aria-[\w-]+|type|name|placeholder|for|checked|open|title|rows|required|autocomplete|data-icon|data-lucide|data-feather|data-testid)$/

  // ---- colors: every color comes out as rgba(r, g, b, a) ----
  const canvas = doc.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const COLOR_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\b(?:transparent|currentcolor)\b/gi
  const colorCache = new Map<string, string>()
  const rgbaOf = (c: string): string => {
    const hit = colorCache.get(c)
    if (hit) return hit
    let out = c
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(c)
    if (/^transparent$/i.test(c)) out = 'rgba(0, 0, 0, 0)'
    else if (/^currentcolor$/i.test(c)) out = c
    else if (m) {
      const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
      out = `rgba(${Math.round(+m[1])}, ${Math.round(+m[2])}, ${Math.round(+m[3])}, ${+a.toFixed(3)})`
    } else if (ctx) {
      // The canvas parses any CSS color and hands back sRGB pixels.
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      out = a ? `rgba(${Math.round((r * 255) / a)}, ${Math.round((g * 255) / a)}, ${Math.round((b * 255) / a)}, ${+(a / 255).toFixed(3)})` : 'rgba(0, 0, 0, 0)'
      if (a === 255) out = `rgba(${r}, ${g}, ${b}, 1)`
    }
    colorCache.set(c, out)
    return out
  }
  const normColors = (v: string) => (v && /[#(]|transparent/i.test(v) ? v.replace(COLOR_RE, (c) => rgbaOf(c)) : v)

  // ---- browser defaults, read in a blank document ----
  const defaults: Record<string, Decls> = {}
  const frame = doc.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:500px;border:0;visibility:hidden'
  ;(doc.body ?? doc.documentElement).appendChild(frame)
  const blank = frame.contentDocument
  const defaultsFor = (tag: string, ns: 'html' | 'svg') => {
    if (defaults[tag] || !blank) return
    const el = ns === 'svg' ? blank.createElementNS('http://www.w3.org/2000/svg', tag) : blank.createElement(tag)
    const host = ns === 'svg' && tag !== 'svg' ? blank.createElementNS('http://www.w3.org/2000/svg', 'svg') : null
    if (host) {
      host.appendChild(el)
      blank.body.appendChild(host)
    } else blank.body.appendChild(el)
    const cs = blank.defaultView!.getComputedStyle(el)
    const d: Decls = {}
    for (const p of PROPS) d[p] = normColors(cs.getPropertyValue(p))
    defaults[tag] = d
    ;(host ?? el).remove()
  }
  defaultsFor('div', 'html')
  defaultsFor('span', 'html')

  // ---- stylesheets: hover rules and keyframes ----
  const sheets: CSSStyleSheet[] = []
  let blocked = 0
  for (const s of Array.from(doc.styleSheets)) {
    try {
      void s.cssRules
      sheets.push(s)
    } catch {
      blocked++
    }
  }
  for (const text of opts.sheetTexts ?? []) {
    try {
      const s = new (win as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet()
      s.replaceSync(text)
      sheets.push(s)
      blocked = Math.max(0, blocked - 1)
    } catch {
      /* unparseable sheet */
    }
  }
  if (blocked) notes.push(`${blocked} cross-origin stylesheet${blocked > 1 ? 's' : ''} couldn’t be read, so their hover states and keyframes are missing`)

  // `:hover` and `,` as selector syntax, not escaped inside a class name (Tailwind's `.supports-hover\:hover\:bg-black`).
  const HOVER = /(?<!\\):hover/
  const HOVER_ALL = /(?<!\\):hover/g
  const splitList = (sel: string) => sel.split(/(?<!\\),(?![^(]*\))/)
  // A nested rule's selector, made whole: `&` is its parent; without one, it's a descendant of it.
  const nest = (sel: string, parent: string) =>
    splitList(sel)
      .map((part) => (part.includes('&') ? part.replace(/&/g, `:is(${parent})`) : `:is(${parent}) ${part.trim()}`))
      .join(', ')
  const styleRules: { sel: string; style: CSSStyleDeclaration }[] = []
  const keyframeRules: CSSKeyframesRule[] = []
  const collect = (rules: CSSRuleList, parent = '') => {
    for (const r of Array.from(rules)) {
      if (r instanceof win.CSSStyleRule) {
        const sel = parent ? nest(r.selectorText, parent) : r.selectorText
        if (HOVER.test(sel)) styleRules.push({ sel, style: r.style })
        if (r.cssRules?.length) collect(r.cssRules, sel)
      } else if (r instanceof win.CSSKeyframesRule) keyframeRules.push(r)
      else if (r instanceof win.CSSMediaRule) {
        if (win.matchMedia(r.conditionText).matches) collect(r.cssRules, parent)
      } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) collect((r as CSSGroupingRule).cssRules, parent)
    }
  }
  for (const s of sheets) {
    try {
      collect(s.cssRules)
    } catch {
      /* ignore */
    }
  }

  const resolveVars = (value: string, el: Element, depth = 0): string => {
    if (!value.includes('var(') || depth > 6) return value
    const cs = win.getComputedStyle(el)
    const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name: string, fb?: string) => cs.getPropertyValue(name).trim() || (fb ?? '').trim())
    return resolveVars(out, el, depth + 1)
  }
  const declsOf = (style: CSSStyleDeclaration, el: Element): Decls => {
    const d: Decls = {}
    for (let i = 0; i < style.length; i++) {
      const p = style[i]
      if (p.startsWith('--') || p.startsWith('transition') || p.startsWith('animation')) continue
      const v = style.getPropertyValue(p).trim()
      if (!v || v === 'initial' || v === 'unset' || v === 'inherit' || v === 'revert') continue
      d[p] = normColors(resolveVars(v, el))
    }
    return d
  }

  // ---- the walk ----
  // Let entrance animations land and park looping ones, so we read the at-rest state.
  const parked: Animation[] = []
  try {
    for (const a of root.getAnimations({ subtree: true })) {
      const iters = a.effect?.getComputedTiming().iterations
      if (iters === Infinity) {
        a.cancel()
        parked.push(a)
      } else {
        try {
          a.finish()
        } catch {
          /* not finishable */
        }
      }
    }
  } catch {
    /* getAnimations unsupported */
  }

  const base = root.getBoundingClientRect()
  let nextId = 0
  const els: [Element, SnapEl][] = []

  const pseudo = (el: Element, which: '::before' | '::after', own: CSSStyleDeclaration): Decls | undefined => {
    const cs = win.getComputedStyle(el, which)
    const content = cs.getPropertyValue('content')
    if (!content || content === 'none' || content === 'normal' || cs.getPropertyValue('display') === 'none') return
    const d: Decls = { content }
    const span = defaults.span
    for (const p of PROPS) {
      const v = normColors(cs.getPropertyValue(p))
      const ref = INHERITED.includes(p) ? normColors(own.getPropertyValue(p)) : span[p]
      if (v !== ref) d[p] = v
    }
    return d
  }

  const svgMarkup = (svg: SVGSVGElement): string => {
    const clone = svg.cloneNode(true) as SVGSVGElement
    // Sprites: inline what <use> points at.
    for (const use of Array.from(clone.querySelectorAll('use'))) {
      const ref = use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? ''
      const target = ref.startsWith('#') ? doc.getElementById(ref.slice(1)) : null
      if (!target) {
        use.remove()
        continue
      }
      const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
      for (const k of Array.from(target.childNodes)) g.appendChild(k.cloneNode(true))
      if (target.tagName.toLowerCase() === 'symbol' && target.getAttribute('viewBox') && !clone.getAttribute('viewBox')) clone.setAttribute('viewBox', target.getAttribute('viewBox')!)
      use.replaceWith(g)
    }
    // Computed fill/stroke onto the shapes, so icons styled from CSS keep their look.
    const live = [svg, ...Array.from(svg.querySelectorAll('*'))]
    const copy = [clone, ...Array.from(clone.querySelectorAll('*'))]
    if (live.length === copy.length) {
      live.forEach((l, i) => {
        const c = copy[i]
        if (!/^(path|circle|rect|line|polyline|polygon|ellipse|svg|g|text)$/i.test(l.tagName)) return
        const cs = win.getComputedStyle(l)
        const up = i > 0 && l.parentElement ? win.getComputedStyle(l.parentElement) : null
        for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
          const v = cs.getPropertyValue(p)
          // Only what the shape doesn't already inherit from its parent.
          if (v && !c.getAttribute(p) && (!up || up.getPropertyValue(p) !== v)) c.setAttribute(p, normColors(v).replace(/^([\d.]+)px$/, '$1'))
        }
      })
    }
    const r = svg.getBoundingClientRect()
    if (!clone.getAttribute('width')) clone.setAttribute('width', String(Math.round(r.width)))
    if (!clone.getAttribute('height')) clone.setAttribute('height', String(Math.round(r.height)))
    for (const n of Array.from(clone.querySelectorAll('script, foreignObject, image'))) n.remove()
    return clone.outerHTML
  }

  const walk = (el: Element, parentCs: CSSStyleDeclaration | null, inDetails: boolean): SnapEl | null => {
    const tag = el.tagName.toLowerCase()
    if (SKIP.has(tag)) return null
    const ns: 'html' | 'svg' = el.namespaceURI === 'http://www.w3.org/2000/svg' ? 'svg' : 'html'
    const cs = win.getComputedStyle(el)
    if (cs.display === 'none' && tag !== 'summary') return null
    const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' && !inDetails && el !== root) return null
    defaultsFor(tag, ns)
    const def = defaults[tag]

    const style: Decls = {}
    for (const p of PROPS) {
      const v = normColors(cs.getPropertyValue(p))
      if (INHERITED.includes(p)) {
        if (!parentCs || v !== normColors(parentCs.getPropertyValue(p)) || def[p] !== defaults.div[p]) style[p] = v
      } else if (v !== def[p]) style[p] = v
    }
    const node: SnapEl = {
      t: 'el',
      id: nextId++,
      tag,
      ns,
      attrs: Array.from(el.attributes)
        .filter((a) => KEEP_ATTRS.test(a.name))
        .map((a) => [a.name, a.value] as [string, string]),
      style,
      rect: [r.x - base.x, r.y - base.y, r.width, r.height].map((n) => Math.round(n * 10) / 10) as SnapEl['rect'],
      kids: [],
    }
    els.push([el, node])
    const before = pseudo(el, '::before', cs)
    const after = pseudo(el, '::after', cs)
    if (before) node.before = before
    if (after) node.after = after

    if (tag === 'svg') {
      node.svg = svgMarkup(el as SVGSVGElement)
      return node
    }
    if (MEDIA.has(tag)) {
      const img = (tag === 'picture' ? el.querySelector('img') : el) as HTMLImageElement & HTMLVideoElement
      node.media = {
        kind: tag,
        alt: img?.getAttribute?.('alt') ?? el.getAttribute('title') ?? el.getAttribute('aria-label') ?? '',
        w: img?.naturalWidth || img?.videoWidth || Math.round(r.width),
        h: img?.naturalHeight || img?.videoHeight || Math.round(r.height),
      }
      return node
    }
    const kids: SnapNode[] = []
    for (const k of Array.from(el.childNodes)) {
      if (k.nodeType === 3) kids.push({ t: 'text', v: k.textContent ?? '' })
      else if (k.nodeType === 1) {
        const s = walk(k as Element, cs, inDetails || tag === 'details')
        if (s) kids.push(s)
      }
    }
    node.kids = kids
    return node
  }

  const ctxCs = root.parentElement ? win.getComputedStyle(root.parentElement) : null
  const snapRoot = walk(root, null, false)!

  // Hover rules, matched against the elements we kept.
  for (const rule of styleRules) {
    for (const sel of splitList(rule.sel)) {
      const s = sel.trim()
      if (!HOVER.test(s)) continue
      const plain = s.replace(HOVER_ALL, '').trim()
      // A bare `:hover` would match everything.
      if (!plain || plain === '*') continue
      // Where the :hover sits: on the element itself (last compound) or on an ancestor.
      const compounds = s.split(/\s*(?:[>+~]|\s)\s*(?![^(]*\))/).filter(Boolean)
      const last = compounds[compounds.length - 1] ?? ''
      const self = HOVER.test(last)
      for (const [el, node] of els) {
        let matches = false
        try {
          matches = el.matches(plain)
        } catch {
          break
        }
        if (!matches) continue
        const decls = declsOf(rule.style, el)
        if (!Object.keys(decls).length) continue
        if (self) node.hover = { ...node.hover, ...decls }
        else {
          const ownerSel = compounds.filter((c) => HOVER.test(c)).pop()!.replace(HOVER_ALL, '') || '*'
          let owner: Element | null = null
          try {
            owner = el.parentElement?.closest(ownerSel) ?? null
          } catch {
            owner = null
          }
          const ownerNode = owner && els.find(([e]) => e === owner)?.[1]
          if (ownerNode) (ownerNode.groupHover ??= []).push({ target: node.id, decls })
        }
      }
    }
  }

  // Keyframes the section's animations use.
  const used = new Set<string>()
  for (const [, n] of els) for (const name of (n.style['animation-name'] ?? '').split(',')) if (name.trim() && name.trim() !== 'none') used.add(name.trim())
  for (const p of parked) {
    const name = (p as CSSAnimation).animationName
    if (name) used.add(name)
  }
  const keyframes: Record<string, Keyframe[]> = {}
  for (const k of keyframeRules) {
    if (!used.has(k.name)) continue
    keyframes[k.name] = Array.from(k.cssRules).map((f) => ({ key: (f as CSSKeyframeRule).keyText, decls: declsOf((f as CSSKeyframeRule).style, root) }))
  }

  // Put looping animations back.
  for (const a of parked) {
    try {
      a.play()
    } catch {
      /* ignore */
    }
  }
  frame.remove()

  // The background the section sits on.
  let bg = 'rgba(255, 255, 255, 1)'
  for (let p: Element | null = root.parentElement; p; p = p.parentElement) {
    const c = rgbaOf(win.getComputedStyle(p).backgroundColor)
    if (!/, 0\)$/.test(c)) {
      bg = c
      break
    }
  }

  const cssPath = (el: Element): string => {
    const parts: string[] = []
    for (let e: Element | null = el; e && e !== doc.body && parts.length < 4; e = e.parentElement) {
      if (e.id && !/\d{3,}/.test(e.id)) {
        parts.unshift(`${e.tagName.toLowerCase()}#${e.id}`)
        break
      }
      const cls = Array.from(e.classList).filter((c) => /^[a-z][\w-]*$/i.test(c) && c.length < 30).slice(0, 2)
      parts.unshift(e.tagName.toLowerCase() + cls.map((c) => '.' + c).join(''))
    }
    return parts.join(' > ')
  }

  return {
    version: 1,
    url: doc.location?.href ?? '',
    title: doc.title,
    siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? undefined,
    viewport: { width: win.innerWidth, height: win.innerHeight },
    capturedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    selector: cssPath(root),
    root: snapRoot,
    context: {
      bg,
      color: rgbaOf(ctxCs?.color ?? 'rgb(0, 0, 0)'),
      fontFamily: ctxCs?.fontFamily ?? '',
      fontSize: ctxCs?.fontSize ?? '16px',
    },
    defaults,
    keyframes,
    fontLinks: Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))
      .map((l) => (l as HTMLLinkElement).href)
      .filter((h) => /fonts\.googleapis\.com|fontshare\.com|fontsource/.test(h)),
    notes,
  }
}

/** Stylesheets the page can't read from script (cross-origin without CORS); the extension fetches these. */
export function blockedSheetHrefs(doc: Document): string[] {
  const out: string[] = []
  for (const s of Array.from(doc.styleSheets)) {
    try {
      void s.cssRules
    } catch {
      if (s.href) out.push(s.href)
    }
  }
  return out
}
