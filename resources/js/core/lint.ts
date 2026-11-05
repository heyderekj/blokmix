import type { LintIssue, SectionType } from './types'
import { SECTION_TYPES } from './types'
import { FIELD_SCHEMA } from './content'
import { attr, parseHtml, walk } from './html/parse'
import { lintBlocks } from './blocks'
import { ICON_NAMES } from './icons'
import { viewportWidthRules } from './containerize'

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
    const icon = attr(n, 'data-mx-icon')
    if (icon !== undefined) {
      if (n.tag !== 'svg') err(`data-mx-icon belongs on an <svg> (found it on <${n.tag}>)`)
      else if (!ICON_NAMES.includes(icon)) err(`Unknown icon name "${icon}"; use one from core/icons.ts (ICON_NAMES)`)
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

/**
 * A UI mockup (samples/mocks/<id>) follows the clip rules that keep re-theming
 * and the exporters reliable: one root, CSS nested under it, tokens only, no
 * scripts, inline styles or images. It has no fields or blocks: its words are
 * static illustration.
 */
export function lintMock(input: { id: string; html: string; css: string }): LintIssue[] {
  const issues: LintIssue[] = []
  const clipId = `mock.${input.id}`
  const err = (message: string) => issues.push({ clipId, level: 'error', message })
  const warn = (message: string) => issues.push({ clipId, level: 'warn', message })
  const rootClass = `mx-mock-${input.id}`
  const tree = parseHtml(input.html).filter((n) => !(n.t === 'text' && !n.v.trim()))
  if (tree.length !== 1 || tree[0].t !== 'el') err('HTML must have exactly one root element')
  else {
    const root = tree[0]
    if (!(attr(root, 'class') ?? '').split(/\s+/).includes(rootClass)) err(`Root needs class="${rootClass}"`)
    if (attr(root, 'data-mx-mock') !== input.id) err(`Root needs data-mx-mock="${input.id}"`)
  }
  walk(tree, (n) => {
    if (n.t !== 'el') return
    if (n.tag === 'script' || n.tag === 'img' || n.tag === 'iframe') err(`No <${n.tag}> in a mockup`)
    for (const [k] of n.attrs) {
      if (k === 'style') err(`No style="" attributes (on <${n.tag}>)`)
      if (/^on/i.test(k)) err(`No event handler attributes (${k})`)
      if (k === 'data-mx-field' || k === 'data-mx-block') err(`Mockups have no ${k}: their words are illustration`)
    }
  })
  if (/[{}]/.test(input.html.replace(/<[^>]*>/g, ''))) err('No { } in text (JSX)')
  checkCss(input.css, 'mock.css', rootClass, err, warn)
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
  // Responsive rules answer to the section, so a layout fits wherever it sits (core/containerize.ts).
  const viewport = viewportWidthRules(raw)
  if (viewport) warn(`${file}: ${viewport} width breakpoint${viewport > 1 ? 's' : ''} on the viewport; use @container (max-width: …) for what's inside the section`)
  if (/(^|[;{\s])max-width\s*:\s*(1200|760)px\s*[;}]/.test(css)) warn(`${file}: fixed content width; use var(--mx-width-content) or var(--mx-width-text)`)
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

const isLogoBlock = (media: string | undefined) => !!media && /^logo/i.test(media)

/** Section types whose built-in layouts are bare: structure only, with every look left to the skin. More join as they convert. */
export const BARE_TYPES: readonly SectionType[] = SECTION_TYPES

/**
 * A bare layout is a wireframe: grid, spacing, type roles, hairlines, working interactions. Accents, gradients, shadows,
 * tilts, decorative layers, its own motion and art inside pictures all belong to the skin.
 */
export function lintBones(input: { html: string; css: string; motionCss: string | null }): string[] {
  const out: string[] = []
  const css = stripComments(input.css)
  if (input.motionCss) out.push('has its own motion.css; motion comes from the skin')
  if (/--mx-color-accent/.test(css)) out.push('uses the accent color')
  if (/(linear|radial|conic)-gradient\(|--mx-gradient/.test(css)) out.push('has a gradient')
  if (/--mx-(shadow|glow|grain|glass)/.test(css)) out.push('uses an effect or shadow')
  for (const m of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) if (!/^inset 0 0 0 (var\(--mx-stroke\)|calc\(var\(--mx-stroke\))/.test(m[1].trim()) && m[1].trim() !== 'none') out.push(`has a shadow (${m[1].trim()}); only an inset hairline is fine`)
  if (/\b(rotate|skew)[XYZ]?\(|(^|[;{\s])rotate\s*:/.test(css)) out.push('tilts something')
  if (/text-shadow\s*:/.test(css)) out.push('has a text shadow')
  if (/:hover[^{]*\{[^}]*\b(transform|translate)\s*:/.test(css)) out.push('lifts on hover; leave that to the skin')
  if (/\b(backdrop-)?filter\s*:|mix-blend-mode/.test(css)) out.push('has a filter or blend')
  if (/::(before|after)/.test(css)) out.push('has a ::before or ::after; make it real markup or leave it to the skin')
  if (/max-width\s*:\s*\d{4,}px/.test(css)) out.push('has a fixed container width; use var(--mx-width-content)')
  const visit = (n: ReturnType<typeof parseHtml>[number]) => {
    if (n.t !== 'el') return
    if (n.attrs.some(([k, v]) => k === 'data-mx-block' && v === 'image')) {
      const inside = n.kids.filter((k) => k.t === 'el')
      // A logo is the brand's name, not a picture: its wordmark stays.
      if (isLogoBlock(n.attrs.find(([k]) => k === 'data-mx-media')?.[1])) return
      if (inside.some((k) => k.t === 'el' && k.tag !== 'svg')) out.push(`picture ${n.attrs.find(([k]) => k === 'data-mx-media')?.[1] ?? ''} holds art; only the wireframe cross (svg.x) belongs inside`.replace('  ', ' '))
      return
    }
    n.kids.forEach(visit)
  }
  parseHtml(input.html).forEach(visit)
  return [...new Set(out)]
}
