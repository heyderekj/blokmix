import type { CssVars, FontSource, TokenGroup, TokenKey, TokenSet } from './types'
import { LIBRARY_FONTS } from './fonts'
import { TOKEN_KEYS } from './types'

export const TOKEN_GROUP_OF: Record<TokenKey, TokenGroup> = {
  'color.bg': 'color',
  'color.surface': 'color',
  'color.text': 'color',
  'color.muted': 'color',
  'color.border': 'color',
  'color.primary': 'color',
  'color.onPrimary': 'color',
  'color.accent': 'color',
  'font.display': 'type',
  'font.body': 'type',
  'font.mono': 'type',
  'type.base': 'type',
  'type.ratio': 'type',
  'type.displayWeight': 'type',
  'radius.base': 'shape',
  'stroke.width': 'shape',
  'icon.set': 'shape',
  'shadow.card': 'shape',
  'space.base': 'space',
  'space.section': 'space',
  'motion.duration': 'motion',
  'motion.ease': 'motion',
}

export const TOKEN_LABEL: Record<TokenKey, string> = {
  'color.bg': 'Background',
  'color.surface': 'Surface',
  'color.text': 'Text',
  'color.muted': 'Muted text',
  'color.border': 'Border',
  'color.primary': 'Primary',
  'color.onPrimary': 'On primary',
  'color.accent': 'Accent',
  'font.display': 'Display font',
  'font.body': 'Body font',
  'font.mono': 'Mono font',
  'type.base': 'Base size',
  'type.ratio': 'Scale ratio',
  'type.displayWeight': 'Display weight',
  'radius.base': 'Radius',
  'stroke.width': 'Line weight',
  'icon.set': 'Icon set',
  'shadow.card': 'Card shadow',
  'space.base': 'Space unit',
  'space.section': 'Section padding',
  'motion.duration': 'Duration',
  'motion.ease': 'Easing',
}

export const GROUP_LABEL: Record<TokenGroup, string> = {
  color: 'Color',
  type: 'Type',
  shape: 'Shape',
  space: 'Space',
  motion: 'Motion',
}

export function keysInGroup(group: TokenGroup): TokenKey[] {
  return TOKEN_KEYS.filter((k) => TOKEN_GROUP_OF[k] === group)
}

/** Neutral defaults used when nothing has been promoted for a token. */
export const BASE_TOKENS: TokenSet = {
  'color.bg': '#ffffff',
  'color.surface': '#f4f4f5',
  'color.text': '#18181b',
  'color.muted': '#71717a',
  'color.border': '#e4e4e7',
  'color.primary': '#18181b',
  'color.onPrimary': '#ffffff',
  'color.accent': '#2563eb',
  'font.display': "'Inter', system-ui, sans-serif",
  'font.body': "'Inter', system-ui, sans-serif",
  'font.mono': "'JetBrains Mono', ui-monospace, monospace",
  'type.base': '16px',
  'type.ratio': '1.25',
  'type.displayWeight': '700',
  'radius.base': '8px',
  'stroke.width': '1px',
  'icon.set': 'lucide:regular',
  'shadow.card': '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.06)',
  'space.base': '4px',
  'space.section': '96px',
  'motion.duration': '320ms',
  'motion.ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
}

export const BASE_FONTS: FontSource[] = [
  { family: 'Inter', css2: 'Inter:wght@400;500;600;700' },
  { family: 'JetBrains Mono', css2: 'JetBrains+Mono:wght@400;500' },
]

const px = (v: string) => parseFloat(v) || 0
const round = (n: number) => Math.round(n * 100) / 100

export function cssVarName(key: TokenKey): string {
  const [group, name] = key.split('.')
  const kebab = name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  return `--mx-${group}-${kebab}`
}

/**
 * Expand a token set into the CSS custom properties clips are written against:
 * raw tokens plus derived type scale, spacing scale and radii.
 */
export function expandTokens(t: TokenSet, opts: { vh?: string } = {}): CssVars {
  const vars: CssVars = {}
  for (const key of TOKEN_KEYS) vars[cssVarName(key)] = t[key]

  const base = px(t['type.base'])
  const ratio = parseFloat(t['type.ratio']) || 1.25
  const steps: [string, number][] = [
    ['xs', -2],
    ['sm', -1],
    ['base', 0],
    ['lg', 1],
    ['xl', 2],
    ['2xl', 3],
    ['3xl', 4],
    ['4xl', 5],
    ['5xl', 6],
    ['6xl', 7],
  ]
  for (const [name, step] of steps) vars[`--mx-text-${name}`] = `${round(base * Math.pow(ratio, step))}px`

  const unit = px(t['space.base'])
  const scale = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
  scale.forEach((m, i) => (vars[`--mx-space-${i}`] = `${unit * m}px`))

  const r = px(t['radius.base'])
  vars['--mx-radius-sm'] = `${round(r / 2)}px`
  vars['--mx-radius'] = `${r}px`
  vars['--mx-radius-lg'] = `${round(r * 1.75)}px`
  vars['--mx-radius-pill'] = r === 0 ? '0px' : '999px'

  // Line weight: borders and rules are written as var(--mx-stroke) or multiples of it.
  const stroke = px(t['stroke.width'] ?? '') || 1
  vars['--mx-stroke-width'] = `${stroke}px`
  vars['--mx-stroke'] = `${stroke}px`

  vars['--mx-vh'] = opts.vh ?? '1vh'
  return vars
}

