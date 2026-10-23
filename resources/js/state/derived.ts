import { useMemo } from 'react'
import type { BlockEdit, Clip, GuideState, ProjectContent, ResolvedGuide, SectionSpacing, Slot, Swatch, TokenSet } from '@/core/types'
import { blockCss, effectiveEdit, sectionSpacingCss, slug } from '@/core/blocks/style'
import { resolveGuide } from '@/core/guide'
import { resolveFields } from '@/core/content'
import { BASE_FONTS, expandTokens, fontHref, fontsForTokens, varsToCss } from '@/core/tokens'
import { allFonts } from '@/core/library'
import { library } from '@/data/library'
import type { FrameState } from '@/frame/bridge'
import { useStore, type Mode, type Viewport } from './store'

export const FONT_CATALOG = [...allFonts(library), ...BASE_FONTS]

export const VIEWPORT_VH: Record<Viewport, string> = { desktop: '9px', mobile: '8.44px' }

/** Page-wide block defaults and extra colours, for frameStateFor. */
export function usePageStyle(): Pick<GuideState, 'swatches' | 'components'> {
  const swatches = useStore((s) => s.guide.swatches)
  const components = useStore((s) => s.guide.components)
  return useMemo(() => ({ swatches, components }), [swatches, components])
}

export function useResolvedGuide(): ResolvedGuide {
  const guide = useStore((s) => s.guide)
  return useMemo(() => resolveGuide(guide), [guide])
}

const cssCache = new Map<string, string>()
export function tokensCssFor(tokens: TokenSet, vh: string): string {
  const key = JSON.stringify(tokens) + vh
  let css = cssCache.get(key)
  if (!css) {
    css = varsToCss(expandTokens(tokens, { vh }))
    if (cssCache.size > 200) cssCache.clear()
    cssCache.set(key, css)
  }
  return css
}

export function fontHrefFor(tokens: TokenSet): string | null {
  return fontHref(fontsForTokens(tokens, FONT_CATALOG))
}

/** What a clip should look like in a given slot, mode and style guide. */
export function frameStateFor(
  clip: Clip,
  slot: Pick<Slot, 'keep' | 'words' | 'edits' | 'spacing'> | null,
  mode: Mode,
  guide: TokenSet,
  content: ProjectContent,
  viewport: Viewport,
  page?: Pick<GuideState, 'swatches' | 'components'>,
): FrameState {
  const vh = VIEWPORT_VH[viewport]
  if (mode === 'captured' || !slot) {
    return { css: tokensCssFor(clip.tokens, vh), motion: true, fields: null, fonts: [fontHrefFor(clip.tokens)], outline: false, blocks: NO_BLOCKS }
  }
  const tokens = slot.keep.style ? clip.tokens : guide
  const own = slot.words && Object.keys(slot.words).length ? slot.words : undefined
  return {
    css: tokensCssFor(tokens, vh) + swatchCss(page?.swatches),
    motion: slot.keep.motion,
    fields: slot.keep.content && !own ? null : resolveFields(clip.type, clip.fields, content, slot.keep.content, own).fields,
    fonts: [fontHrefFor(tokens)],
    outline: !slot.keep.layout,
    blocks: blocksFor(clip, slot.edits?.[clip.id], page?.components, slot.spacing),
  }
}

const NO_BLOCKS: FrameState['blocks'] = { css: '', variants: {} }

/** Extra brand colours, as --mx-color-x-<name>. */
export function swatchCss(swatches: Swatch[] | undefined): string {
  if (!swatches?.length) return ''
  return `\n:root { ${swatches.map((w) => `--mx-color-x-${slug(w.name)}: ${w.value};`).join(' ')} }`
}

function blocksFor(
  clip: Clip,
  edits: Record<string, BlockEdit> | undefined,
  components: GuideState['components'],
  spacing: SectionSpacing | undefined,
): FrameState['blocks'] {
  if (!edits && !components && !spacing) return NO_BLOCKS
  const variants: Record<string, string> = {}
  for (const b of clip.blocks) {
    const e = effectiveEdit(edits?.[b.id], components?.[b.kind])
    if (e?.variant) variants[b.id] = e.variant
  }
  const css = [blockCss({ blocks: clip.blocks, edits, components, select: (b) => `[data-mx-b="${b.id}"]` }), sectionSpacingCss(spacing, '[data-mx-section]')]
    .filter(Boolean)
    .join('\n')
  return css || Object.keys(variants).length ? { css, variants } : NO_BLOCKS
}
