// Snapshot → clip: the pure half of the capture extension. Everything here runs
// anywhere (extension panel, tests, scripts); only snapshot.ts touches a live page.

import type { LintIssue, Rhythm, SectionType, Source, TokenSet } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { lintClip } from '@/core/lint'
import { identifyIconSet } from '@/core/icons'
import { serialize } from '@/core/html/serialize'
import type { HEl, HNode } from '@/core/html/parse'
import { allEls, buildTree, els, hint, isEl, leavesOf, type WEl } from './tree'
import { describeLook, inferTokens } from './tokens'
import { shape } from './structure'
import { annotate } from './semantics'
import { cleanTree } from './clean'
import { normalize } from './normalize'
import { buildCss, TokenWriter } from './css'
import { buildMotion } from './motion'
import type { Snapshot } from './types'

export type { Snapshot } from './types'

export interface CaptureOptions {
  type: SectionType
  /** Source id (folder prefix); defaults to the site's name from its hostname. */
  sourceId?: string
  /** Variant (the folder's second half); defaults to the section's rhythm. */
  variant?: string
}

export interface ClipMeta {
  title: string
  layoutPattern: string
  rhythm: Rhythm
  motionNotes?: string
  capture: { path: string; selector: string; viewport: { width: number; height: number }; capturedAt: string }
  tokens: Partial<TokenSet>
  notes?: string[]
}

export interface CaptureResult {
  type: SectionType
  sourceId: string
  folder: string
  rootClass: string
  html: string
  css: string
  motionCss: string | null
  meta: ClipMeta
  source: Source
  /** Lint results for the clip (core/lint.ts), with the rule each one breaks. */
  issues: (LintIssue & { rule?: number })[]
  /** What capture changed or couldn't keep. */
  notes: string[]
  /** Repo-relative paths → contents: drop into the Blokmix repo as-is. */
  files: Record<string, string>
}

const ROOT_TAGS = new Set(['section', 'header', 'footer', 'nav'])

/** A source id from a URL: "https://www.acme.example/pricing" → "acme". No hyphens (folders split on them). */
export function sourceIdFor(url: string, fallback = 'site'): string {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    /* not a URL */
  }
  const labels = host.split('.').filter((l) => l && !/^(www|app|m|web|en|home)$/.test(l))
  const tld2 = labels.length >= 3 && /^(co|com|org|net|ac|gov)$/.test(labels[labels.length - 2])
  const name = labels.length >= 2 ? labels[labels.length - (tld2 ? 3 : 2)] : labels[0] ?? ''
  const id = (name || fallback).toLowerCase().replace(/[^a-z0-9]/g, '')
  return id === 'layout' ? 'layoutsite' : id || 'site'
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clip'

