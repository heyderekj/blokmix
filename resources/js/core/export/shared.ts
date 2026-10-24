import type { ComposedPage, ComposedSection } from '../compose'
import { fontHrefs, fontLinkTags, varsToCss } from '../tokens'
import { TYPE_LABEL } from '../content'

/** Text files, plus binary ones (uploaded images) as bytes. */
export type FileMap = Record<string, string | Uint8Array>

/** The variable a page imports a section's content file as: featuresGrid2Content. */
export function contentVar(s: ComposedSection): string {
  return s.component[0].toLowerCase() + s.component.slice(1) + 'Content'
}

export function tokensCss(page: ComposedPage): string {
  return `/* Blokmix style guide: generated, edit tokens in Blokmix and re-export. */\n${varsToCss(page.vars)}\n`
}

/** The head links for the page's fonts (Google Fonts and Fontshare). */
export function fontLinks(page: ComposedPage, jsx = false): string[] {
  return fontLinkTags(fontHrefs(page.fonts), jsx)
}

export function keepSummary(s: ComposedSection): string {
  const k = s.keep
  const parts = [
    k.layout ? 'layout' : 'layout (reference only)',
    k.style ? 'own style' : 'style guide',
    k.content ? 'source copy' : 'your copy',
    k.motion ? 'motion' : 'no motion',
  ]
  return parts.join(' · ')
}

export function sectionHeader(s: ComposedSection, lang: 'html' | 'js' | 'css'): string {
  const lines = [
    `Section ${s.position + 1} · ${TYPE_LABEL[s.type]} · from ${new URL(s.clip.capture.url).host}`,
    `Clip ${s.clip.id}@${s.clip.hash} · ${s.clip.layoutPattern}`,
    `Keep: ${keepSummary(s)}`,
  ]
  if (lang === 'html') return `<!--\n  ${lines.join('\n  ')}\n-->`
  return `/*\n * ${lines.join('\n * ')}\n */`
}

export function sectionCss(s: ComposedSection): string {
  return `${sectionHeader(s, 'css')}\n${s.css}\n${s.motionCss ? `\n/* Motion (dropped when reduced motion is requested) */\n${s.motionCss}\n` : ''}`
}
