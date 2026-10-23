import type { BlockKind } from '../types'

/**
 * The block library: alternative looks for each kind of block, written only in
 * tokens so they re-theme under any style guide. Each reads the block's own
 * overrides first (--b-fill, --b-ink, --b-radius, --b-shadow), so a variant and
 * a palette pick combine.
 *
 * A variant's CSS is a declaration body for the block itself; `&` refers to it.
 */
export interface Variant {
  id: string
  label: string
  /** One line on when to reach for it; shown in the picker. */
  hint: string
  css: string
}

const fill = (d: string) => `var(--b-fill, ${d})`
const ink = (d: string) => `var(--b-ink, ${d})`
const radius = (d: string) => `var(--b-radius, ${d})`
const shadow = (d: string) => `var(--b-shadow, ${d})`
const press = `transition: background-color var(--mx-motion-duration) var(--mx-motion-ease), color var(--mx-motion-duration) var(--mx-motion-ease), box-shadow var(--mx-motion-duration) var(--mx-motion-ease), translate 120ms var(--mx-motion-ease);
  &:active { translate: 0 1px; }`

const BUTTON_BASE = `display: inline-flex; align-items: center; justify-content: center; gap: var(--mx-space-2);
  min-height: 44px; padding: var(--mx-space-3) var(--mx-space-5); font-weight: 600; line-height: 1.1; text-decoration: none;`

const CARD_BASE = `padding: var(--mx-space-6); border-radius: ${radius('var(--mx-radius-lg)')};`

