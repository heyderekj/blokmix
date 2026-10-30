import { useMemo } from 'react'
import { surfaceTokens } from '@/core/surface'
import { create } from 'zustand'
import type { TokenKey, BlockEdit, BlockInfo, Clip, GuideState, ProjectContent, ResolvedGuide, SectionMotion, SectionSpacing, Slot, Swatch, TokenSet } from '@/core/types'
import { backdropCss, backdropShaderId, effectsVars, type EffectsState, type ShaderSpec, type TreatmentValue } from '@/core/treatments'
import { blockCss, effectiveEdit, sectionSpacingCss, slug } from '@/core/blocks/style'
import { motionCss } from '@/core/motion'
import { renderMedia, shaderFor } from '@/core/media'
import { iconNamesIn, iconSvg } from '@/core/icons'
import { uploadData } from '@/lib/assets'
import { resolveGuide } from '@/core/guide'
import { resolveFields } from '@/core/content'
import { sectionClip, type SectionClip } from '@/core/lists'
import { sectionLinks, siteScope, type LinkScope } from '@/core/links'
import { BANNER_CSS, BANNER_MOTION, bannerMoves } from '@/core/banner'
import { BASE_FONTS, expandTokens, fontHrefs, fontsForTokens, varsToCss } from '@/core/tokens'
import { allFonts } from '@/core/library'
import { library } from '@/data/library'
import type { FrameState } from '@/frame/bridge'
import { useStore, type Mode, type Viewport } from './store'

export const FONT_CATALOG = [...allFonts(library), ...BASE_FONTS]

export const VIEWPORT_VH: Record<Viewport, string> = { desktop: '9px', mobile: '8.44px' }

/** Page-wide block defaults, extra colors and effects, for frameStateFor; and where links can lead from this page and from the shared nav and footer. */
export type PageStyle = Pick<GuideState, 'swatches' | 'components' | 'effects'> & { link?: { page: LinkScope; shared: LinkScope; sharedIds: string[] } }

/** Effects you're dialing, shown on every section before you let go. Not undoable state. */
export const useEffectPreview = create<{ effects: EffectsState | null; set: (effects: EffectsState | null) => void }>()((set) => ({
  effects: null,
  set: (effects) => set({ effects }),
}))