export function captureClip(snap: Snapshot, opts: CaptureOptions): CaptureResult {
  const notes: string[] = [...snap.notes]
  const type = opts.type
  let host = ''
  try {
    host = new URL(snap.url).hostname.replace(/^www\./, '')
  } catch {
    host = 'the page'
  }
  const sourceId = slug(opts.sourceId ?? sourceIdFor(snap.url)).replace(/-/g, '')
  const siteName = snap.siteName || sourceId.charAt(0).toUpperCase() + sourceId.slice(1)

  let root = buildTree(snap)
  notes.push(...cleanTree(root).notes)
  const inferred = inferTokens(root, snap)
  notes.push(...inferred.notes)
  const shaped = shape(root)
  notes.push(...shaped.notes)
  root = rootFor(root, type, snap)
  const ann = annotate(root, type, { siteName })
  notes.push(...ann.notes)
  notes.push(...normalize(root, type).notes)

  const rhythm = rhythmOf(root, type)
  const variant = slug(opts.variant ?? rhythm)
  const folder = `${sourceId}-${variant}`
  const rootClass = `mx-${type}-${folder}`

  // Icon set, from the icons we could name.
  const named = allEls(root).filter((e) => e.icon && e.svgNode)
  const iconSvgs = named.map((e) => serialize([e.svgNode!], 'html'))
  const iconSet = identifyIconSet(iconSvgs)
  const tokens: TokenSet = { ...inferred.tokens, 'icon.set': iconSet?.set ?? '' }
  if (shaped.icons.unnamed) notes.push(`${shaped.icons.unnamed} icon${shaped.icons.unnamed > 1 ? 's' : ''} couldn’t be named, so ${shaped.icons.unnamed > 1 ? 'they keep' : 'it keeps'} the site’s own drawing in every style`)

  const w = new TokenWriter(tokens, inferred.palette, inferred.families, snap.viewport)
  const moving = new Set(allEls(root).filter((e) => (e.s['animation-name'] ?? 'none') !== 'none' || (e.s['transition-duration'] ?? '0s').split(',').some((d) => parseFloat(d) > 0)))
  const cssRes = buildCss(root, rootClass, w, snap.defaults, type, moving)
  notes.push(...cssRes.notes)
  const hoverProps = (el: WEl) => Object.keys(el.hover ?? {}).filter((k) => !/^(transition|animation|cursor)/.test(k)).map((k) => k.replace(/^border-(top|right|bottom|left)-color$/, 'border-color')).filter((k, i, a) => a.indexOf(k) === i)
  const motion = buildMotion(root, rootClass, w, snap.keyframes, hoverProps)

  const html = serialize([toHtml(root, type, rootClass)], 'html') + '\n'
  const id = `${type}.${folder}`
  const issues = lintClip({ id, type, rootClass, html, css: cssRes.css, motionCss: motion.css }).map((i) => ({ ...i, rule: ruleOf(i.message) }))

  const clipTokens: Partial<TokenSet> = { ...tokens }
  if (!clipTokens['icon.set']) delete clipTokens['icon.set']
  let path = '/'
  try {
    path = new URL(snap.url).pathname || '/'
  } catch {
    /* keep / */
  }
  const meta: ClipMeta = {
    title: `${TYPE_LABEL[type]} clipped from ${host}`,
    layoutPattern: layoutPattern(root, rhythm),
    rhythm,
    ...(motion.notes ? { motionNotes: motion.notes } : {}),
    capture: { path, selector: snap.selector, viewport: snap.viewport, capturedAt: snap.capturedAt },
    tokens: clipTokens,
    ...(notes.length ? { notes } : {}),
  }
  let origin = 'https://example.com/'
  try {
    origin = new URL(snap.url).origin + '/'
  } catch {
    /* keep */
  }
  const sourceTokens = { ...clipTokens } as TokenSet
  const source: Source = {
    id: sourceId,
    kind: 'site',
    name: siteName,
    url: origin,
    personality: describeLook(tokens, host),
    tokens: sourceTokens,
    fonts: inferred.fonts,
  }
  const dir = `samples/clips/${type}/${folder}`
  const files: Record<string, string> = {
    [`${dir}/clip.html`]: html,
    [`${dir}/clip.css`]: cssRes.css,
    [`${dir}/clip.json`]: JSON.stringify(meta, null, 2) + '\n',
    [`samples/sources/${sourceId}.json`]: JSON.stringify(source, null, 2) + '\n',
  }
  if (motion.css) files[`${dir}/motion.css`] = motion.css
  return { type, sourceId, folder, rootClass, html, css: cssRes.css, motionCss: motion.css, meta, source, issues, notes, files }
}

