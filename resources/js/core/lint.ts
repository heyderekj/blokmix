import type { LintIssue, SectionType } from './types'
import { FIELD_SCHEMA } from './content'
import { attr, parseHtml, walk } from './html/parse'
import { lintBlocks } from './blocks'

const ROOT_TAGS = new Set(['section', 'header', 'footer', 'nav'])

/**
 * Enforces the clip authoring rules (see CLAUDE.md) that keep re-theming,
 * content swapping and the Astro/Next exporters reliable.
 */
export function lintClip(input: {
  id: string
  type: SectionType
  rootClass: string
  html: string
  css: string
  motionCss: string | null
}): LintIssue[] {
  const issues: LintIssue[] = []
  const err = (message: string) => issues.push({ clipId: input.id, level: 'error', message })
  const warn = (message: string) => issues.push({ clipId: input.id, level: 'warn', message })

  // ---- HTML ----
  const tree = parseHtml(input.html).filter((n) => !(n.t === 'text' && !n.v.trim()))
  if (tree.length !== 1 || tree[0].t !== 'el') err('HTML must have exactly one root element')
  else {
    const root = tree[0]
    if (!ROOT_TAGS.has(root.tag)) err(`Root must be section/header/footer/nav, got <${root.tag}>`)
    const cls = (attr(root, 'class') ?? '').split(/\s+/)
    if (!cls.includes(input.rootClass)) err(`Root needs class="${input.rootClass}"`)
    if (attr(root, 'data-mx-section') !== input.type) err(`Root needs data-mx-section="${input.type}"`)
  }

  const allowed = new Set(FIELD_SCHEMA[input.type])
  const seen = new Set<string>()
  walk(tree, (n) => {
    if (n.t !== 'el') return
    if (n.tag === 'script') err('No <script> tags (motion must be CSS-only)')
    if (n.tag === 'img') {
      const src = attr(n, 'src') ?? ''
      if (!src.startsWith('data:image/svg')) err('No raster images; use inline SVG or CSS art')
    }
    for (const [k] of n.attrs) {
      if (k === 'style') err(`No style="" attributes (on <${n.tag}>)`)
      if (/^on/i.test(k)) err(`No event handler attributes (${k})`)
    }
    const field = attr(n, 'data-mx-field')
    if (field) {
      if (!allowed.has(field)) err(`Unknown field "${field}" for ${input.type}`)
      if (seen.has(field)) err(`Field "${field}" is used twice`)
      seen.add(field)
      if (n.kids.some((k) => k.t === 'el')) err(`Field "${field}" must be on a leaf text element`)
    }
    const mirror = attr(n, 'data-mx-mirror')
    if (mirror) {
      if (!allowed.has(mirror)) err(`Mirror of unknown field "${mirror}"`)
      if (n.kids.some((k) => k.t === 'el')) err(`Mirror "${mirror}" must be on a leaf text element`)
    }
    const href = attr(n, 'href')
    if (n.tag === 'a' && href && href !== '#' && !href.startsWith('#')) warn(`Links should use href="#" (found ${href})`)
  })

  const blocks = lintBlocks(tree)
  blocks.errors.forEach(err)
  blocks.warnings.forEach(warn)

  // ---- CSS ----
  checkCss(input.css, 'clip.css', input.rootClass, err, warn)
  if (input.motionCss) checkCss(input.motionCss, 'motion.css', input.rootClass, err, warn)

  return issues
}

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function checkCss(
  raw: string,
  file: string,
  rootClass: string,
  err: (m: string) => void,
  warn: (m: string) => void,
) {
  const css = stripComments(raw)
  if (/#[0-9a-f]{3,8}\b/i.test(css)) err(`${file}: raw hex color; use var(--mx-color-*)`)
  if (/\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i.test(css)) err(`${file}: raw color function; use tokens + color-mix()`)
  if (/[\d.]\s*(s|d|l)?vh\b/.test(css)) err(`${file}: no vh units; use calc(var(--mx-vh) * N)`)
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim()
    if (!v.startsWith('var(--mx-font-') && v !== 'inherit') err(`${file}: font-family must come from var(--mx-font-*)`)
  }
  if (/!important/.test(css)) warn(`${file}: avoid !important`)
  // Line weight follows the style guide: borders are var(--mx-stroke) or calc() multiples of it.
  for (const m of css.matchAll(/(?<![\w-])(border(?:-(?:top|bottom|left|right|block|inline)(?:-(?:start|end))?)?(?:-width)?)\s*:\s*([^;{}]*)/g))
    if (/\d*\.?\d+px/.test(m[2])) err(`${file}: ${m[1]} uses a fixed width; use var(--mx-stroke) (or calc(var(--mx-stroke) * n))`)
  // Motion craft: name what animates, never pop from nothing, never ease in.
  if (/transition\s*:\s*all\b/.test(css)) warn(`${file}: transition: all; list the properties that change`)
  if (/scale\(\s*0\s*[,)]/.test(css)) warn(`${file}: scale(0); start from about scale(0.95) with opacity 0`)
  if (/\bease-in\b(?!-)/.test(css)) warn(`${file}: ease-in feels sluggish in UI; use ease-out (var(--mx-motion-ease))`)

  // Top-level statements must be the root selector or prefixed keyframes.
  let depth = 0
  let buf = ''
  for (const ch of css) {
    if (ch === '{') {
      if (depth === 0) {
        const sel = buf.trim()
        const okRoot = sel === `.${rootClass}`
        const okKeyframes = new RegExp(`^@keyframes\\s+${rootClass}-[\\w-]+$`).test(sel)
        const okMedia = /^@media\b/.test(sel)
        if (!okRoot && !okKeyframes && !okMedia) err(`${file}: top-level "${sel}" must be .${rootClass} or @keyframes ${rootClass}-*`)
      }
      depth++
      buf = ''
    } else if (ch === '}') {
      depth--
      buf = ''
    } else if (ch === ';' && depth === 0) {
      buf = ''
    } else buf += ch
  }
  if (depth !== 0) err(`${file}: unbalanced braces`)
}
