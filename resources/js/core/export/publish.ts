// A mix as a small website for blok.page: one HTML file per page and its pictures as files, all under the address it's
// published at. The same composing as exports and the canvas, so a published page is what you saw.

import type { ComposedPage } from '../compose'
import { referenceHtml } from './reference-html'
import type { FileMap } from './shared'

/**
 * The base the board writes pages under. The address (blok.page/<code>/<slug>) isn't known until the server has given
 * the mix a code, so the server swaps this for it as it saves the pages.
 */
export const PUBLISH_BASE = '/__blokmix_base__'

/** Where a page of the site is written: "/" is index.html, "/about" about.html, "/work/fern" work/fern.html. */
export function publishedPath(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9/_-]/gi, '-')
  return clean ? `${clean}.html` : 'index.html'
}

/**
 * Every page (a template page, which needs a collection's entries, is left out) plus the pictures they use. Paths are
 * relative to the publication; links and pictures inside point under `base`.
 */
export function publishFiles(page: ComposedPage, opts: { base: string } = { base: PUBLISH_BASE }): FileMap {
  const files: FileMap = {}
  const pages = page.site ? page.site.pages.filter((p) => !p.template) : [{ id: undefined, path: '/' }]
  for (const p of pages) files[publishedPath(p.path)] = referenceHtml(page, { pageId: p.id, web: { base: opts.base } })
  for (const [path, data] of Object.entries(page.mediaFiles)) if (path.startsWith('media/')) files[path] = data
  return files
}