/** The clip's root: the picked element itself when it spans the page, else a full-width section around it. */
function rootFor(picked: WEl, type: SectionType, snap: Snapshot): WEl {
  const want = type === 'nav' ? (picked.tag === 'header' ? 'header' : 'nav') : type === 'footer' ? 'footer' : ROOT_TAGS.has(picked.tag) && picked.tag !== 'nav' && picked.tag !== 'footer' ? picked.tag : 'section'
  if (picked.rect[2] >= snap.viewport.width * 0.9 || type === 'nav') {
    picked.tag = want
    return picked
  }
  const s: Record<string, string> = {}
  for (const [k, v] of Object.entries(snap.defaults.div ?? {})) s[k] = v
  for (const k of ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'font-style', 'text-transform', 'white-space']) s[k] = picked.s[k]
  const wrap: WEl = {
    t: 'el',
    id: -2,
    tag: want,
    ns: 'html',
    hints: [],
    s,
    def: snap.defaults.div ?? {},
    rect: [0, 0, snap.viewport.width, picked.rect[3]],
    parent: null,
    kids: [picked],
    extra: { 'padding-inline': 'var(--mx-space-6)' },
  }
  picked.parent = wrap
  // It was centred in the page: keep it centred and capped at its width.
  picked.extra = { ...picked.extra, 'margin-inline': 'auto', 'max-width': `${Math.round(picked.rect[2])}px` }
  return wrap
}

function rhythmOf(root: WEl, type: SectionType): Rhythm {
  if (type === 'nav') return 'band'
  const [, , W, H] = root.rect
  if (H < 220 && W > 600) return 'band'
  const list = allEls(root).find((e) => e.block === 'list' && e.list !== 'links')
  const items = list ? els(list).filter((e) => e.block === 'item') : []
  const cols = new Set(items.map((i) => Math.round(i.rect[0] / 20))).size
  if (items.length >= 3 && cols >= 2) return 'grid'
  const split = allEls(root).some((e) => {
    const ks = els(e).filter((k) => k.rect[3] > 80 && k.rect[2] > W * 0.28)
    return ks.length === 2 && Math.abs(ks[0].rect[1] - ks[1].rect[1]) < 80 && ks[1].rect[0] > ks[0].rect[0] + ks[0].rect[2] - 4
  })
  if (split) return 'split'
  if (items.length >= 2) return 'stack'
  const heading = leavesOf(root).find((l) => l.block === 'heading')
  if (heading && /center/.test(heading.s['text-align'] ?? '')) return 'centered'
  return 'stack'
}

function layoutPattern(root: WEl, rhythm: Rhythm): string {
  if (rhythm === 'grid') {
    const list = allEls(root).find((e) => e.block === 'list' && e.list !== 'links')
    const items = list ? els(list).filter((e) => e.block === 'item') : []
    const first = items[0]?.rect[1]
    const cols = items.filter((i) => Math.abs(i.rect[1] - first) < 8).length
    return `grid-${cols}col`
  }
  return { split: 'split-2col', band: 'band-row', centered: 'centered-stack', stack: 'stack' }[rhythm]
}

const KEEP = /^(aria-[\w-]+|role|type|name|placeholder|required|autocomplete|rows|open|checked|value|for|id)$/