export function varsToCss(vars: CssVars, selector = ':root'): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

export const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource'

/** Stylesheet URLs for a set of fonts: one for Google Fonts, one for Fontshare, one per weight for Fontsource. */
export function fontHrefs(fonts: FontSource[]): string[] {
  const google = fonts.filter((f) => f.provider !== 'fontshare' && f.css2)
  const fontshare = fonts.filter((f) => f.provider === 'fontshare' && f.fontshare)
  const out: string[] = []
  if (google.length) out.push(`https://fonts.googleapis.com/css2?${google.map((f) => `family=${f.css2}`).join('&')}&display=swap`)
  if (fontshare.length) out.push(`https://api.fontshare.com/v2/css?${fontshare.map((f) => `f[]=${f.fontshare}`).join('&')}&display=swap`)
  // Fontsource publishes a stylesheet per weight.
  for (const f of fonts) {
    if (f.provider !== 'fontsource' || !f.fontsource) continue
    const [id, ws] = f.fontsource.split('@')
    for (const w of ws.split(',')) out.push(`${FONTSOURCE_CDN}/${id}/${w}.css`)
  }
  return out
}

/** The links an HTML head needs for these stylesheets, with preconnects. */
export function fontLinkTags(hrefs: string[], jsx = false): string[] {
  const co = jsx ? 'crossOrigin=""' : 'crossorigin'
  const out: string[] = []
  if (hrefs.some((h) => h.includes('fonts.googleapis.com'))) out.push(`<link rel="preconnect" href="https://fonts.gstatic.com" ${co} />`)
  if (hrefs.some((h) => h.includes('fontshare.com'))) out.push(`<link rel="preconnect" href="https://cdn.fontshare.com" ${co} />`)
  if (hrefs.some((h) => h.includes('cdn.jsdelivr.net'))) out.push(`<link rel="preconnect" href="https://cdn.jsdelivr.net" ${co} />`)
  for (const h of hrefs) out.push(`<link rel="stylesheet" href="${h.replace(/&/g, '&amp;')}" />`)
  return out
}

/** First family in a font stack, without quotes. */
export function primaryFamily(stack: string): string {
  return stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

export function fontsForTokens(t: TokenSet, catalog: FontSource[]): FontSource[] {
  const fams = new Set([t['font.display'], t['font.body'], t['font.mono']].map(primaryFamily))
  const out: FontSource[] = []
  // Fonts from your clips first (as captured), then the font library.
  for (const f of [...catalog, ...LIBRARY_FONTS]) if (fams.has(f.family) && !out.some((o) => o.family === f.family)) out.push(f)
  return out
}

/** Normalize a token value so equal-looking values compare equal. */
export function normalizeValue(key: TokenKey, value: string): string {
  const v = value.trim()
  if (key.startsWith('color.')) return v.toLowerCase()
  if (key.startsWith('font.')) return primaryFamily(v).toLowerCase()
  return v.replace(/\s+/g, ' ').toLowerCase()
}

// ---- color helpers (hex only in v1) ----

export function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return null
  const la = luminance(ra)
  const lb = luminance(rb)
  return round((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))
}

export const CONTRAST_PAIRS: [TokenKey, TokenKey, string][] = [
  ['color.text', 'color.bg', 'Text on background'],
  ['color.muted', 'color.bg', 'Muted on background'],
  ['color.onPrimary', 'color.primary', 'Button label'],
]

// ---- W3C design tokens (DTCG) ----

export function toDtcg(t: TokenSet): Record<string, unknown> {
  const out: Record<string, Record<string, unknown>> = {}
  const put = (group: string, name: string, type: string, value: unknown) => {
    out[group] ??= {}
    out[group][name] = { $type: type, $value: value }
  }
  for (const key of TOKEN_KEYS) {
    const [group, name] = key.split('.')
    const v = t[key]
    if (group === 'color') put('color', name, 'color', v)
    else if (group === 'font') put('font', name, 'fontFamily', v.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')))
    else if (key === 'type.ratio') put('type', name, 'number', parseFloat(v))
    else if (key === 'type.displayWeight') put('type', name, 'fontWeight', parseInt(v, 10))
    else if (key === 'motion.duration') put('motion', name, 'duration', v)
    else if (key === 'motion.ease') put('motion', name, 'cubicBezier', parseBezier(v) ?? v)
    else if (key === 'shadow.card') put('shadow', name, 'shadow', v)
    else put(group, name, 'dimension', v)
  }
  return out
}

function parseBezier(v: string): number[] | null {
  const m = v.match(/cubic-bezier\(([^)]+)\)/)
  if (!m) return null
  const nums = m[1].split(',').map((n) => parseFloat(n))
  return nums.length === 4 && nums.every((n) => !Number.isNaN(n)) ? nums : null
}
