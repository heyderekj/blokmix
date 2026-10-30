// UI mockups for image blocks: small HTML/CSS screens (a dashboard, a chat, a
// table…) drawn in your fonts and palette, in place of a screenshot. They're
// markup, not pictures, so they use the style guide's fonts and export as real
// HTML. The screens live in samples/mocks/<id>/ (loaded by data/mocks.ts).

import type { TokenSet } from '../types'
import { hexToRgb } from '../tokens'
import { clampParams, mixHex, rng, type ParamSpecs, type ParamValues, type Preset } from './params'

/** Every mockup Blokmix ships (samples/mocks/<id>), listed here so agents can name them without the app. */
export const MOCK_IDS = ['dashboard', 'analytics', 'chat', 'cards', 'phone', 'table', 'form', 'toasts', 'calendar', 'code'] as const
export type MockId = (typeof MOCK_IDS)[number]

export interface MockSource {
  id: MockId
  label: string
  hint: string
  html: string
  css: string
  /** The shape it looks best in. */
  ratio?: string
  /** The chrome it starts with. */
  chrome?: 'none' | 'browser' | 'phone'
}

const sources: Partial<Record<MockId, MockSource>> = {}

/** Called by data/mocks.ts with the screens in samples/mocks. */
export function registerMocks(list: MockSource[]) {
  for (const m of list) sources[m.id] = m
}

export function mockSource(id: string): MockSource | undefined {
  return sources[id as MockId]
}

export function mockSources(): MockSource[] {
  return MOCK_IDS.flatMap((id) => (sources[id] ? [sources[id]!] : []))
}

export function isMockId(id: string): id is MockId {
  return (MOCK_IDS as readonly string[]).includes(id)
}

