import type { ComposedPage } from '../compose'
import { mapTree } from '../html/parse'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { fontLink, sectionCss, tokensCss } from './shared'

/**
 * One standalone HTML document for a composed page. It is what the canvas shows
 * for a reference build, so what you see is what the exporters wrote.
 */
export function referenceHtml(page: ComposedPage, opts: { vh?: string; tagSlots?: boolean } = {}): string {
  const href = fontLink(page)
  const vars = opts.vh ? tokensCss(page).replace(/--mx-vh: [^;]+;/, `--mx-vh: ${opts.vh};`) : tokensCss(page)
  const body = page.sections
    .map((s) => {
      const tree = opts.tagSlots
        ? mapTree(s.tree, (el) => (el === s.tree.find((n) => n.t === 'el') ? { ...el, attrs: [...el.attrs, ['data-mx-slot', s.slotId]] } : el))
        : s.tree
      // The reference build is a single file, so pictures go inline.
      return s.media.reduce((html, m) => html.split(`src="${m.src}"`).join(`src="${m.inline}"`), serialize(tree, 'html', 1))
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title.replace(/</g, '&lt;')}</title>
${href ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${href}">` : ''}
<style>
${vars}
${BASE_CSS_LAYERED}
${page.sections.map(sectionCss).join('\n')}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`
}
