import { useMemo } from 'react'
import type { Clip, ProjectContent, ResolvedGuide, Slot, TokenSet } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { resolveFields } from '@/core/content'
import { BASE_FONTS, expandTokens, fontHref, fontsForTokens, varsToCss } from '@/core/tokens'
import { allFonts } from '@/core/library'
import { library } from '@/data/library'
import type { FrameState } from '@/frame/bridge'
import { useStore, type Mode, type Viewport } from './store'

export const FONT_CATALOG = [...allFonts(library), ...BASE_FONTS]

export const VIEWPORT_VH: Record<Viewport, string> = { desktop: '9px', mobile: '8.44px' }

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
  slot: Pick<Slot, 'keep'> | null,
  mode: Mode,
  guide: TokenSet,
  content: ProjectContent,
  viewport: Viewport,
): FrameState {
  const vh = VIEWPORT_VH[viewport]
  if (mode === 'captured' || !slot) {
    return { css: tokensCssFor(clip.tokens, vh), motion: true, fields: null, fonts: [fontHrefFor(clip.tokens)], outline: false }
  }
  const tokens = slot.keep.style ? clip.tokens : guide
  return {
    css: tokensCssFor(tokens, vh),
    motion: slot.keep.motion,
    fields: slot.keep.content ? null : resolveFields(clip.type, clip.fields, content, false).fields,
    fonts: [fontHrefFor(tokens)],
    outline: !slot.keep.layout,
  }
}
