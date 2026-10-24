import type { ComposedPage, ComposedSection, ComposedSite } from '../compose'
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

/**
 * The pages to write. A site gives its pages and the shared nav and footer; a
 * single composed page is one page at "/" with everything inline, as before.
 */
export function sitePages(page: ComposedPage): ComposedSite {
  return page.site ?? { shared: {}, pages: [{ id: 'page', path: '/', title: page.title, show: { nav: false, footer: false }, sections: page.sections }] }
}

/** Where a route's file goes under a pages folder, and how far it sits below that folder ("/" → index, "/a/b" → a/b). */
export function routeFile(path: string): { file: string; depth: number } {
  if (path === '/') return { file: 'index', depth: 0 }
  const parts = path.split('/').filter(Boolean)
  return { file: parts.join('/'), depth: parts.length - 1 }
}
