/**
 * Builds resources/js/data/icons.json: a curated set of common icons, each
 * under one meaningful name, drawn by every supported pack and weight.
 *   npx vite-node scripts/build-icons.ts
 *
 * Packs and licences: Lucide (ISC), Phosphor (MIT), Tabler (MIT), Heroicons (MIT).
 * Each entry keeps only the SVG's inner markup; the renderer adds the <svg>
 * wrapper with the pack's own viewBox and stroke/fill conventions.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const NM = join(process.cwd(), 'node_modules')

/** name → [lucide, phosphor, tabler, heroicons] file names (without .svg). */
const NAMES: Record<string, [string, string, string, string]> = {
  'arrow-right': ['arrow-right', 'arrow-right', 'arrow-right', 'arrow-right'],
  'arrow-left': ['arrow-left', 'arrow-left', 'arrow-left', 'arrow-left'],
  'arrow-up-right': ['arrow-up-right', 'arrow-up-right', 'arrow-up-right', 'arrow-up-right'],
  'arrow-down': ['arrow-down', 'arrow-down', 'arrow-down', 'arrow-down'],
  'chevron-right': ['chevron-right', 'caret-right', 'chevron-right', 'chevron-right'],
  'chevron-down': ['chevron-down', 'caret-down', 'chevron-down', 'chevron-down'],
  check: ['check', 'check', 'check', 'check'],
  'check-circle': ['circle-check', 'check-circle', 'circle-check', 'check-circle'],
  x: ['x', 'x', 'x', 'x-mark'],
  plus: ['plus', 'plus', 'plus', 'plus'],
  minus: ['minus', 'minus', 'minus', 'minus'],
  menu: ['menu', 'list', 'menu-2', 'bars-3'],
  search: ['search', 'magnifying-glass', 'search', 'magnifying-glass'],
  star: ['star', 'star', 'star', 'star'],
  heart: ['heart', 'heart', 'heart', 'heart'],
  sparkles: ['sparkles', 'sparkle', 'sparkles', 'sparkles'],
  zap: ['zap', 'lightning', 'bolt', 'bolt'],
  rocket: ['rocket', 'rocket-launch', 'rocket', 'rocket-launch'],
  mail: ['mail', 'envelope-simple', 'mail', 'envelope'],
  phone: ['phone', 'phone', 'phone', 'phone'],
  'map-pin': ['map-pin', 'map-pin', 'map-pin', 'map-pin'],
  globe: ['globe', 'globe', 'world', 'globe-alt'],
  calendar: ['calendar', 'calendar-blank', 'calendar', 'calendar'],
  clock: ['clock', 'clock', 'clock', 'clock'],
  user: ['user', 'user', 'user', 'user'],
  users: ['users', 'users', 'users', 'user-group'],
  chat: ['message-circle', 'chat-circle', 'message-circle', 'chat-bubble-oval-left'],
  bell: ['bell', 'bell', 'bell', 'bell'],
  settings: ['settings', 'gear', 'settings', 'cog-6-tooth'],
  sliders: ['sliders-horizontal', 'sliders-horizontal', 'adjustments-horizontal', 'adjustments-horizontal'],
  home: ['house', 'house', 'home', 'home'],
  'shopping-cart': ['shopping-cart', 'shopping-cart', 'shopping-cart', 'shopping-cart'],
  'shopping-bag': ['shopping-bag', 'shopping-bag', 'shopping-bag', 'shopping-bag'],
  'credit-card': ['credit-card', 'credit-card', 'credit-card', 'credit-card'],
  tag: ['tag', 'tag', 'tag', 'tag'],
  gift: ['gift', 'gift', 'gift', 'gift'],
  truck: ['truck', 'truck', 'truck', 'truck'],
  lock: ['lock', 'lock', 'lock', 'lock-closed'],
  shield: ['shield-check', 'shield-check', 'shield-check', 'shield-check'],
  key: ['key', 'key', 'key', 'key'],
  eye: ['eye', 'eye', 'eye', 'eye'],
  bookmark: ['bookmark', 'bookmark-simple', 'bookmark', 'bookmark'],
  link: ['link', 'link', 'link', 'link'],
  'external-link': ['external-link', 'arrow-square-out', 'external-link', 'arrow-top-right-on-square'],
  download: ['download', 'download-simple', 'download', 'arrow-down-tray'],
  upload: ['upload', 'upload-simple', 'upload', 'arrow-up-tray'],
  refresh: ['refresh-cw', 'arrows-clockwise', 'refresh', 'arrow-path'],
  share: ['share-2', 'share-network', 'share', 'share'],
  edit: ['pencil', 'pencil-simple', 'pencil', 'pencil'],
  trash: ['trash-2', 'trash', 'trash', 'trash'],
  copy: ['copy', 'copy', 'copy', 'document-duplicate'],
  file: ['file', 'file', 'file', 'document'],
  folder: ['folder', 'folder', 'folder', 'folder'],
  image: ['image', 'image', 'photo', 'photo'],
  camera: ['camera', 'camera', 'camera', 'camera'],
  video: ['video', 'video-camera', 'video', 'video-camera'],
  play: ['play', 'play', 'player-play', 'play'],
  music: ['music', 'music-note', 'music', 'musical-note'],
  mic: ['mic', 'microphone', 'microphone', 'microphone'],
  layers: ['layers', 'stack', 'stack-2', 'square-3-stack-3d'],
  layout: ['layout-grid', 'squares-four', 'layout-grid', 'squares-2x2'],
  grid: ['grid-3x3', 'grid-nine', 'grid-dots', 'table-cells'],
  list: ['list', 'list-bullets', 'list', 'list-bullet'],
  filter: ['filter', 'funnel', 'filter', 'funnel'],
  chart: ['chart-column', 'chart-bar', 'chart-bar', 'chart-bar'],
  'trending-up': ['trending-up', 'trend-up', 'trending-up', 'arrow-trending-up'],
  pie: ['chart-pie', 'chart-pie-slice', 'chart-pie', 'chart-pie'],
  target: ['target', 'target', 'target', 'viewfinder-circle'],
  trophy: ['trophy', 'trophy', 'trophy', 'trophy'],
  award: ['award', 'medal', 'award', 'check-badge'],
  briefcase: ['briefcase', 'briefcase', 'briefcase', 'briefcase'],
  building: ['building-2', 'buildings', 'building', 'building-office'],
  book: ['book-open', 'book-open', 'book', 'book-open'],
  graduation: ['graduation-cap', 'graduation-cap', 'school', 'academic-cap'],
  lightbulb: ['lightbulb', 'lightbulb', 'bulb', 'light-bulb'],
  puzzle: ['puzzle', 'puzzle-piece', 'puzzle', 'puzzle-piece'],
  wand: ['wand-sparkles', 'magic-wand', 'wand', 'sparkles'],
  palette: ['palette', 'palette', 'palette', 'swatch'],
  scissors: ['scissors', 'scissors', 'scissors', 'scissors'],
  code: ['code', 'code', 'code', 'code-bracket'],
  terminal: ['terminal', 'terminal-window', 'terminal-2', 'command-line'],
  cpu: ['cpu', 'cpu', 'cpu', 'cpu-chip'],
  cloud: ['cloud', 'cloud', 'cloud', 'cloud'],
  database: ['database', 'database', 'database', 'circle-stack'],
  server: ['server', 'hard-drives', 'server', 'server'],
  wifi: ['wifi', 'wifi-high', 'wifi', 'wifi'],
  sun: ['sun', 'sun', 'sun', 'sun'],
  moon: ['moon', 'moon', 'moon', 'moon'],
  leaf: ['leaf', 'leaf', 'leaf', 'sparkles'],
  flame: ['flame', 'fire', 'flame', 'fire'],
  coffee: ['coffee', 'coffee', 'coffee', 'cake'],
  smile: ['smile', 'smiley', 'mood-smile', 'face-smile'],
  'thumbs-up': ['thumbs-up', 'thumbs-up', 'thumb-up', 'hand-thumb-up'],
  compass: ['compass', 'compass', 'compass', 'map'],
  flag: ['flag', 'flag', 'flag', 'flag'],
  info: ['info', 'info', 'info-circle', 'information-circle'],
  help: ['circle-help', 'question', 'help-circle', 'question-mark-circle'],
  alert: ['triangle-alert', 'warning', 'alert-triangle', 'exclamation-triangle'],
  quote: ['quote', 'quotes', 'quote', 'chat-bubble-bottom-center-text'],
  newspaper: ['newspaper', 'newspaper', 'news', 'newspaper'],
  'dollar': ['dollar-sign', 'currency-dollar', 'currency-dollar', 'currency-dollar'],
  percent: ['percent', 'percent', 'percentage', 'receipt-percent'],
}