/** The working tree as clip markup. */
function toHtml(el: WEl, type: SectionType, rootClass: string, isRoot = true): HEl {
  const attrs: [string, string][] = []
  const cls = isRoot ? rootClass : el.cls
  if (cls) attrs.push(['class', cls])
  if (isRoot) attrs.push(['data-mx-section', type])
  if (el.tag === 'a') attrs.push(['href', '#'])
  if (el.tag === 'button' && !hint(el, 'type')) attrs.push(['type', 'button'])
  for (const [k, v] of el.hints) {
    if (!KEEP.test(k)) continue
    // ids and `for` only matter to inputs and labels (radio tabs, :has() toggles).
    if ((k === 'id' || k === 'for') && !/^(input|label)$/.test(el.tag)) continue
    if (k === 'value' && el.tag !== 'input') continue
    if (k === 'role' && /^(presentation|none)$/.test(v)) continue
    // Script-driven state means nothing in a clip: <details> keeps its own.
    if (k === 'aria-controls' || k === 'aria-expanded' || (k === 'type' && el.tag === 'summary')) continue
    attrs.push([k, v])
  }
  if (el.synthetic === 'art' || el.synthetic === 'wordmark') {
    if (!attrs.some(([k]) => k === 'aria-hidden') && el.synthetic === 'art') attrs.push(['aria-hidden', 'true'])
  }
  const mark = (k: string, v: string | undefined) => v !== undefined && attrs.push([k, v])
  mark('data-mx-block', el.block)
  if (el.block === 'item' || el.block === 'card') mark('data-mx-label', el.label)
  if (el.block === 'list') mark('data-mx-list', el.list)
  if (el.block === 'image') {
    mark('data-mx-media', el.mediaName ?? 'image')
    mark('data-mx-ratio', el.ratio ?? '4/3')
  }
  mark('data-mx-field', el.field)
  mark('data-mx-mirror', el.mirror)

  if (el.svgNode) {
    const svgAttrs = el.svgNode.attrs.filter(([k]) => !/^(width|height|class)$/.test(k))
    const [, , w, h] = el.rect
    if (w > 0 && h > 0) svgAttrs.push(['width', String(Math.round(w))], ['height', String(Math.round(h))])
    const own = attrs.filter(([k]) => k === 'class' || k.startsWith('data-mx-'))
    if (el.icon) own.push(['data-mx-icon', el.icon])
    return { ...el.svgNode, attrs: [...own, ...svgAttrs] }
  }
  let kids: HNode[]
  if (el.text !== undefined) kids = [{ t: 'text', v: el.text }]
  else if (el.synthetic === 'art') kids = el.backdrop ? [] : [placeholderArt(el.ratio)]
  else kids = el.kids.filter(isEl).map((k) => toHtml(k, type, rootClass, false))
  const tag = el.tag === 'img' ? 'div' : el.tag
  return { t: 'el', tag, ns: 'html', attrs, kids }
}

/**
 * Stand-in art for a picture (CLAUDE.md, rule 5): a small landscape glyph centred in the
 * picture's own shape, so it reads as "an image goes here" at any size without filling it.
 */
function placeholderArt(ratio = '4/3'): HEl {
  const [rw, rh] = ratio.split('/').map(Number)
  const r = rw > 0 && rh > 0 ? rw / rh : 4 / 3
  // The short side is 100 units; the glyph is a fifth of it.
  const [W, H] = r >= 1 ? [Math.round(100 * r), 100] : [100, Math.round(100 / r)]
  const g = 20
  const x = (W - g * 1.3) / 2
  const y = (H - g) / 2
  const n = (v: number) => String(Math.round(v * 10) / 10)
  const a = (tag: string, attrs: [string, string][]): HEl => ({ t: 'el', tag, ns: 'svg', attrs, kids: [] })
  return {
    t: 'el',
    tag: 'svg',
    ns: 'svg',
    attrs: [
      ['viewBox', `0 0 ${W} ${H}`],
      ['width', '100%'],
      ['height', '100%'],
      ['preserveAspectRatio', 'xMidYMid meet'],
      ['fill', 'currentColor'],
      ['aria-hidden', 'true'],
    ],
    kids: [
      a('circle', [['cx', n(x + g * 0.95)], ['cy', n(y + g * 0.28)], ['r', n(g * 0.13)]]),
      a('path', [['d', `M${n(x)} ${n(y + g)} L${n(x + g * 0.42)} ${n(y + g * 0.45)} L${n(x + g * 0.68)} ${n(y + g * 0.75)} L${n(x + g * 0.92)} ${n(y + g * 0.52)} L${n(x + g * 1.3)} ${n(y + g)} Z`]]),
    ],
  }
}

/** Which CLAUDE.md clip rule a lint message is about. */
export function ruleOf(message: string): number | undefined {
  const table: [RegExp, number][] = [
    [/root|exactly one root|data-mx-section/i, 1],
    [/top-level|unbalanced/i, 2],
    [/hex|color function|font-family|fixed width|stroke/i, 3],
    [/vh/i, 4],
    [/style=|script|event handler|raster|Links should/i, 5],
    [/transition: all|scale\(0\)|ease-in/i, 6],
    [/mirror|field/i, 8],
    [/icon name|data-mx-icon/i, 14],
    [/block|item|list|media/i, 13],
  ]
  return table.find(([re]) => re.test(message))?.[1]
}

export { sourceIdFor as sourceId }
