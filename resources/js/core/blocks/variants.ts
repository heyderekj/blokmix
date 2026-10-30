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
// Press feedback on everything pressable: a quick, slight scale (never from 0, never ease-in).
const press = `transition: background-color var(--mx-motion-duration) var(--mx-motion-ease), color var(--mx-motion-duration) var(--mx-motion-ease), box-shadow var(--mx-motion-duration) var(--mx-motion-ease), scale 120ms cubic-bezier(0.23, 1, 0.32, 1);
  &:active { scale: 0.97; }`

const BUTTON_BASE = `display: inline-flex; align-items: center; justify-content: center; gap: var(--mx-space-2);
  min-height: 44px; padding: var(--mx-space-3) var(--mx-space-5); font-weight: 600; line-height: 1.1; text-decoration: none;`

const CARD_BASE = `padding: var(--mx-space-6); border-radius: ${radius('var(--mx-radius-lg)')};`

export const VARIANTS: Partial<Record<BlockKind, Variant[]>> = {
  button: [
    {
      id: 'solid',
      label: 'Solid',
      hint: 'The one main action in a section',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 86%, var(--mx-color-text)); }`,
    },
    {
      id: 'soft',
      label: 'Soft',
      hint: 'A quieter action that still reads as a button',
      css: `${BUTTON_BASE} background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-text)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 22%, transparent); }`,
    },
    {
      id: 'outline',
      label: 'Outline',
      hint: 'A secondary action beside a solid one',
      css: `${BUTTON_BASE} background: transparent; color: ${ink('var(--mx-color-text)')}; border: calc(var(--mx-stroke) * 1.5) solid ${fill('color-mix(in oklab, var(--mx-color-text) 30%, transparent)')}; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { border-color: ${fill('var(--mx-color-text)')}; }`,
    },
    {
      id: 'ghost',
      label: 'Ghost',
      hint: 'A tertiary action; text that behaves like a button',
      css: `${BUTTON_BASE} background: transparent; color: ${ink('var(--mx-color-text)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; ${press}
  &:hover { background: color-mix(in oklab, var(--mx-color-text) 7%, transparent); }`,
    },
    {
      id: 'pill',
      label: 'Pill',
      hint: 'Friendlier and rounder; good with soft, rounded styles',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: var(--mx-stroke) solid transparent; border-radius: 999px; padding-inline: var(--mx-space-6); box-shadow: ${shadow('none')}; ${press}
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
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: calc(var(--mx-stroke) * 2) solid var(--mx-color-text); border-radius: ${radius('var(--mx-radius-sm)')}; box-shadow: 4px 4px 0 var(--mx-color-text); transition: translate 120ms var(--mx-motion-ease), box-shadow 120ms var(--mx-motion-ease);
  &:hover { translate: -1px -1px; box-shadow: 5px 5px 0 var(--mx-color-text); }
  &:active { translate: 3px 3px; box-shadow: 1px 1px 0 var(--mx-color-text); }`,
    },
    {
      id: 'inverse',
      label: 'Inverse',
      hint: 'Ink on paper, flipped: the strongest contrast on any page',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-text)')}; color: ${ink('var(--mx-color-bg)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-text)')} 84%, var(--mx-color-bg)); }`,
    },
    {
      id: 'gradient',
      label: 'Gradient',
      hint: 'Your primary flowing into your accent; for a launch or hero',
      css: `${BUTTON_BASE} background: linear-gradient(120deg, ${fill('var(--mx-color-primary)')}, var(--mx-color-accent)); color: ${ink('var(--mx-color-on-primary)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('none')}; ${press}
  &:hover { box-shadow: 0 6px 20px -6px color-mix(in oklab, var(--mx-color-accent) 60%, transparent); }`,
    },
    {
      id: 'raised',
      label: 'Raised',
      hint: 'A soft shadow that lifts it off the page',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-bg)')}; color: ${ink('var(--mx-color-text)')}; border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-border) 70%, transparent); border-radius: ${radius('var(--mx-radius)')}; box-shadow: ${shadow('0 1px 2px color-mix(in oklab, var(--mx-color-text) 10%, transparent), 0 4px 12px -4px color-mix(in oklab, var(--mx-color-text) 18%, transparent)')}; ${press}
  &:hover { box-shadow: 0 2px 4px color-mix(in oklab, var(--mx-color-text) 10%, transparent), 0 10px 24px -8px color-mix(in oklab, var(--mx-color-text) 26%, transparent); }`,
    },
    {
      id: 'caps',
      label: 'Square caps',
      hint: 'Square and spaced out: architectural, editorial',
      css: `${BUTTON_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; border: var(--mx-stroke) solid transparent; border-radius: ${radius('0px')}; box-shadow: ${shadow('none')}; font-size: var(--mx-text-sm); letter-spacing: 0.1em; text-transform: uppercase; padding-inline: var(--mx-space-6); ${press}
  &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 86%, var(--mx-color-text)); }`,
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
    {
      id: 'highlight',
      label: 'Highlight',
      hint: 'A soft wash of color behind the words on hover',
      css: `color: ${ink('inherit')}; text-decoration: none; border-radius: var(--mx-radius-sm); padding-inline: 0.15em; margin-inline: -0.15em; transition: background-color var(--mx-motion-duration) var(--mx-motion-ease); &:hover { background: color-mix(in oklab, ${fill('var(--mx-color-accent)')} 22%, transparent); }`,
    },
    { id: 'dotted', label: 'Dotted', hint: 'A light dotted underline; footnotes and asides', css: `color: ${ink('inherit')}; text-decoration: underline dotted; text-decoration-thickness: 1.5px; text-underline-offset: 0.25em; &:hover { text-decoration-style: solid; text-decoration-color: ${fill('var(--mx-color-primary)')}; }` },
    { id: 'mono', label: 'Mono caps', hint: 'Small, spaced, technical: for nav and footer links', css: `color: ${ink('inherit')}; text-decoration: none; font-family: var(--mx-font-mono); font-size: var(--mx-text-xs); letter-spacing: 0.1em; text-transform: uppercase; &:hover { color: ${fill('var(--mx-color-accent)')}; }` },
  ],
  banner: [
    {
      id: 'inverted',
      label: 'Inverted',
      hint: 'A dark strip that reads as news',
      css: `background: ${fill('var(--mx-color-text)')}; color: ${ink('var(--mx-color-bg)')}; border-block-end: 0;`,
    },
    {
      id: 'quiet',
      label: 'Quiet',
      hint: 'Sits back: surface color, muted words, a hairline',
      css: `background: ${fill('var(--mx-color-surface)')}; color: ${ink('var(--mx-color-muted)')}; border-block-end: var(--mx-stroke) solid var(--mx-color-border);`,
    },
    {
      id: 'accent',
      label: 'Accent',
      hint: 'For a launch or a sale; use it briefly',
      css: `background: ${fill('var(--mx-color-accent)')}; color: ${ink('var(--mx-color-on-primary)')}; --mx-color-primary: var(--mx-color-on-primary); border-block-end: 0;`,
    },
    {
      id: 'gradient',
      label: 'Gradient',
      hint: 'Primary into accent: a launch strip with some color',
      css: `background: linear-gradient(90deg, ${fill('var(--mx-color-primary)')}, var(--mx-color-accent)); color: ${ink('var(--mx-color-on-primary)')}; --mx-color-primary: var(--mx-color-on-primary); border-block-end: 0;`,
    },
    {
      id: 'mono',
      label: 'Mono caps',
      hint: 'Small spaced capitals on the page color, between hairlines',
      css: `background: ${fill('var(--mx-color-bg)')}; color: ${ink('var(--mx-color-text)')}; border-block: var(--mx-stroke) solid var(--mx-color-border); font-family: var(--mx-font-mono); font-size: var(--mx-text-xs); letter-spacing: 0.12em; text-transform: uppercase;`,
    },
    {
      id: 'static',
      label: 'Still',
      hint: 'One line, centered, no scrolling: calmer and easier to read',
      // The hidden half of a marquee goes, and nothing moves.
      css: `display: flex; justify-content: center; overflow: hidden; & [aria-hidden="true"] { display: none; } & * { animation: none; transform: none; } & > * { width: auto; max-width: 100%; justify-content: center; flex-wrap: wrap; }`,
    },
  ],
  badge: [
    { id: 'pill', label: 'Pill', hint: 'A soft tag that sits above a heading', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: var(--mx-space-1) var(--mx-space-3); border-radius: 999px; background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-sm); font-weight: 600;` },
    { id: 'outline', label: 'Outline', hint: 'Lighter than a pill', css: `display: inline-flex; padding: var(--mx-space-1) var(--mx-space-3); border-radius: 999px; border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-text) 22%, transparent); background: none; color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-sm); font-weight: 500;` },
    { id: 'dot', label: 'Dot', hint: 'A colored dot before plain text', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: 0; background: none; border: 0; color: ${ink('var(--mx-color-muted)')}; font-size: var(--mx-text-sm); font-weight: 600; &::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${fill('var(--mx-color-accent)')}; }` },
    { id: 'mono', label: 'Mono caps', hint: 'Editorial and technical', css: `display: inline-block; padding: 0; background: none; border: 0; color: ${ink('var(--mx-color-muted)')}; font-family: var(--mx-font-mono); font-size: var(--mx-text-xs); letter-spacing: 0.12em; text-transform: uppercase;` },
    { id: 'solid', label: 'Solid', hint: 'A filled tag that stands out: “New”, “Popular”', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: var(--mx-space-1) var(--mx-space-3); border-radius: 999px; border: 0; background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; font-size: var(--mx-text-xs); font-weight: 600; letter-spacing: 0.02em;` },
    { id: 'square', label: 'Square', hint: 'A tinted label with small corners; tidy in dense layouts', css: `display: inline-flex; align-items: center; gap: var(--mx-space-2); padding: var(--mx-space-1) var(--mx-space-2); border-radius: ${radius('var(--mx-radius-sm)')}; border: 0; background: color-mix(in oklab, var(--mx-color-text) 7%, transparent); color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-xs); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;` },
    { id: 'line', label: 'Line', hint: 'A short accent rule before the words', css: `display: inline-flex; align-items: center; gap: var(--mx-space-3); padding: 0; background: none; border: 0; color: ${ink('var(--mx-color-text)')}; font-size: var(--mx-text-sm); font-weight: 600; &::before { content: ""; width: 24px; height: calc(var(--mx-stroke) * 2); background: ${fill('var(--mx-color-accent)')}; }` },
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
    { id: 'light', label: 'Light', hint: 'A thin, airy weight; elegant at large sizes', css: `font-weight: 300; letter-spacing: -0.03em; color: ${ink('inherit')};` },
    { id: 'heavy', label: 'Heavy', hint: 'Black weight and tight spacing: confident', css: `font-weight: 800; letter-spacing: -0.04em; line-height: 1; color: ${ink('inherit')};` },
    { id: 'accent', label: 'Accent', hint: 'Set in your accent color; use once per page', css: `color: ${ink(fill('var(--mx-color-accent)'))};` },
  ],
  text: [
    { id: 'lead', label: 'Lead', hint: 'A larger opening paragraph', css: `font-size: var(--mx-text-lg); line-height: 1.5; color: ${ink('var(--mx-color-text)')};` },
    { id: 'muted', label: 'Muted', hint: 'Supporting detail', css: `color: ${ink('var(--mx-color-muted)')};` },
    { id: 'mono', label: 'Mono', hint: 'Technical notes and captions', css: `font-family: var(--mx-font-mono); font-size: var(--mx-text-sm); letter-spacing: 0.01em; color: ${ink('inherit')};` },
    { id: 'callout', label: 'Callout', hint: 'Set apart with an accent rule', css: `padding-left: var(--mx-space-4); border-left: calc(var(--mx-stroke) * 3) solid ${fill('var(--mx-color-accent)')}; color: ${ink('inherit')};` },
    { id: 'small', label: 'Small', hint: 'Fine print and footnotes', css: `font-size: var(--mx-text-sm); line-height: 1.5; color: ${ink('var(--mx-color-muted)')};` },
    { id: 'caps', label: 'Caps', hint: 'Small spaced capitals for labels', css: `font-size: var(--mx-text-xs); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${ink('var(--mx-color-muted)')};` },
    { id: 'boxed', label: 'Boxed', hint: 'A soft tinted box for a note or tip', css: `padding: var(--mx-space-4) var(--mx-space-5); border-radius: ${radius('var(--mx-radius)')}; background: color-mix(in oklab, ${fill('var(--mx-color-accent)')} 10%, transparent); color: ${ink('inherit')};` },
  ],
  card: [
    { id: 'flat', label: 'Flat', hint: 'No container: content on the page', css: `background: none; border: 0; box-shadow: none; padding: 0;` },
    { id: 'bordered', label: 'Bordered', hint: 'Calm structure for dense grids', css: `${CARD_BASE} background: ${fill('var(--mx-color-bg)')}; border: var(--mx-stroke) solid var(--mx-color-border); box-shadow: ${shadow('none')};` },
    { id: 'raised', label: 'Raised', hint: 'Lifts off the page; one level of depth', css: `${CARD_BASE} background: ${fill('var(--mx-color-surface)')}; border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-border) 50%, transparent); box-shadow: ${shadow('var(--mx-shadow-card)')};` },
    { id: 'tinted', label: 'Tinted', hint: 'A wash of your primary', css: `${CARD_BASE} background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 9%, var(--mx-color-bg)); border: var(--mx-stroke) solid color-mix(in oklab, ${fill('var(--mx-color-primary)')} 18%, transparent); box-shadow: ${shadow('none')};` },
    { id: 'glass', label: 'Glass', hint: 'Frosted, over color or imagery', css: `${CARD_BASE} background: color-mix(in oklab, var(--mx-color-bg) 62%, transparent); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4); border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-bg) 70%, transparent); box-shadow: ${shadow('var(--mx-shadow-card)')};` },
    { id: 'offset', label: 'Offset', hint: 'A hard shadow: bold and graphic', css: `${CARD_BASE} background: ${fill('var(--mx-color-bg)')}; border: calc(var(--mx-stroke) * 2) solid var(--mx-color-text); box-shadow: 6px 6px 0 var(--mx-color-text);` },
    // Words inside follow the flip: muted text and borders are re-pointed at the primary's own ink.
    { id: 'inverse', label: 'Inverse', hint: 'Filled with your primary: the one card that leads', css: `${CARD_BASE} background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')}; --mx-color-text: ${ink('var(--mx-color-on-primary)')}; --mx-color-muted: color-mix(in oklab, ${ink('var(--mx-color-on-primary)')} 72%, transparent); --mx-color-border: color-mix(in oklab, ${ink('var(--mx-color-on-primary)')} 22%, transparent); border: var(--mx-stroke) solid transparent; box-shadow: ${shadow('none')};` },
    { id: 'dashed', label: 'Dashed', hint: 'A sketchy outline: drafts, empty states, “coming soon”', css: `${CARD_BASE} background: ${fill('transparent')}; border: calc(var(--mx-stroke) * 1.5) dashed color-mix(in oklab, var(--mx-color-text) 28%, transparent); box-shadow: ${shadow('none')};` },
    { id: 'rule', label: 'Top rule', hint: 'An accent line across the top; quiet and editorial', css: `padding: var(--mx-space-6) 0 0; border-radius: 0; background: ${fill('transparent')}; border: 0; border-top: calc(var(--mx-stroke) * 2) solid var(--mx-color-accent); box-shadow: ${shadow('none')};` },
  ],
  // Pictures: a few frames that read as decisions, not effects. Anything more is a job for the image itself.
  image: [
    { id: 'rounded', label: 'Your radius', hint: 'Corners from your style guide', css: `border-radius: ${radius('var(--mx-radius-lg)')}; overflow: hidden;` },
    { id: 'square', label: 'Square', hint: 'Sharp corners, edge to edge', css: `border-radius: 0; overflow: hidden;` },
    { id: 'circle', label: 'Circle', hint: 'For portraits and avatars', css: `border-radius: 50%; aspect-ratio: 1; overflow: hidden;` },
  ],
  icon: [
    { id: 'tile', label: 'Tile', hint: 'A soft square behind the icon', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: ${radius('var(--mx-radius)')}; background: color-mix(in oklab, ${fill('var(--mx-color-primary)')} 14%, transparent); color: ${ink('var(--mx-color-primary)')};` },
    { id: 'circle', label: 'Circle', hint: 'A solid round badge', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: ${fill('var(--mx-color-primary)')}; color: ${ink('var(--mx-color-on-primary)')};` },
    { id: 'bare', label: 'Bare', hint: 'Just the glyph', css: `background: none; border: 0; box-shadow: none; color: ${ink('var(--mx-color-text)')};` },
    { id: 'ring', label: 'Ring', hint: 'A hairline circle; light and precise', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: none; border: var(--mx-stroke) solid color-mix(in oklab, var(--mx-color-text) 24%, transparent); color: ${ink('var(--mx-color-text)')};` },
    { id: 'accent', label: 'Accent', hint: 'Your accent color, softly tiled', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: ${radius('var(--mx-radius)')}; background: color-mix(in oklab, ${fill('var(--mx-color-accent)')} 16%, transparent); color: ${ink(fill('var(--mx-color-accent)'))};` },
    { id: 'raised', label: 'Raised', hint: 'A small card that holds the icon', css: `display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: ${radius('var(--mx-radius)')}; background: ${fill('var(--mx-color-bg)')}; border: var(--mx-stroke) solid var(--mx-color-border); box-shadow: ${shadow('var(--mx-shadow-card)')}; color: ${ink('var(--mx-color-text)')};` },
  ],
  input: [
    { id: 'outlined', label: 'Outlined', hint: 'The clearest field', css: `background: var(--mx-color-bg); border: calc(var(--mx-stroke) * 1.5) solid var(--mx-color-border); border-radius: ${radius('var(--mx-radius)')}; min-height: 44px; padding: var(--mx-space-3) var(--mx-space-4); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; outline-offset: 1px; }` },
    { id: 'filled', label: 'Filled', hint: 'Softer; good on plain backgrounds', css: `background: color-mix(in oklab, var(--mx-color-text) 6%, transparent); border: var(--mx-stroke) solid transparent; border-radius: ${radius('var(--mx-radius)')}; min-height: 44px; padding: var(--mx-space-3) var(--mx-space-4); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; }` },
    { id: 'underline', label: 'Underline', hint: 'Minimal, editorial forms', css: `background: none; border: 0; border-bottom: calc(var(--mx-stroke) * 1.5) solid var(--mx-color-border); border-radius: 0; min-height: 44px; padding: var(--mx-space-2) 0; &:focus { outline: none; border-bottom-color: ${fill('var(--mx-color-primary)')}; }` },
    { id: 'pill', label: 'Pill', hint: 'Rounded ends; pairs with pill buttons', css: `background: var(--mx-color-bg); border: calc(var(--mx-stroke) * 1.5) solid var(--mx-color-border); border-radius: 999px; min-height: 44px; padding: var(--mx-space-3) var(--mx-space-5); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; outline-offset: 1px; }` },
    { id: 'inset', label: 'Inset', hint: 'Pressed into the surface; calm on busy pages', css: `background: var(--mx-color-surface); border: var(--mx-stroke) solid var(--mx-color-border); border-radius: ${radius('var(--mx-radius)')}; box-shadow: inset 0 1px 3px color-mix(in oklab, var(--mx-color-text) 10%, transparent); min-height: 44px; padding: var(--mx-space-3) var(--mx-space-4); &:focus { outline: 2px solid ${fill('var(--mx-color-primary)')}; outline-offset: 1px; }` },
  ],
}
VARIANTS.item = VARIANTS.card

/** Hover looks only where a real pointer hovers, so touch screens don't get stuck in a hover state. */
export function gateHover(css: string): string {
  return css.replace(/&:hover(::?[a-z-]+)?\s*\{([^{}]*)\}/g, (_, pseudo = '', body) => `@media (hover: hover) and (pointer: fine) { &:hover${pseudo} {${body}} }`)
}
for (const list of Object.values(VARIANTS)) for (const v of list ?? []) v.css = gateHover(v.css)

export function variantsFor(kind: BlockKind): Variant[] {
  return VARIANTS[kind] ?? []
}

export function findVariant(kind: BlockKind, id: string | undefined): Variant | undefined {
  return id ? variantsFor(kind).find((v) => v.id === id) : undefined
}
