// The bundle as POST /api/library/sites takes it (upload.json). Apart from capture-site.ts so match.ts can rewrite it
// without starting a capture.

import type { SiteBundle } from './capture-site'

/** The shape POST /api/library/sites takes. */
export function uploadShape(b: SiteBundle) {
  return {
    slug: b.slug,
    name: b.name,
    url: b.url,
    ...(b.industry ? { industry: b.industry } : {}),
    tags: [] as string[],
    tokens: { ...b.source.tokens } as Record<string, string>,
    fonts: b.fonts,
    personality: b.personality,
    thumb: b.pages[0]?.screenshots.thumb,
    pages: b.pages.map((p, order) => ({
      path: p.path,
      title: p.title,
      order,
      screenshot: p.screenshots.full1440,
      width: p.size.w,
      height: p.size.h,
      sections: p.sections.map((s, i) => ({
        order: i,
        type: s.type,
        box: { y: s.box.y, h: s.box.h },
        ...(s.matches[0] ? { layoutId: s.matches[0].layoutId, score: s.matches[0].score } : {}),
        status: s.status === 'matched' ? 'matched' : 'needs_layout',
        screenshot: s.screenshot,
        ...(s.dark ? { hint: { dark: true } } : {}),
      })),
    })),
  }
}