/** Page-wide things a section's frame needs: block defaults, extra colors, and the sections links can lead to. */
export function usePageStyle(): PageStyle {
  const swatches = useStore((s) => s.guide.swatches)
  const components = useStore((s) => s.guide.components)
  const saved = useStore((s) => s.guide.effects)
  const dialing = useEffectPreview((s) => s.effects)
  const effects = dialing ?? saved
  // Only the site's shape matters to links (pages, paths, which sections where), not every edit.
  const shape = useStore((s) => {
    const { pages, shared } = s.site
    const ids = (xs: Slot[]) => xs.map((x) => `${x.id}:${x.type}`).join(',')
    return `${s.ui.pageId}|${shared.nav?.id}|${shared.footer?.id}|${pages.map((p) => `${p.id}:${p.path}:${p.title}:${+p.show.nav}${+p.show.footer}[${ids(p.slots)}]`).join('|')}`
  })
  return useMemo(() => {
    const { site, ui } = useStore.getState()
    const here = site.pages.find((p) => p.id === ui.pageId) ?? site.pages[0]
    const sharedIds = [site.shared.nav?.id, site.shared.footer?.id].filter((x): x is string => !!x)
    return { swatches, components, effects, link: { page: siteScope(site, here.id), shared: siteScope(site, null), sharedIds } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swatches, components, effects, shape])
}

/** Where one section's links can lead: from its page, or from everywhere for the shared nav and footer. */
export function useLinkScope(slotId: string): LinkScope {
  const { link } = usePageStyle()
  return link!.sharedIds.includes(slotId) ? link!.shared : link!.page
}

/** A token value you're hovering in a picker (a font), shown on the page before you choose it. Not undoable state. */
export const useTokenPreview = create<{ preview: { key: TokenKey; value: string } | null; set: (p: { key: TokenKey; value: string } | null) => void }>()((set) => ({
  preview: null,
  set: (preview) => set({ preview }),
}))

export function useResolvedGuide(): ResolvedGuide {
  const guide = useStore((s) => s.guide)
  const preview = useTokenPreview((s) => s.preview)
  return useMemo(() => {
    const r = resolveGuide(guide)
    return preview ? { ...r, tokens: { ...r.tokens, [preview.key]: preview.value } } : r
  }, [guide, preview])
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

export function fontHrefsFor(tokens: TokenSet): string[] {
  return fontHrefs(fontsForTokens(tokens, FONT_CATALOG))
}

/** What a clip should look like in a given slot, mode and style guide. */
export function frameStateFor(
  libraryClip: Clip,
  slot: (Pick<Slot, 'keep' | 'words' | 'edits' | 'spacing' | 'motion' | 'lists' | 'banner' | 'surface' | 'backdrop'> & { id?: string }) | null,
  mode: Mode,
  guide: TokenSet,
  content: ProjectContent,
  viewport: Viewport,
  page?: PageStyle,
): FrameState {
  const vh = VIEWPORT_VH[viewport]
  if (mode === 'captured' || !slot) {
    const clip = libraryClip
    return { css: tokensCssFor(clip.tokens, vh), motion: true, fields: null, fonts: fontHrefsFor(clip.tokens), outline: false, blocks: NO_BLOCKS, media: NO_MEDIA, backdrop: null, icons: null, lists: NO_LISTS, links: NO_LINKS }
  }
  // The clip as this section shows it: items you added, removed or reordered.
  const clip = sectionClip(libraryClip, slot.lists, { banner: slot.banner })
  const tokens = slot.keep.style ? clip.tokens : surfaceTokens(guide, slot.surface)
  const own = slot.words && Object.keys(slot.words).length ? slot.words : undefined
  return {
    // A section keeping its own captured look keeps its own shadows too.
    css: tokensCssFor(tokens, vh) + swatchCss(page?.swatches) + (slot.keep.style ? '' : effectsCss(page?.effects, tokens)),
    // A motion preset (or None) replaces the clip's own motion.
    motion: slot.keep.motion && (!slot.motion || slot.motion.mode === 'captured'),
    fields: slot.keep.content && !own ? null : resolveFields(clip.type, clip.fields, content, slot.keep.content, own).fields,
    fonts: fontHrefsFor(tokens),
    outline: !slot.keep.layout,
    blocks: withBanner(blocksFor(clip, slot.edits?.[clip.id], page?.components, slot.spacing, slot.motion, slot.backdrop, tokens), clip.extras?.banner ? bannerMoves(slot) : null),
    media: mediaFor(clip, slot.edits?.[clip.id], tokens),
    backdrop: backdropShader(slot.backdrop, tokens),
    // A section keeping its own captured look keeps its own icons too.
    icons: slot.keep.style ? null : iconsFor(clip, slot.edits?.[clip.id], guide['icon.set']),
    lists: clip.patches.length ? clip.patches : NO_LISTS,
    links: linksFor(clip, slot, content, slot.id && page?.link ? (page.link.sharedIds.includes(slot.id) ? page.link.shared : page.link.page) : undefined),
  }
}

const NO_LINKS: FrameState['links'] = {}
const linkCache = new Map<string, FrameState['links']>()
/** Where the section's links lead, so previews can follow them. */
function linksFor(clip: SectionClip, slot: Parameters<typeof frameStateFor>[1] & object, content: ProjectContent, scope: LinkScope | undefined): FrameState['links'] {
  if (!scope || !slot.id || !clip.blocks.some((b) => b.linkable)) return NO_LINKS
  const fields = resolveFields(clip.type, clip.fields, content, slot.keep.content, slot.words).fields
  const resolved = sectionLinks(clip.blocks, slot.edits?.[clip.id], fields, scope, slot.id)
  const out = Object.fromEntries(Object.entries(resolved).map(([id, l]) => [id, { href: l.href, slot: l.slotId, newTab: l.newTab }]))
  const key = JSON.stringify(out)
  const hit = linkCache.get(key)
  if (hit) return hit
  if (linkCache.size > 300) linkCache.clear()
  linkCache.set(key, out)
  return out
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
    const key = JSON.stringify([fill, b.ratio, fill.source === 'placeholder' || fill.source === 'mock' || fill.source === 'shader' ? tokens : null])
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

/** A frame's state without its live shaders (the backdrop's CSS stand-in stays), for frames that aren't on show. */
export function withoutShaders(s: FrameState): FrameState {
  const live = Object.entries(s.media).filter(([, m]) => m.kind === 'shader')
  if (!s.backdrop && !live.length) return s
  return { ...s, backdrop: null, media: live.length ? Object.fromEntries(Object.entries(s.media).filter(([, m]) => m.kind !== 'shader')) : s.media }
}

const shaderCache = new Map<string, ShaderSpec>()
/** A live backdrop's shader (its CSS stand-in and layer come with the block CSS). */
function backdropShader(v: TreatmentValue | undefined, tokens: TokenSet): ShaderSpec | null {
  const id = backdropShaderId(v)
  if (!id) return null
  const key = JSON.stringify([v, tokens])
  let spec = shaderCache.get(key)
  if (!spec) {
    spec = shaderFor(id, v!.params, v!.seed ?? 1, tokens, '16/9')
    if (shaderCache.size > 100) shaderCache.clear()
    shaderCache.set(key, spec)
  }
  return spec
}

const effectsCache = new Map<string, string>()
/** The style guide's effects, as variables after the tokens (the shadow effect overrides the card shadow). */
export function effectsCss(effects: EffectsState | undefined, tokens: TokenSet): string {
  if (!effects || !Object.keys(effects).length) return ''
  const key = JSON.stringify([effects, tokens])
  let css = effectsCache.get(key)
  if (css === undefined) {
    const vars = effectsVars(effects, tokens)
    css = Object.keys(vars).length ? `\n${varsToCss(vars)}` : ''
    if (effectsCache.size > 100) effectsCache.clear()
    effectsCache.set(key, css)
  }
  return css
}

/** Extra brand colors, as --mx-color-x-<name>. */
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
  backdrop?: TreatmentValue,
  tokens?: TokenSet,
): FrameState['blocks'] {
  if (!edits && !components && !spacing && !backdrop && motion?.mode !== 'preset') return NO_BLOCKS
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
  const behind = backdrop && tokens ? backdropCss(backdrop, tokens, '[data-mx-section]') : ''
  const css = [behind, blockCss({ blocks: clip.blocks, edits, components, select }), sectionSpacingCss(spacing, '[data-mx-section]'), moving]
    .filter(Boolean)
    .join('\n')
  return css || Object.keys(variants).length ? { css, variants } : NO_BLOCKS
}
