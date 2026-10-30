import type { LibrarySite, LibrarySiteSummary } from '@/lib/siteLibrary'

/**
 * A stand-in for the site library while running Vite on its own (`npm run dev`, no Laravel): two made-up sites
 * (`*.example`), with no screenshots. The viewer draws a placeholder box per section instead.
 * Real sites are captured offline and served by `GET /api/library` in your Blokmix account.
 */

const section = (order: number, type: string, y: number, h: number, layoutId: string | null, status: 'matched' | 'needs_layout' | 'hidden' = 'matched', hint: string | null = null) => ({
  id: order,
  order,
  type,
  box: { y, h },
  layoutId: status === 'matched' ? layoutId : null,
  score: status === 'matched' ? 0.82 : null,
  status,
  screenshot: null,
  hint,
})

/** Lay sections out top to bottom from their heights. */
function stack(rows: [type: string, h: number, layoutId: string | null, status?: 'matched' | 'needs_layout' | 'hidden', hint?: string][]) {
  let y = 0
  const out = rows.map(([type, h, layoutId, status, hint], i) => {
    const s = section(i + 1, type, y, h, layoutId, status, hint ?? null)
    y += h
    return s
  })
  return { sections: out, height: y }
}

const fernHome = stack([
  ['nav', 88, 'nav.layout-simple'],
  ['hero', 760, 'hero.layout-split'],
  ['logos', 180, 'logos.layout-row'],
  ['features', 880, 'features.layout-grid'],
  ['stats', 320, 'stats.layout-row'],
  ['testimonials', 620, 'testimonials.layout-cards'],
  ['content', 540, null, 'needs_layout', 'A scrolling product tour with a sticky phone'],
  ['pricing', 860, 'pricing.layout-tiers'],
  ['faq', 640, 'faq.layout-accordion'],
  ['cta', 420, 'cta.layout-band'],
  ['footer', 380, 'footer.layout-columns'],
])
const fernPricing = stack([
  ['nav', 88, 'nav.layout-simple'],
  ['header', 360, 'header.layout-centered'],
  ['pricing', 900, 'pricing.layout-table'],
  ['faq', 600, 'faq.layout-columns'],
  ['footer', 380, 'footer.layout-columns'],
])
const harborHome = stack([
  ['nav', 96, 'nav.layout-centered'],
  ['hero', 820, 'hero.layout-editorial'],
  ['gallery', 900, 'gallery.layout-masonry'],
  ['content', 640, 'content.layout-quote'],
  ['team', 760, 'team.layout-grid'],
  ['blog', 720, 'blog.layout-magazine'],
  ['contact', 680, 'contact.layout-split'],
  ['cta', 360, 'cta.layout-retired', 'matched', 'Matched to a layout this build doesn’t have'],
  ['footer', 300, 'footer.layout-minimal'],
])

export const SAMPLE_SITES: LibrarySite[] = [
  {
    slug: 'fernway',
    name: 'Fernway',
    url: 'https://fernway.example/',
    industry: 'Software',
    tags: ['saas', 'clean', 'product'],
    tokens: {
      'color.bg': '#f7f8f4',
      'color.surface': '#eceee6',
      'color.text': '#14231b',
      'color.muted': '#5d6b62',
      'color.border': '#d9ddd2',
      'color.primary': '#1f6f4a',
      'color.onPrimary': '#ffffff',
      'color.accent': '#e9b949',
      'font.display': "'Fraunces', Georgia, serif",
      'font.body': "'Inter', system-ui, sans-serif",
      'type.base': '17px',
      'type.ratio': '1.25',
      'type.displayWeight': '600',
      'radius.base': '14px',
      'space.section': '112px',
    },
    fonts: [{ family: 'Fraunces', css2: 'Fraunces:opsz,wght@9..144,400..700' }, { family: 'Inter', css2: 'Inter:wght@400..700' }],
    personality: 'Calm, outdoorsy software: a soft green on paper white, a serif headline, generous room.',
    status: 'published',
    thumb: null,
    pages: [
      { id: 1, path: '/', title: 'Home', order: 1, screenshot: null, width: 1440, height: fernHome.height, sections: fernHome.sections },
      { id: 2, path: '/pricing', title: 'Pricing', order: 2, screenshot: null, width: 1440, height: fernPricing.height, sections: fernPricing.sections },
    ],
  },
  {
    slug: 'harbor-and-pine',
    name: 'Harbor & Pine',
    url: 'https://harborandpine.example/',
    industry: 'Architecture',
    tags: ['studio', 'editorial', 'portfolio'],
    tokens: {
      'color.bg': '#121212',
      'color.surface': '#1c1c1c',
      'color.text': '#f2efe9',
      'color.muted': '#a39e94',
      'color.border': '#2e2e2e',
      'color.primary': '#d9643a',
      'color.onPrimary': '#121212',
      'color.accent': '#d9643a',
      'font.display': "'Space Grotesk', system-ui, sans-serif",
      'font.body': "'Inter', system-ui, sans-serif",
      'type.ratio': '1.333',
      'type.displayWeight': '500',
      'radius.base': '0px',
      'stroke.width': '1px',
    },
    fonts: [{ family: 'Space Grotesk', css2: 'Space+Grotesk:wght@400..700' }],
    personality: 'A dark, quiet architecture studio: square corners, one burnt-orange accent, big photography.',
    status: 'published',
    thumb: null,
    pages: [{ id: 3, path: '/', title: 'Home', order: 1, screenshot: null, width: 1440, height: harborHome.height, sections: harborHome.sections }],
  },
]

const count = (s: LibrarySite, f: (x: LibrarySite['pages'][number]['sections'][number]) => boolean) => s.pages.reduce((n, p) => n + p.sections.filter(f).length, 0)

export const SAMPLE_SUMMARIES: LibrarySiteSummary[] = SAMPLE_SITES.map((s) => ({
  slug: s.slug,
  name: s.name,
  url: s.url,
  industry: s.industry,
  tags: s.tags,
  palette: { bg: s.tokens['color.bg'], text: s.tokens['color.text'], primary: s.tokens['color.primary'], accent: s.tokens['color.accent'] },
  thumb: null,
  status: s.status,
  pages: s.pages.length,
  sections: count(s, () => true),
  matched: count(s, (x) => x.status === 'matched'),
  needsLayout: count(s, (x) => x.status === 'needs_layout'),
  updated_at: '2026-10-28T12:00:00Z',
}))
