import type { ComposedPage } from '../compose'
import { mapTree } from '../html/parse'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { fontLinks, sectionCss, tokensCss } from './shared'

/**
 * One standalone HTML document for a composed page. It is what the canvas shows
 * for a reference build, so what you see is what the exporters wrote.
 */
export function referenceHtml(page: ComposedPage, opts: { vh?: string; tagSlots?: boolean } = {}): string {
  const links = fontLinks(page)
  const vars = opts.vh ? tokensCss(page).replace(/--mx-vh: [^;]+;/, `--mx-vh: ${opts.vh};`) : tokensCss(page)
  const body = page.sections
    .map((s) => {
      const tree = opts.tagSlots
        ? mapTree(s.tree, (el) => (el === s.tree.find((n) => n.t === 'el') ? { ...el, attrs: [...el.attrs, ['data-mx-slot', s.slotId]] } : el))
        : s.tree
      // The reference build is a single file, so pictures go inline.
      return s.media.reduce((html, m) => {
        let out = html.split(`src="${m.src}"`).join(`src="${m.inline}"`)
        if (m.poster && m.inlinePoster) out = out.split(`"${m.poster}"`).join(`"${m.inlinePoster}"`)
        return out
      }, serialize(tree, 'html', 1))
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title.replace(/</g, '&lt;')}</title>
${links.join('\n')}
<style>
${vars}
${BASE_CSS_LAYERED}
${page.moving ? MEDIA_CSS : ''}
${page.sections.map(sectionCss).join('\n')}
</style>
</head>
<body>
<main>
${body}
</main>
${page.moving ? `<script>${MEDIA_JS}</script>` : ''}
</body>
</html>
`
}
