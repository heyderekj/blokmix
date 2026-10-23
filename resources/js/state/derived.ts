import { useMemo } from 'react'
import type { BlockEdit, BlockInfo, Clip, GuideState, ProjectContent, ResolvedGuide, SectionMotion, SectionSpacing, Slot, Swatch, TokenSet } from '@/core/types'
import { blockCss, effectiveEdit, sectionSpacingCss, slug } from '@/core/blocks/style'
import { motionCss } from '@/core/motion'
import { renderMedia } from '@/core/media'
import { iconNamesIn, iconSvg } from '@/core/icons'
import { uploadData } from '@/lib/assets'
import { resolveGuide } from '@/core/guide'
import { resolveFields } from '@/core/content'
import { sectionClip } from '@/core/lists'
import { BANNER_CSS, BANNER_MOTION, bannerMoves } from '@/core/banner'
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
  libraryClip: Clip,
  slot: Pick<Slot, 'keep' | 'words' | 'edits' | 'spacing' | 'motion' | 'lists' | 'banner'> | null,
  mode: Mode,
  guide: TokenSet,
  content: ProjectContent,
  viewport: Viewport,
  page?: Pick<GuideState, 'swatches' | 'components'>,
): FrameState {
  const vh = VIEWPORT_VH[viewport]
  if (mode === 'captured' || !slot) {
    const clip = libraryClip
    return { css: tokensCssFor(clip.tokens, vh), motion: true, fields: null, fonts: [fontHrefFor(clip.tokens)], outline: false, blocks: NO_BLOCKS, media: NO_MEDIA, icons: null, lists: NO_LISTS }
  }
  // The clip as this section shows it: items you added, removed or reordered.
  const clip = sectionClip(libraryClip, slot.lists, { banner: slot.banner })
  const tokens = slot.keep.style ? clip.tokens : guide
  const own = slot.words && Object.keys(slot.words).length ? slot.words : undefined
  return {
    css: tokensCssFor(tokens, vh) + swatchCss(page?.swatches),
    // A motion preset (or None) replaces the clip's own motion.
    motion: slot.keep.motion && (!slot.motion || slot.motion.mode === 'captured'),
    fields: slot.keep.content && !own ? null : resolveFields(clip.type, clip.fields, content, slot.keep.content, own).fields,
    fonts: [fontHrefFor(tokens)],
    outline: !slot.keep.layout,
    blocks: withBanner(blocksFor(clip, slot.edits?.[clip.id], page?.components, slot.spacing, slot.motion), clip.extras?.banner ? bannerMoves(slot) : null),
    media: mediaFor(clip, slot.edits?.[clip.id], tokens),
    // A section keeping its own captured look keeps its own icons too.
    icons: slot.keep.style ? null : iconsFor(clip, slot.edits?.[clip.id], guide['icon.set']),
    lists: clip.patches.length ? clip.patches : NO_LISTS,
  }
}

const NO_LISTS: FrameState['lists'] = []

/** An added banner's CSS rides along with the block CSS (its scroll, unless the section's motion is off). */
function withBanner(b: FrameState['blocks'], moves: boolean | null): FrameState['blocks'] {
  if (moves === null) return b
  const css = [BANNER_CSS, moves ? BANNER_MOTION : '', b.css].filter(Boolean).join('\n')
  return { ...b, css }
}

const NO_BLOCKS: FrameState['blocks'] = { css: '', variants: {} }
const NO_MEDIA: FrameState['media'] = {}

const iconCache = new Map<string, FrameState['icons']>()
function iconsFor(clip: Clip, edits: Record<string, BlockEdit> | undefined, set: string): FrameState['icons'] {
  const overrides: Record<string, string> = {}
  for (const b of clip.blocks) if (b.kind === 'icon' && edits?.[b.id]?.icon) overrides[b.id] = edits[b.id].icon!
  const names = [...new Set([...iconNamesIn(clip.html), ...Object.values(overrides)])]
  if (!names.length) return null
  const key = JSON.stringify([set, names, overrides])
  let v = iconCache.get(key)
  if (!v) {
    v = { set, overrides, glyphs: Object.fromEntries(names.flatMap((n) => { const g = iconSvg(n, set); return g ? [[n, g]] : [] })) }
    if (iconCache.size > 300) iconCache.clear()
    iconCache.set(key, v)
  }
  return v
}

const mediaCache = new Map<string, FrameState['media'][string]>()
/** Pictures for image blocks; placeholders are redrawn from the current palette. */
function mediaFor(clip: Clip, edits: Record<string, BlockEdit> | undefined, tokens: TokenSet): FrameState['media'] {
  if (!edits) return NO_MEDIA
  const out: FrameState['media'] = {}
  for (const b of clip.blocks) {
    const fill = edits[b.id]?.media
    if (!fill || b.kind !== 'image') continue
    const key = JSON.stringify([fill, b.ratio, fill.source === 'placeholder' ? tokens : null])
    let m = mediaCache.get(key)
    if (!m) {
      m = renderMedia(fill, tokens, b.ratio, uploadData) ?? undefined
      if (m && !fill.asset) {
        if (mediaCache.size > 300) mediaCache.clear()
        mediaCache.set(key, m)
      }
    }
    if (m) out[b.id] = m
  }
  return Object.keys(out).length ? out : NO_MEDIA
}

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
  motion: SectionMotion | undefined,
): FrameState['blocks'] {
  if (!edits && !components && !spacing && motion?.mode !== 'preset') return NO_BLOCKS
  const variants: Record<string, string> = {}
  for (const b of clip.blocks) {
    const e = effectiveEdit(edits?.[b.id], components?.[b.kind])
    if (e?.variant) variants[b.id] = e.variant
  }
  const select = (b: BlockInfo) => `[data-mx-b="${b.id}"]`
  const moving = motionCss({
    blocks: clip.blocks,
    edits: (b) => effectiveEdit(edits?.[b.id], components?.[b.kind]),
    section: motion,
    select,
    root: '[data-mx-section]',
    prefix: 'mx-m',
    canvas: true,
  })
  const css = [blockCss({ blocks: clip.blocks, edits, components, select }), sectionSpacingCss(spacing, '[data-mx-section]'), moving]
    .filter(Boolean)
    .join('\n')
  return css || Object.keys(variants).length ? { css, variants } : NO_BLOCKS
}