export const MOCK_PARAMS: ParamSpecs = {
  chrome: { kind: 'choice', label: 'Frame', options: [{ id: 'none', label: 'None' }, { id: 'browser', label: 'Browser' }, { id: 'phone', label: 'Phone' }], default: 'browser' },
  surface: { kind: 'choice', label: 'Surface', options: [{ id: 'guide', label: 'Guide' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], default: 'guide' },
  scale: { kind: 'slider', label: 'Text size', min: 70, max: 140, step: 5, unit: '%', default: 100 },
  tilt: { kind: 'slider', label: 'Tilt', min: 0, max: 24, unit: '°', default: 0 },
  inset: { kind: 'slider', label: 'Inset', min: 0, max: 16, unit: '%', default: 7 },
  shadow: { kind: 'toggle', label: 'Shadow', default: true },
  tint: { kind: 'toggle', label: 'Tint with the primary color', default: false },
}

export const MOCK_PRESETS: Preset[] = [
  { id: 'flat', label: 'Flat', values: { chrome: 'none', inset: 0, shadow: false, tilt: 0 } },
  { id: 'window', label: 'Window', values: { chrome: 'browser', inset: 7, shadow: true, tilt: 0 } },
  { id: 'tilted', label: 'Tilted', values: { chrome: 'browser', inset: 10, shadow: true, tilt: 14 } },
  { id: 'night', label: 'Night', values: { surface: 'dark', chrome: 'browser', tint: true } },
]

/** The frame every mockup sits in: chrome, tilt, shadow and text that scales with the block. */
export const MOCK_BASE_CSS = `.mx-mock {
  position: absolute; inset: 0; display: grid; place-items: center;
  padding: var(--mk-inset, 7%); perspective: 1400px; container-type: size;
  font-family: var(--mx-font-body); color: var(--mx-color-text); line-height: 1.35; text-align: start;
}
:where(.mx-mock) *, :where(.mx-mock) *::before, :where(.mx-mock) *::after { box-sizing: border-box; margin: 0; padding: 0; list-style: none; }
:where(.mx-mock) svg { display: block; }
.mx-mock-frame {
  position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background: var(--mx-color-bg); color: var(--mx-color-text);
  border-radius: var(--mx-radius-lg); border: var(--mx-stroke) solid var(--mx-color-border);
  font-size: calc(var(--mk-scale, 1) * clamp(6px, 1.05cqw + 1.05cqh, 16px));
  transform: rotateX(calc(var(--mk-tilt, 0) * 0.9deg)) rotateY(calc(var(--mk-tilt, 0) * -1.2deg)) rotateZ(calc(var(--mk-tilt, 0) * 0.25deg));
  transform-origin: 50% 60%;
}
.mx-mock-screen { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.mx-mock-screen > * { height: 100%; }
.mx-mock[data-shadow] .mx-mock-frame { box-shadow: var(--mx-shadow-lg, 0 2px 4px color-mix(in oklab, var(--mx-color-text) 8%, transparent), 0 24px 48px -16px color-mix(in oklab, var(--mx-color-text) 32%, transparent)); }
.mx-mock[data-chrome='none'] .mx-mock-frame { border: 0; border-radius: inherit; }
.mx-mock-bar { display: flex; align-items: center; gap: 0.4em; padding: 0.55em 0.8em; border-bottom: var(--mx-stroke) solid var(--mx-color-border); background: var(--mx-color-surface); }
.mx-mock-bar i { width: 0.6em; height: 0.6em; border-radius: 50%; background: color-mix(in oklab, var(--mx-color-text) 18%, transparent); }
.mx-mock-bar span { flex: 1; max-width: 40%; height: 1.3em; margin-inline: auto; border-radius: var(--mx-radius-pill); background: var(--mx-color-bg); }
.mx-mock[data-chrome='phone'] .mx-mock-frame { width: auto; aspect-ratio: 9 / 19.5; max-width: 100%; border-radius: 2.6em; border: 0.45em solid var(--mx-color-text); }
.mx-mock[data-chrome='phone'] .mx-mock-frame::before { content: ""; position: absolute; z-index: 2; top: 0.5em; left: 50%; translate: -50% 0; width: 32%; height: 1.4em; border-radius: var(--mx-radius-pill); background: var(--mx-color-text); }
.mx-mock[data-chrome='phone'] .mx-mock-screen { padding-top: 1.6em; }
`

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

const isDark = (hex: string) => {
  const c = hexToRgb(hex)
  return c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.45 : false
}

/** Numbers in a mockup that change with its seed ("data-n" says what kind). */
function seeded(html: string, seed: number): string {
  const r = rng(seed * 31 + 7)
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
  return html.replace(/(data-n="(\w+)"[^>]*>)([^<]*)</g, (_m, open: string, kind: string) => {
    const v =
      kind === 'money' ? `$${fmt(20 + r() ** 2 * 140000)}` : kind === 'count' ? fmt(12 + r() * 9000) : kind === 'percent' ? `${(1 + r() * 30).toFixed(1)}%` : kind === 'delta' ? `+${(0.5 + r() * 24).toFixed(1)}%` : kind === 'secs' ? `${Math.round(8 + r() * 80)}s` : null
    return v === null ? _m : `${open}${v}<`
  })
}

/** A mockup ready for an image block: its markup (in its frame) and its CSS. */
export function mockRender(id: string, params: ParamValues | undefined, seed: number, tokens: TokenSet): { html: string; css: string } | null {
  const src = mockSource(id)
  if (!src) return null
  const p = clampParams(MOCK_PARAMS, { chrome: src.chrome ?? 'browser', ...params })
  const key = `mx-mk-${hash(JSON.stringify([id, p, seed, tokens['color.bg'], tokens['color.text'], tokens['color.primary']]))}`
  const vars: string[] = [`--mk-scale: ${(p.scale as number) / 100};`, `--mk-tilt: ${p.tilt};`, `--mk-inset: ${p.chrome === 'none' ? 0 : p.inset}%;`]
  // Light or dark whatever the guide is: swap the page and ink colors inside the frame.
  const bg = tokens['color.bg']
  const text = tokens['color.text']
  const flip = (p.surface === 'dark' && !isDark(bg)) || (p.surface === 'light' && isDark(bg))
  const frame: string[] = []
  if (flip)
    frame.push(
      `--mx-color-bg: ${text}; --mx-color-text: ${bg}; --mx-color-surface: ${mixHex(bg, text, 0.08)}; --mx-color-border: ${mixHex(bg, text, 0.18)}; --mx-color-muted: ${mixHex(bg, text, 0.62)};`,
    )
  if (p.tint) frame.push(`--mx-color-surface: color-mix(in oklab, var(--mx-color-primary) 14%, ${flip ? text : bg}); --mx-color-border: color-mix(in oklab, var(--mx-color-primary) 26%, ${flip ? text : bg});`)
  // Charts follow the seed too.
  const r = rng(seed)
  const bars = Array.from({ length: 12 }, (_, k) => `.${key} .bars > i:nth-child(${k + 1}) { --v: ${Math.round(22 + r() * 76)}%; }`).join('\n')
  const css = `.${key} { ${vars.join(' ')} }${frame.length ? `\n.${key} .mx-mock-frame { ${frame.join(' ')} }` : ''}\n${bars}`
  const bar = p.chrome === 'browser' ? '<div class="mx-mock-bar"><i></i><i></i><i></i><span></span></div>' : ''
  const html = `<div class="mx-media mx-mock ${key}" data-chrome="${p.chrome}"${p.shadow ? ' data-shadow' : ''} role="img" aria-label="${src.label} mockup"><div class="mx-mock-frame">${bar}<div class="mx-mock-screen">${seeded(src.html.trim(), seed)}</div></div></div>`
  return { html, css: `${src.css.trim()}\n${css}` }
}
