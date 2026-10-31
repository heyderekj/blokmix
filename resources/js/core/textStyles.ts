import type { BlockInfo, GuideState } from './types'

/**
 * Text styles, Figma's way: a short set of named styles (Display, Heading 1–4, Body large, Body, Small, Caption, Label),
 * each a font, a step on the guide's type scale (and a smaller one on phones), a weight, line height, letter spacing
 * and case. They sit on top of the type scale, so the Type dial still moves every size.
 *
 * A block uses a style when you pick one for it (`BlockStyle.text`), or, once you've edited a style in the guide, every
 * block that reads as that style (`autoTextStyle`: main headlines are Display, section headings Heading 2…). A layout
 * looks exactly as authored until then. A size (`BlockStyle.size`) overrides just one block's size.
 */

export const TEXT_STYLES = ['display', 'h1', 'h2', 'h3', 'h4', 'bodyLarge', 'body', 'small', 'caption', 'label'] as const
export type TextStyleId = (typeof TEXT_STYLES)[number]

export const TYPE_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'] as const
export type TypeStep = (typeof TYPE_STEPS)[number]

export interface TextStyleDef {
  font: 'display' | 'body' | 'mono'
  size: TypeStep
  /** Phones (≤760px); absent = the same size. */
  phone?: TypeStep
  /** A weight, or 'display' for the guide's display weight (type.displayWeight). */
  weight: number | 'display'
  leading: number
  /** In em. */
  tracking: number
  upper?: boolean
}

export const TEXT_STYLE_LABEL: Record<TextStyleId, string> = {
  display: 'Display',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  bodyLarge: 'Body large',
  body: 'Body',
  small: 'Small',
  caption: 'Caption',
  label: 'Label',
}

export const DEFAULT_TEXT_STYLES: Record<TextStyleId, TextStyleDef> = {
  display: { font: 'display', size: '6xl', phone: '4xl', weight: 'display', leading: 1.05, tracking: -0.02 },
  h1: { font: 'display', size: '5xl', phone: '3xl', weight: 'display', leading: 1.1, tracking: -0.02 },
  h2: { font: 'display', size: '4xl', phone: '2xl', weight: 'display', leading: 1.15, tracking: -0.01 },
  h3: { font: 'display', size: '2xl', phone: 'xl', weight: 'display', leading: 1.25, tracking: -0.01 },
  h4: { font: 'display', size: 'xl', phone: 'lg', weight: 600, leading: 1.3, tracking: 0 },
  bodyLarge: { font: 'body', size: 'lg', phone: 'base', weight: 400, leading: 1.55, tracking: 0 },
  body: { font: 'body', size: 'base', weight: 400, leading: 1.6, tracking: 0 },
  small: { font: 'body', size: 'sm', weight: 400, leading: 1.5, tracking: 0 },
  caption: { font: 'body', size: 'xs', weight: 400, leading: 1.45, tracking: 0.01 },
  label: { font: 'body', size: 'xs', weight: 600, leading: 1.3, tracking: 0.06, upper: true },
}

export type TextStyleEdits = Partial<Record<TextStyleId, Partial<TextStyleDef>>>

/** The guide's text styles: the defaults with your edits on top. */
export function resolveTextStyles(edits: TextStyleEdits | undefined): Record<TextStyleId, TextStyleDef> {
  return Object.fromEntries(TEXT_STYLES.map((id) => [id, { ...DEFAULT_TEXT_STYLES[id], ...edits?.[id] }])) as Record<TextStyleId, TextStyleDef>
}

/** The styles you've changed: only these restyle blocks you didn't pick a style for. */
export const editedTextStyles = (edits: TextStyleEdits | undefined) => new Set((Object.keys(edits ?? {}) as TextStyleId[]).filter((id) => Object.keys(edits?.[id] ?? {}).length))

const within = (b: BlockInfo, blocks: BlockInfo[], kinds: string[]) => {
  for (let p = blocks.find((x) => x.id === b.parent); p; p = blocks.find((x) => x.id === p!.parent)) if (kinds.includes(p.kind)) return true
  return false
}

/** The style a block reads as, from what it is and where it sits: what editing that style restyles. */
export function autoTextStyle(b: BlockInfo, blocks: BlockInfo[]): TextStyleId | undefined {
  const f = b.field ?? ''
  if (b.kind === 'badge') return 'label'
  if (b.kind === 'heading') {
    if (f === 'headline') return 'display'
    if (within(b, blocks, ['item', 'card'])) return 'h4'
    if (f === 'heading') return 'h2'
    return 'h3'
  }
  if (b.kind === 'text') {
    if (/^(intro|subhead|lead)$/.test(f)) return 'bodyLarge'
    if (/^(note|caption|footnote|legal)$/.test(f) || /Role$|Meta$/.test(f)) return 'small'
    return 'body'
  }
  return undefined
}

const stepOf = (s: TypeStep) => TYPE_STEPS.indexOf(s)

/** The line height that suits a size: roomy for reading sizes, tight for display sizes. */
export function leadingFor(s: TypeStep): number {
  return ({ xs: 1.5, sm: 1.55, base: 1.6, lg: 1.5, xl: 1.35, '2xl': 1.25, '3xl': 1.18, '4xl': 1.12, '5xl': 1.08, '6xl': 1.05 } as const)[s]
}
/** Big sizes come down two steps on phones when nothing says otherwise. */
export const phoneStep = (s: TypeStep): TypeStep => (stepOf(s) >= stepOf('3xl') ? TYPE_STEPS[stepOf(s) - 2] : s)
export const nudgeStep = (s: TypeStep, by: number): TypeStep => TYPE_STEPS[Math.min(TYPE_STEPS.length - 1, Math.max(0, stepOf(s) + by))]

/** CSS declarations for a style (desktop and phones), and for a block's own size on top. */
export function textDecl(def: TextStyleDef | undefined, size: TypeStep | undefined): { desktop: string[]; phone: string[] } {
  const desktop: string[] = []
  const phone: string[] = []
  if (def) {
    desktop.push(
      `font-family: var(--mx-font-${def.font});`,
      `font-size: var(--mx-text-${def.size});`,
      `font-weight: ${def.weight === 'display' ? 'var(--mx-type-display-weight)' : def.weight};`,
      `line-height: ${def.leading};`,
      `letter-spacing: ${def.tracking}em;`,
      `text-transform: ${def.upper ? 'uppercase' : 'none'};`,
    )
    if (def.phone && def.phone !== def.size && !size) phone.push(`font-size: var(--mx-text-${def.phone});`)
  }
  if (size) {
    // A block's own size brings the line height that suits it, so a heading made small doesn't keep display leading.
    desktop.push(`font-size: var(--mx-text-${size});`, `line-height: ${leadingFor(size)};`)
    if (phoneStep(size) !== size) phone.push(`font-size: var(--mx-text-${phoneStep(size)});`)
  }
  return { desktop, phone }
}

/** Which style a block shows: the one you picked (or none), else its own once you've edited that style. */
export function blockTextStyle(
  b: BlockInfo,
  blocks: BlockInfo[],
  picked: TextStyleId | 'none' | undefined,
  guide: Pick<GuideState, 'textStyles'> | undefined,
): TextStyleId | undefined {
  if (picked === 'none') return undefined
  if (picked) return picked
  const auto = autoTextStyle(b, blocks)
  return auto && editedTextStyles(guide?.textStyles).has(auto) ? auto : undefined
}