type Pack = 'lucide' | 'phosphor' | 'tabler' | 'heroicons'

/** Each pack's weights, and where their SVGs live. */
const SOURCES: Record<Pack, Record<string, (file: string) => string>> = {
  lucide: { regular: (f) => join(NM, 'lucide-static/icons', `${f}.svg`) },
  phosphor: Object.fromEntries(
    ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'].map((w) => [w, (f: string) => join(NM, '@phosphor-icons/core/assets', w, w === 'regular' ? `${f}.svg` : `${f}-${w}.svg`)]),
  ),
  tabler: {
    regular: (f) => join(NM, '@tabler/icons/icons/outline', `${f}.svg`),
    filled: (f) => join(NM, '@tabler/icons/icons/filled', `${f}.svg`),
  },
  heroicons: {
    outline: (f) => join(NM, 'heroicons/24/outline', `${f}.svg`),
    solid: (f) => join(NM, 'heroicons/24/solid', `${f}.svg`),
  },
}
const PACK_INDEX: Record<Pack, number> = { lucide: 0, phosphor: 1, tabler: 2, heroicons: 3 }

/** The inner markup of an SVG file, without comments, ids, classes or the pack's own wrapper. */
function inner(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s(class|id|data-[\w-]+)="[^"]*"/g, '')
    .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/g, '') // tabler's bounding box
    .replace(/<rect width="256" height="256" fill="none"\s*\/>/g, '') // phosphor's bounding box
    .replace(/\s+/g, ' ')
    .trim()
}