export const VARIANTS: Partial<Record<BlockKind, Variant[]>> = {
  button: [
    {
      id: 'solid',
      label: 'Solid',
      hint: 'The one main action in a section',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: 1px solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 86%, var(--mx-color-text)); }`,
    },
    {
      id: 'soft',
      label: 'Soft',
      hint: 'A quieter action that still reads as a button',
      css: `${BUTTON_BASE} background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-text)')}; border: 1px solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 22%, transparent); }`,
    },
    {
      id: 'outline',
      label: 'Outline',
      hint: 'A secondary action beside a solid one',
      css: `${BUTTON_BASE} background: transparent; color: ${ink('var(--mx-color-text)')}; border: 1.5px solid ${fill('color-mix(in oklab, var(--mx-color-text) 30%, transparent)')}; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { border-color: ${fill('var(--mx-color-text)')}; }`,
    },
    {
      id: 'ghost',
      label: 'Ghost',
      hint: 'A tertiary action; text that behaves like a button',
      css: `${BUTTON_BASE} background: transparent; color: ${ink('var(--mx-color-text)')}; border: 1px solid transparent; border-radius: ${radius('var(--mx-radius)')}; ${press}
  &:hover { background: color-mix(in oklab, var(--mx-color-text) 7%, transparent); }`,
    },
    {
      id: 'pill',
      label: 'Pill',
      hint: 'Friendlier and rounder; good with soft, rounded styles',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: 1px solid transparent; border-radius: 999px; padding-inline: var(--mx-space-6); box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 86%, var(--mx-color-text)); }`,
    },
    {
      id: 'arrow',
      label: 'Text + arrow',
      hint: 'A light “learn more” that invites a click without competing',
      css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); min-height: 44px; padding: 0; background: none; border: 0; box-shadow: none; color: ${ink('var(--mx-color-text)')}; font-weight: 600; text-decoration: none;
  &::after { content: "→"; transition: translate var(--mx-motion-duration) var(--mx-motion-ease); }
  &:hover::after { translate: 4px 0; }`,
    },
    {
      id: 'offset',
      label: 'Offset',
      hint: 'Playful and bold: a hard shadow that presses in',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: 2px solid var(--mx-color-text); border-radius: ${radius('var(--mx-radius-sm)')}; box-shadow: 4px 4px 0 var(--mx-color-text); transition: translate 120ms var(--mx-motion-ease), box-shadow 120ms var(--mx-motion-ease);
  &:hover { translate: -1px -1px; box-shadow: 5px 5px 0 var(--mx-color-text); }
  &:active { translate: 3px 3px; box-shadow: 1px 1px 0 var(--mx-color-text); }`,
    },
  ],
  link: [
    { id: 'underline', label: 'Underline', hint: 'Clearly a link, inside text', css: `color: ${ink('inherit')}; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 0.2em; &:hover { text-decoration-color: ${fill('var(--mx-color-primary)')}; }` },
    {
      id: 'sweep',
      label: 'Sweep',
      hint: 'An underline that draws in on hover',
      css: `color: ${ink('inherit')}; text-decoration: none; background: linear-gradient(${fill('var(--mx-color-primary)')}, ${fill('var(--mx-color-primary)')}) no-repeat 0 100% / 0 2px; transition: background-size var(--mx-motion-duration) var(--mx-motion-ease); &:hover { background-size: 100% 2px; }`,
    },
    { id: 'arrow', label: 'Arrow', hint: 'Points onwards', css: `color: ${ink('inherit')}; text-decoration: none; &::after { content: " →"; } &:hover { color: ${fill('var(--mx-color-primary)')}; }` },
    { id: 'quiet', label: 'Quiet', hint: 'Muted until hovered; for dense link lists', css: `color: ${ink('var(--mx-color-muted)')}; text-decoration: none; &:hover { color: var(--mx-color-text); }` },
  ],
  badge: [
    { id: 'pill', label: 'Pill', hint: 'A soft tag that sits above a heading', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: var(--mx-space-1) var(--mx-space-3); border-radius: 999px; background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-sm); font-weight: 600;` },
    { id: 'outline', label: 'Outline', hint: 'Lighter than a pill', css: `display: inline-flex; padding: var(--mx-space-1) var(--mx-space-3); border-radius: 999px; border: 1px solid color-mix(in oklab, var(--mx-color-text) 22%, transparent); background: none; color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-sm); font-weight: 500;` },
    { id: 'dot', label: 'Dot', hint: 'A coloured dot before plain text', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: 0; background: none; border: 0; color: ${ink('var(--mx-color-muted)')}; font-size: var(--mx-text-sm); font-weight: 600; &::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${fill('var(--mx-color-accent)')}; }` },
    { id: 'mono', label: 'Mono caps', hint: 'Editorial and technical', css: `display: inline-block; padding: 0; background: none; border: 0; color: ${ink('var(--mx-color-muted)')}; font-family: var(--mx-font-mono); font-size: var(--mx-text-xs); letter-spacing: 0.12em; text-transform: uppercase;` },
  ],
  heading: [
    {
      id: 'gradient',
      label: 'Gradient',
      hint: 'Your primary flowing into your accent',
      css: `background: linear-gradient(100deg, ${fill('var(--mx-color-primary)')}, var(--mx-color-accent)); -webkit-background-clip: text; background-clip: text; color: transparent;`,
    },
    {
      id: 'marker',
      label: 'Marker',
      hint: 'A highlighter stroke behind the words',
      // A thick underline sitting behind the lower half of the letters: follows every line without changing layout.
      css: `color: ${ink('inherit')}; text-decoration: underline; text-decoration-color: color-mix(in oklab, ${fill('var(--mx-color-accent)')} 45%, transparent); text-decoration-thickness: 0.36em; text-underline-offset: -0.22em; text-decoration-skip-ink: none;`,
    },
    {
      id: 'scribble',
      label: 'Scribble',
      hint: 'A hand-drawn wavy underline',
      css: `color: ${ink('inherit')}; text-decoration: underline wavy ${fill('var(--mx-color-accent)')}; text-decoration-thickness: 0.06em; text-underline-offset: 0.16em; text-decoration-skip-ink: none;`,
    },
    { id: 'hollow', label: 'Hollow', hint: 'Outlined letters; best at very large sizes', css: `color: transparent; -webkit-text-stroke: max(1px, 0.025em) ${ink('var(--mx-color-text)')};` },
    { id: 'italic', label: 'Italic', hint: 'A softer, editorial voice', css: `font-style: italic; letter-spacing: -0.01em; color: ${ink('inherit')};` },
    { id: 'caps', label: 'Tight caps', hint: 'Loud and architectural', css: `text-transform: uppercase; letter-spacing: -0.02em; line-height: 0.95; color: ${ink('inherit')};` },
  ],
  text: [
    { id: 'lead', label: 'Lead', hint: 'A larger opening paragraph', css: `font-size: var(--mx-text-lg); line-height: 1.5; color: ${ink('var(--mx-color-text)')};` },
    { id: 'muted', label: 'Muted', hint: 'Supporting detail', css: `color: ${ink('var(--mx-color-muted)')};` },
    { id: 'mono', label: 'Mono', hint: 'Technical notes and captions', css: `font-family: var(--mx-font-mono); font-size: var(--mx-text-sm); letter-spacing: 0.01em; color: ${ink('inherit')};` },
    { id: 'callout', label: 'Callout', hint: 'Set apart with an accent rule', css: `padding-left: var(--mx-space-4); border-left: 3px solid ${fill('var(--mx-color-accent)')}; color: ${ink('inherit')};` },
  ],
  card: [
    { id: 'flat', label: 'Flat', hint: 'No container: content on the page', css: `background: none; border: 0; box-shadow: none; padding: 0;` },
    { id: 'bordered', label: 'Bordered', hint: 'Calm structure for dense grids', css: `${CARD_BASE} background: ${fill('var(--mx-color-bg)')}; border: 1px solid var(--mx-color-border); box-shadow: ${shadow('none')};` },
    { id: 'raised', label: 'Raised', hint: 'Lifts off the page; one level of depth', css: `${CARD_BASE} background: ${fill('var(--mx-color-surface)')}; border: 1px solid color-mix(in oklab, var(--mx-color-border) 50%, transparent); box-shadow: ${shadow('var(--mx-shadow-card)')};` },
    { id: 'tinted', label: 'Tinted', hint: 'A wash of your primary', css: `${CARD_BASE} background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 9%, var(--mx-color-bg)); border: 1px solid color-mix(in oklab, ${fill('var(--mx-color-primary)')} 18%, transparent); box-shadow: ${shadow('none')};` },
    { id: 'glass', label: 'Glass', hint: 'Frosted, over colour or imagery', css: `${CARD_BASE} background: color-mix(in oklab, var(--mx-color-bg) 62%, transparent); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid color-mix(in oklab, var(--mx-color-bg) 70%, transparent); box-shadow: ${shadow('var(--mx-shadow-card)')};` },
    { id: 'offset', label: 'Offset', hint: 'A hard shadow: bold and graphic', css: `${CARD_BASE} background: ${fill('var(--mx-color-bg)')}; border: 2px solid var(--mx-color-text); box-shadow: 6px 6px 0 var(--mx-color-text);` },
  ],
  image: [
    { id: 'rounded', label: 'Rounded', hint: 'Matches your radius', css: `border-radius: ${radius('var(--mx-radius-lg)')}; overflow: hidden;` },
    { id: 'circle', label: 'Circle', hint: 'Portraits and avatars', css: `border-radius: 50%; aspect-ratio: 1; overflow: hidden;` },
    { id: 'arch', label: 'Arch', hint: 'A soft, architectural frame', css: `border-radius: 999px 999px var(--mx-radius) var(--mx-radius); overflow: hidden;` },
    { id: 'blob', label: 'Blob', hint: 'Organic and playful', css: `border-radius: 58% 42% 46% 54% / 46% 52% 48% 54%; overflow: hidden;` },
    { id: 'polaroid', label: 'Polaroid', hint: 'A printed photo, slightly tilted', css: `padding: var(--mx-space-3) var(--mx-space-3) var(--mx-space-8); background: var(--mx-color-bg); box-shadow: var(--mx-shadow-card); rotate: -2deg; border-radius: 2px;` },
    { id: 'inset', label: 'Inset frame', hint: 'A fine border inside the edge', css: `border-radius: ${radius('var(--mx-radius-lg)')}; overflow: hidden; outline: 1px solid color-mix(in oklab, var(--mx-color-bg) 70%, transparent); outline-offset: -10px;` },
    {
      id: 'duotone',
      label: 'Duotone',
      hint: 'Tinted with your primary',
      css: `position: relative; isolation: isolate; overflow: hidden; border-radius: ${radius('var(--mx-radius-lg)')}; filter: grayscale(1) contrast(1.05); &::after { content: ""; position: absolute; inset: 0; background: ${fill('var(--mx-color-primary)')}; mix-blend-mode: color; pointer-events: none; }`,
    },
  ],
  icon: [
    { id: 'tile', label: 'Tile', hint: 'A soft square behind the icon', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: ${radius('var(--mx-radius)')}; background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-primary)')};` },
    { id: 'circle', label: 'Circle', hint: 'A solid round badge', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')};` },
    { id: 'bare', label: 'Bare', hint: 'Just the glyph', css: `background: none; border: 0; box-shadow: none; color: ${ink('var(--mx-color-text)')};` },
  ],
  input: [
    { id: 'outlined', label: 'Outlined', hint: 'The clearest field', css: `background: var(--mx-color-bg); border: 1.5px solid var(--mx-color-border); border-radius: ${radius('var(--mx-radius)')}; min-height: 44px; padding: var(--mx-space-3) var(--mx-space-4); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; outline-offset: 1px; }` },
    { id: 'filled', label: 'Filled', hint: 'Softer; good on plain backgrounds', css: `background: color-mix(in oklab, var(--mx-color-text) 6%, transparent); border: 1px solid transparent; border-radius: ${radius('var(--mx-radius)')}; min-height: 44px; padding: var(--mx-space-3) var(--mx-space-4); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; }` },
    { id: 'underline', label: 'Underline', hint: 'Minimal, editorial forms', css: `background: none; border: 0; border-bottom: 1.5px solid var(--mx-color-border); border-radius: 0; min-height: 44px; padding: var(--mx-space-2) 0; &:focus { outline: none; border-bottom-color: ${fill('var(--mx-color-primary)')}; }` },
  ],
}
VARIANTS.item = VARIANTS.card

export function variantsFor(kind: BlockKind): Variant[] {
  return VARIANTS[kind] ?? []
}

export function findVariant(kind: BlockKind, id: string | undefined): Variant | undefined {
  return id ? variantsFor(kind).find((v) => v.id === id) : undefined
}
