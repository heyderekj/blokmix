import type { BlockEdit, BlockInfo, BlockKind, BlockStyle, ColorRef, ComponentDefault, SectionSpace, SectionSpacing, SlotEdits } from '../types'
import { TOKEN_KEYS } from '../types'
import { findVariant } from './variants'

const COLOR_TOKENS = new Set(TOKEN_KEYS.filter((k) => k.startsWith('color.')).map((k) => k.slice(6)))

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** A palette reference as CSS: 'primary' → var(--mx-color-primary), 'x:brand/20' → a 20% tint over the page. */
export function colorCss(ref: ColorRef): string | null {
  const [name, mix] = ref.split('/')
  let v: string
  if (name.startsWith('x:')) v = `var(--mx-color-x-${slug(name.slice(2))})`
  else if (COLOR_TOKENS.has(name)) v = `var(--mx-color-${kebab(name)})`
  else return null
  const n = Number(mix)
  return mix && n > 0 && n < 100 ? `color-mix(in oklab, ${v} ${n}%, var(--mx-color-bg))` : v
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour'

const RADIUS: Record<NonNullable<BlockStyle['radius']>, string> = {
  none: '0px',
  sm: 'var(--mx-radius-sm)',
  md: 'var(--mx-radius)',
  lg: 'var(--mx-radius-lg)',
  pill: '999px',
}
const SHADOW: Record<NonNullable<BlockStyle['shadow']>, string> = {
  none: 'none',
  soft: 'var(--mx-shadow-card)',
  lifted: '0 2px 4px color-mix(in oklab, var(--mx-color-text) 8%, transparent), 0 18px 40px -12px color-mix(in oklab, var(--mx-color-text) 30%, transparent)',
  offset: '5px 5px 0 var(--mx-color-text)',
}

/** Which tokens a fill or ink pick stands in for, per kind, when there's no variant to read --b-*. */
const FILL_TOKEN: Partial<Record<BlockKind, string[]>> = {
  button: ['--mx-color-primary'],
  badge: ['--mx-color-primary'],
  icon: ['--mx-color-primary'],
  link: ['--mx-color-primary'],
  card: ['--mx-color-surface', '--mx-color-bg'],
  item: ['--mx-color-surface', '--mx-color-bg'],
  image: ['--mx-color-surface', '--mx-color-primary'],
  heading: ['--mx-color-accent'],
  text: ['--mx-color-accent'],
  input: ['--mx-color-primary'],
}
const INK_TOKEN: Partial<Record<BlockKind, string[]>> = {
  button: ['--mx-color-on-primary', '--mx-color-text'],
  badge: ['--mx-color-text'],
  icon: ['--mx-color-primary', '--mx-color-text'],
}

/** The block's edit with any page-wide default for its kind underneath. */
export function effectiveEdit(edit: BlockEdit | undefined, def: ComponentDefault | undefined): BlockEdit | undefined {
  if (!edit && !def) return undefined
  return {
    variant: edit?.variant ?? def?.variant,
    style: def?.style || edit?.style ? { ...def?.style, ...edit?.style } : undefined,
    motion: edit?.motion,
    media: edit?.media,
    icon: edit?.icon,
    hidden: edit?.hidden,
  }
}

export interface BlockCssInput {
  blocks: BlockInfo[]
  edits: Record<string, BlockEdit> | undefined
  components?: Partial<Record<BlockKind, ComponentDefault>>
  /** Selector for one block: canvas uses [data-mx-b="b3"], exports use a class. */
  select: (b: BlockInfo) => string
}

/**
 * CSS for a section's block edits and page-wide defaults, inside @layer blocks
 * so it always wins over the clip's own CSS (in @layer clip) without
 * specificity tricks. Returns '' when nothing is changed.
 */
export function blockCss(i: BlockCssInput): string {
  const rules: string[] = []
  for (const b of i.blocks) {
    const e = effectiveEdit(i.edits?.[b.id], i.components?.[b.kind])
    if (!e) continue
    const decl: string[] = []
    if (e.hidden) decl.push('display: none;')
    const s = e.style
    const f = s?.fill ? colorCss(s.fill) : null
    const k = s?.ink ? colorCss(s.ink) : null
    if (f) {
      decl.push(`--b-fill: ${f};`)
      for (const t of FILL_TOKEN[b.kind] ?? []) decl.push(`${t}: ${f};`)
    }
    if (k) {
      decl.push(`--b-ink: ${k};`)
      for (const t of INK_TOKEN[b.kind] ?? ['--mx-color-text']) decl.push(`${t}: ${k};`)
      decl.push(`color: ${k};`)
    }
    if (s?.radius) decl.push(`--b-radius: ${RADIUS[s.radius]}; border-radius: ${RADIUS[s.radius]};`)
    if (s?.shadow) decl.push(`--b-shadow: ${SHADOW[s.shadow]}; box-shadow: ${SHADOW[s.shadow]};`)
    const sp = (n: number) => `var(--mx-space-${n})`
    if (s?.padding !== undefined) decl.push(`padding: ${sp(s.padding)};`)
    if (s?.above !== undefined) decl.push(`margin-block-start: ${sp(s.above)};`)
    if (s?.below !== undefined) decl.push(`margin-block-end: ${sp(s.below)};`)
    if (s?.gap !== undefined) decl.push(`gap: ${sp(s.gap)};`)
    const v = findVariant(b.kind, e.variant)
    // Variant first so the explicit picks above (declared after) win on the same element.
    const body = [v ? v.css : '', decl.join(' ')].filter(Boolean).join('\n  ')
    if (body) rules.push(`${i.select(b)} {\n  ${body}\n}`)
  }
  return rules.length ? `@layer blocks {\n${rules.join('\n')}\n}` : ''
}

export function editsFor(edits: SlotEdits | undefined, clipId: string) {
  return edits?.[clipId]
}

const SECTION_SPACE: Record<Exclude<SectionSpace, 'default'>, string> = {
  none: '0px',
  tight: 'calc(var(--mx-space-section) * 0.5)',
  roomy: 'calc(var(--mx-space-section) * 1.5)',
}

/** A section's own top and bottom padding, in @layer blocks so it beats the clip. */
export function sectionSpacingCss(spacing: SectionSpacing | undefined, selector: string): string {
  const decl: string[] = []
  if (spacing?.top && spacing.top !== 'default') decl.push(`padding-top: ${SECTION_SPACE[spacing.top]};`)
  if (spacing?.bottom && spacing.bottom !== 'default') decl.push(`padding-bottom: ${SECTION_SPACE[spacing.bottom]};`)
  return decl.length ? `@layer blocks {\n${selector} { ${decl.join(' ')} }\n}` : ''
}