const out: Record<string, Record<string, Record<string, string>>> = {}
const missing: string[] = []
for (const [pack, weights] of Object.entries(SOURCES) as [Pack, Record<string, (f: string) => string>][]) {
  out[pack] = {}
  for (const [weight, path] of Object.entries(weights)) {
    out[pack][weight] = {}
    for (const [name, files] of Object.entries(NAMES)) {
      const file = files[PACK_INDEX[pack]]
      try {
        out[pack][weight][name] = inner(readFileSync(path(file), 'utf8'))
      } catch {
        // Tabler's filled set is smaller: fall back to its outline for names it doesn't fill.
        if (pack === 'tabler' && weight === 'filled') out[pack][weight][name] = ''
        else missing.push(`${pack}/${weight}/${file} (${name})`)
      }
    }
  }
}
if (missing.length) {
  console.error(`Missing icons:\n${missing.join('\n')}`)
  process.exit(1)
}
const file = join(process.cwd(), 'resources/js/data/icons.json')
writeFileSync(file, JSON.stringify({ names: Object.keys(NAMES), packs: out }) + '\n')
console.log(`Wrote ${Object.keys(NAMES).length} icons × ${Object.values(SOURCES).reduce((n, w) => n + Object.keys(w).length, 0)} pack weights to ${file}`)
