import type { BlockEdit, Clip, CssVars, FontSource, GuideState, Keep, Library, ProjectContent, ResolvedGuide, SectionType, Slot, TokenSet } from './types'
import { applyFields, attr, mapTree, parseHtml, type HEl, type HNode } from './html/parse'
import { blockCss, effectiveEdit, sectionSpacingCss, slug } from './blocks/style'
import { LAYER_ORDER } from './export/base-css'
import { resolveFields } from './content'
import { BASE_FONTS, expandTokens, fontsForTokens, varsToCss } from './tokens'
import { allFonts } from './library'

export interface ComposedSection {
  slotId: string
  position: number
  type: SectionType
  component: string
  clip: Clip
  keep: Keep
  tree: HNode[]
  /** Section CSS including local token overrides when the section keeps its own style. */
  css: string
  motionCss: string | null
  localVars: CssVars | null
  /** Block looks you changed: variant and style per block, for the packet. */
  blocks: { id: string; label: string; kind: string; edit: BlockEdit }[]
  retained: string[]
  notes: string[]
}

export interface ComposedPage {
  title: string
  tokens: TokenSet
  vars: CssVars
  fonts: FontSource[]
  sections: ComposedSection[]
}

export interface ComposeInput {
  slots: Slot[]
  guide: ResolvedGuide
  content: ProjectContent
  library: Library
  slotNotes?: Record<string, string[]>
  title?: string
  /** Extra brand colours and page-wide block looks from the style guide. */
  page?: Pick<GuideState, 'swatches' | 'components'>
}

const pascal = (s: string) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')

export function componentName(clip: Clip): string {
  const folder = clip.id.split('.')[1]
  return pascal(clip.type) + pascal(folder)
}

/** Everything the exporters, the packet and the reference build share. */
export function composePage(input: ComposeInput): ComposedPage {
  const catalog = [...allFonts(input.library), ...BASE_FONTS]
  const fonts = new Map<string, FontSource>()
  const addFonts = (t: TokenSet) => fontsForTokens(t, catalog).forEach((f) => fonts.set(f.family, f))
  addFonts(input.guide.tokens)

  const used = new Map<string, number>()
  const sections: ComposedSection[] = []

  input.slots.forEach((slot, position) => {
    const clip = input.library.clips[slot.clipId]
    if (!clip) return
    let component = componentName(clip)
    const n = (used.get(component) ?? 0) + 1
    used.set(component, n)
    if (n > 1) component += n

    const { fields, retained } = resolveFields(clip.type, clip.fields, input.content, slot.keep.content, slot.words)

    // Blocks with a changed look get a class (unique to this section) that the block CSS targets.
    const edits = slot.edits?.[clip.id]
    const changed = clip.blocks
      .map((b) => ({ b, edit: effectiveEdit(edits?.[b.id], input.page?.components?.[b.kind]) }))
      .filter((x): x is { b: (typeof x)['b']; edit: BlockEdit } => !!x.edit)
    const blockClass = (id: string) => `mx-s${position + 1}-${id}`
    const changedIds = new Set(changed.map((x) => x.b.id))
    let order = 0
    const spaced = !!sectionSpacingCss(slot.spacing, 'x')
    const addClass = (el: HEl, cls: string): HEl => ({
      ...el,
      attrs: el.attrs.some(([k]) => k === 'class') ? el.attrs.map(([k, v]) => (k === 'class' ? [k, `${v} ${cls}`] : [k, v])) : [...el.attrs, ['class', cls]],
    })
    const marked = mapTree(parseHtml(clip.html), (el) => {
      if (spaced && attr(el, 'data-mx-section') !== undefined) return addClass(el, `mx-s${position + 1}`)
      if (attr(el, 'data-mx-block') === undefined) return el
      const id = `b${order++}`
      return changedIds.has(id) ? addClass(el, blockClass(id)) : el
    })
    const tree = applyFields(marked, fields)
    const blocksCss = blockCss({
      blocks: clip.blocks,
      edits,
      components: input.page?.components,
      select: (b) => `.${clip.rootClass}.${blockClass(b.id)}, .${clip.rootClass} .${blockClass(b.id)}`,
    }) + (spaced ? `\n${sectionSpacingCss(slot.spacing, `.${clip.rootClass}.mx-s${position + 1}`)}` : '')

    let localVars: CssVars | null = null
    let css = clip.css
    if (slot.keep.style) {
      const { ['--mx-vh']: _vh, ...rest } = expandTokens(clip.tokens)
      localVars = rest
      css = `${varsToCss(rest, `.${clip.rootClass}`)}\n\n${css}`
      addFonts(clip.tokens)
    }

    const motionCss =
      slot.keep.motion && clip.motionCss
        ? `@layer motion {\n  @media (prefers-reduced-motion: no-preference) {\n${indent(clip.motionCss, '    ')}\n  }\n}`
        : null
    // Layers keep the cascade simple: a block's look always beats the clip's own CSS.
    // The order is repeated in each file so it holds whichever stylesheet a bundler loads first.
    css = `${LAYER_ORDER}\n\n@layer clip {\n${indent(css)}\n}${blocksCss ? `\n\n/* Blocks you restyled */\n${blocksCss}` : ''}`

    sections.push({
      slotId: slot.id,
      position,
      type: clip.type,
      component,
      clip,
      keep: slot.keep,
      tree,
      css,
      motionCss,
      localVars,
      blocks: changed.map(({ b, edit }) => ({ id: b.id, label: b.label, kind: b.kind, edit })),
      retained: slot.keep.content ? [] : retained,
      notes: input.slotNotes?.[slot.id] ?? [],
    })
  })

  return {
    title: input.title ?? input.content.brand,
    tokens: input.guide.tokens,
    vars: {
      ...expandTokens(input.guide.tokens),
      ...Object.fromEntries((input.page?.swatches ?? []).map((w) => [`--mx-color-x-${slug(w.name)}`, w.value])),
    },
    fonts: [...fonts.values()],
    sections,
  }
}

function indent(s: string, by = '  '): string {
  return s
    .split('\n')
    .map((l) => (l ? by + l : l))
    .join('\n')
}
