// Naming captured icons: an exact drawing match against the four curated packs
// (sites often ship Lucide, Tabler, Phosphor or Heroicons as-is), then hints in
// the markup (lucide-arrow-right, aria-label="Search", data-icon="mail").

import data from '@/data/icons.json'
import { ICON_NAMES } from '@/core/icons'
import { attr, parseHtml, type HEl, type HNode } from '@/core/html/parse'

const GEOMETRY = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points']
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'])

const num = (s: string) => s.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => String(Math.round(parseFloat(n) * 10) / 10))
const normPath = (d: string) =>
  num(d)
    .replace(/,/g, ' ')
    .replace(/([a-zA-Z])/g, ' $1 ')
    .replace(/(\d)-/g, '$1 -')
    .replace(/\s+/g, ' ')
    .trim()

/** A drawing's geometry as one comparable string (attribute order, spacing and styling ignored). */
export function canon(nodes: HNode[]): string {
  const parts: string[] = []
  const visit = (ns: HNode[]) => {
    for (const n of ns) {
      if (n.t !== 'el') continue
      if (SHAPES.has(n.tag)) {
        const g = GEOMETRY.map((k) => [k, attr(n, k)] as const)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${k === 'd' ? normPath(v!) : num(v!)}`)
        parts.push(`${n.tag}(${g.join(';')})`)
      }
      visit(n.kids)
    }
  }
  visit(nodes)
  return parts.sort().join('|')
}

let INDEX: Map<string, string> | null = null
function index(): Map<string, string> {
  if (INDEX) return INDEX
  INDEX = new Map()
  const packs = (data as { packs: Record<string, Record<string, Record<string, string>>> }).packs
  for (const weights of Object.values(packs))
    for (const icons of Object.values(weights))
      for (const [name, body] of Object.entries(icons)) {
        // Bare <path/> tags only self-close inside <svg>.
        const svg = parseHtml(`<svg>${body}</svg>`)[0]
        const key = svg?.t === 'el' ? canon(svg.kids) : ''
        if (key && !INDEX.has(key)) INDEX.set(key, name)
      }
  return INDEX
}

const ALIASES: Record<string, string[]> = {
  x: ['close', 'x-mark', 'xmark', 'times', 'cross', 'dismiss'],
  check: ['checkmark', 'tick', 'check-mark', 'done'],
  'check-circle': ['circle-check', 'check-circle-2', 'badge-check'],
  menu: ['hamburger', 'bars', 'bars-3', 'navicon'],
  search: ['magnifying-glass', 'magnifier', 'loupe', 'find'],
  mail: ['email', 'envelope', 'inbox'],
  phone: ['telephone', 'call'],
  user: ['person', 'account', 'profile', 'avatar'],
  users: ['people', 'team', 'group'],
  chat: ['message', 'message-circle', 'message-square', 'chat-bubble', 'comment', 'comments', 'messages'],
  settings: ['gear', 'cog', 'cogs'],
  home: ['house'],
  trash: ['delete', 'bin', 'trash-2', 'trash-can'],
  edit: ['pencil', 'pen', 'pen-line', 'edit-2', 'edit-3'],
  'external-link': ['arrow-top-right-on-square', 'open-in-new', 'square-arrow-out-up-right', 'launch'],
  'arrow-up-right': ['arrow-ne', 'arrow-top-right', 'north-east'],
  'arrow-right': ['arrow', 'arrow-forward', 'arrow-long-right', 'right-arrow', 'move-right', 'arrow-narrow-right'],
  'arrow-left': ['arrow-back', 'arrow-long-left', 'left-arrow', 'arrow-narrow-left'],
  'chevron-right': ['caret-right', 'angle-right', 'chevron-forward', 'next'],
  'chevron-down': ['caret-down', 'angle-down', 'expand', 'dropdown'],
  zap: ['bolt', 'lightning', 'flash', 'lightning-bolt'],
  sparkles: ['magic', 'sparkle', 'stars', 'ai'],
  help: ['question', 'help-circle', 'circle-help', 'question-mark', 'question-circle'],
  info: ['information', 'info-circle', 'circle-info'],
  alert: ['warning', 'alert-triangle', 'exclamation', 'exclamation-triangle', 'triangle-alert'],
  dollar: ['currency-dollar', 'money', 'usd', 'dollar-sign'],
  lightbulb: ['bulb', 'idea', 'light-bulb'],
  chart: ['bar-chart', 'chart-bar', 'analytics', 'chart-column', 'bar-chart-2', 'stats'],
  shield: ['security', 'shield-check', 'protected'],
  lock: ['padlock', 'locked'],
  globe: ['world', 'earth', 'language', 'globe-alt'],
  'map-pin': ['location', 'pin', 'marker', 'map-marker', 'location-dot'],
  calendar: ['date', 'calendar-days'],
  clock: ['time', 'schedule'],
  plus: ['add', 'plus-circle'],
  minus: ['remove', 'subtract'],
  star: ['rating', 'favorite'],
  heart: ['like', 'love'],
  code: ['brackets', 'code-bracket', 'braces'],
  terminal: ['console', 'command-line', 'prompt'],
  'shopping-cart': ['cart', 'basket'],
  download: ['arrow-down-tray', 'save'],
  upload: ['arrow-up-tray'],
  refresh: ['reload', 'rotate', 'sync', 'arrow-path'],
  copy: ['duplicate', 'clipboard'],
  quote: ['quotes', 'blockquote', 'quote-left'],
  play: ['play-circle', 'video-play'],
}

const ALIAS_OF = new Map<string, string>()
for (const [name, list] of Object.entries(ALIASES)) for (const a of list) ALIAS_OF.set(a, name)

const PREFIX = /^(lucide|icon|icons|ti|tabler|ph|phosphor|fa|fas|far|fab|bi|heroicon|heroicons|hi|ri|mdi|i|svg|material-symbols|ion|feather|octicon|bx|bxs)-/

/** An ICON_NAMES name for a word like "magnifying-glass" or "lucide-arrow-right". */
export function iconNameFor(word: string): string | undefined {
  let w = word.toLowerCase().trim().replace(/[_\s]+/g, '-')
  for (let i = 0; i < 3; i++) w = w.replace(PREFIX, '').replace(/^(outline|solid|mini|micro|fill|filled|bold|regular|light|thin|duotone|\d+)-/, '')
  w = w.replace(/-(outline|solid|fill|filled|bold|light|thin|duotone|regular|mini|micro|\d+)$/g, '')
  if (ICON_NAMES.includes(w)) return w
  return ALIAS_OF.get(w)
}

export interface NamedIcon {
  name: string
  how: 'drawing' | 'hint'
}

/** Name an icon from its drawing, then from words in its markup. */
export function nameIcon(svg: HEl, hints: string[]): NamedIcon | null {
  const key = canon(svg.kids)
  const byDrawing = key && index().get(key)
  if (byDrawing) return { name: byDrawing, how: 'drawing' }
  for (const h of hints) {
    const whole = iconNameFor(h)
    if (whole) return { name: whole, how: 'hint' }
    for (const word of h.split(/[^\w-]+/)) {
      const n = word && iconNameFor(word)
      if (n) return { name: n, how: 'hint' }
    }
  }
  return null
}
