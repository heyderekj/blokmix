import type { ComposedPage } from '../compose'
import { mapTree } from '../html/parse'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { SLIDER_JS } from './slider-runtime'
import { SHADERS_JS, SHADER_CSS, pngDataUri } from './shaders'
import { fontLinks, sectionCss, tokensCss } from './shared'

/**
 * One standalone HTML document for a composed page. It is what the canvas shows
 * for a reference build, so what you see is what the exporters wrote.
 */
export interface WebOptions {
  /** Where the site lives, prefixed to its own links and files ("/k3x9/fern-co"). */
  base: string
}

export function referenceHtml(page: ComposedPage, opts: { vh?: string; tagSlots?: boolean; pageId?: string; web?: WebOptions } = {}): string {
  const links = fontLinks(page)
  const vars = opts.vh ? tokensCss(page).replace(/--mx-vh: [^;]+;/, `--mx-vh: ${opts.vh};`) : tokensCss(page)
  // A site shows one page at a time: its view, with the shared nav and footer if it shows them.
  const sections = pageSections(page, opts.pageId)
  const shaders = sections.some((s) => s.backdrop?.live || s.media.some((m) => m.shader))
  const body = sections
    .map((s) => {
      const tree = opts.tagSlots
        ? mapTree(s.tree, (el) => (el === s.tree.find((n) => n.t === 'el') ? { ...el, attrs: [...el.attrs, ['data-mx-slot', s.slotId]] } : el))
        : s.tree
      // Published, pictures are files beside the page.
      if (opts.web) return serialize(tree, 'html', 1)
      // The reference build is a single file, so pictures go inline.
      const html = s.media.reduce((html, m) => {
        let out = html.split(`src="${m.src}"`).join(`src="${m.inline}"`)
        if (m.poster && m.inlinePoster) out = out.split(`"${m.poster}"`).join(`"${m.inlinePoster}"`)
        return out
      }, serialize(tree, 'html', 1))
      // Shader posters, as they are now (baked, or the stand-in).
      return page.shaders.reduce((out, x) => {
        const bytes = page.mediaFiles[x.path]
        return bytes instanceof Uint8Array ? out.split(`src="/${x.path}"`).join(`src="${pngDataUri(bytes)}"`) : out
      }, html)
    })
    .join('\n')
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${opts.web ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<title>${pageTitle(page, opts.pageId).replace(/</g, '&lt;')}</title>
${links.join('\n')}
<style>
${vars}
${BASE_CSS_LAYERED}
${page.moving ? MEDIA_CSS : ''}
${shaders ? SHADER_CSS : ''}
${sections.map(sectionCss).join('\n')}
</style>
</head>
<body>
<main>
${body}
</main>
${page.moving ? `<script>${MEDIA_JS}</script>` : ''}
${page.sliding ? `<script>${SLIDER_JS}</script>` : ''}
${shaders ? `<script>${SHADERS_JS}</script>` : ''}
</body>
</html>
`
  return opts.web ? underBase(doc, opts.web.base) : doc
}

/** Root-relative links and files ("/about#team", "/media/s1-b3.svg") under where the site lives. */
export function underBase(html: string, base: string): string {
  const root = base.replace(/\/+$/, '')
  return html.replace(/(\s(?:href|src|poster|data-lottie)=")\/(?!\/)/g, `$1${root}/`)
}

/** The sections one page of a site shows, top to bottom (the first page by default); a single page shows them all. */
export function pageSections(page: ComposedPage, pageId?: string): ComposedPage['sections'] {
  if (!page.site) return page.sections
  const p = page.site.pages.find((x) => x.id === pageId) ?? page.site.pages[0]
  if (!p) return []
  const { nav, footer } = page.site.shared
  return [...(nav && p.show.nav ? [nav] : []), ...p.sections, ...(footer && p.show.footer ? [footer] : [])]
}

function pageTitle(page: ComposedPage, pageId?: string): string {
  const p = page.site?.pages.find((x) => x.id === pageId)
  return p && p.path !== '/' ? `${p.title} · ${page.title}` : page.title
}
