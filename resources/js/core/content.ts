import type { ProjectContent, SectionType } from './types'

const range = (n: number, f: (i: number) => string[]) => Array.from({ length: n }, (_, i) => f(i + 1)).flat()

/**
 * Field names a clip may use in `data-mx-field`. Shared names are what let any
 * clip of a type render your copy instead of the source's.
 */
export const FIELD_SCHEMA: Record<SectionType, string[]> = {
  nav: ['brand', 'link1', 'link2', 'link3', 'link4', 'cta'],
  hero: ['eyebrow', 'headline', 'subhead', 'ctaPrimary', 'ctaSecondary', 'note'],
  features: ['eyebrow', 'heading', 'intro', ...range(6, (i) => [`f${i}Title`, `f${i}Body`])],
  proof: [
    'eyebrow',
    'heading',
    ...range(3, (i) => [`q${i}Quote`, `q${i}Name`, `q${i}Role`]),
    ...range(6, (i) => [`logo${i}`]),
    ...range(3, (i) => [`stat${i}Value`, `stat${i}Label`]),
  ],
  pricing: [
    'eyebrow',
    'heading',
    'intro',
    ...range(3, (i) => [
      `t${i}Name`,
      `t${i}Price`,
      `t${i}PriceYearly`,
      `t${i}Desc`,
      `t${i}Cta`,
      ...range(4, (j) => [`t${i}F${j}`]),
    ]),
    'footnote',
  ],
  footer: [
    'brand',
    'tagline',
    'ctaHeading',
    'ctaButton',
    ...range(3, (i) => [`col${i}Title`, ...range(4, (j) => [`col${i}L${j}`])]),
    'legal',
  ],
}

export const TYPE_LABEL: Record<SectionType, string> = {
  nav: 'Nav',
  hero: 'Hero',
  features: 'Features',
  proof: 'Social proof',
  pricing: 'Pricing',
  footer: 'Footer',
}

/** Mixtape's own landing page copy: the demo project you're "building". */
export const DEFAULT_CONTENT: ProjectContent = {
  brand: 'Mixtape',
  fields: {
    nav: { brand: 'Mixtape', link1: 'How it works', link2: 'Extension', link3: 'Pricing', link4: 'Docs', cta: 'Start a tape' },
    hero: {
      eyebrow: 'Now in private beta',
      headline: 'Clip the web. Mix your site.',
      subhead:
        'Grab sections from any site you love, slide them together like tiles, and hand a clean packet to your agent to build in Astro or Next.js.',
      ctaPrimary: 'Start a tape',
      ctaSecondary: 'Watch the demo',
      note: 'Free while in beta · No credit card',
    },
    features: {
      eyebrow: 'How it works',
      heading: 'From scattered inspo to a real build',
      intro: 'Mixtape keeps the code, tokens and motion of every section you clip, so remixing is real, not a mood board.',
      f1Title: 'Clip any section',
      f1Body: 'The extension grabs code, tokens and motion from any live site.',
      f2Title: 'Slide to remix',
      f2Body: 'Every slot cycles through your clips. Lock the keepers, shuffle the rest.',
      f3Title: 'Keep what you love',
      f3Body: 'Take just the layout, the look, the copy or the motion.',
      f4Title: 'One style guide',
      f4Body: 'Clashing colors and fonts resolve into a single set of tokens.',
      f5Title: 'Hand off a packet',
      f5Body: 'Your agent gets code, tokens and liner notes, ready for Astro or Next.js.',
      f6Title: 'Branch and compare',
      f6Body: 'Every version lives on the canvas. Branch, review, repeat.',
    },
    proof: {
      eyebrow: 'Loved by tinkerers',
      heading: 'Designers stopped screenshotting',
      q1Quote: 'I used to keep 400 screenshots in a folder. Now I keep a tape.',
      q1Name: 'Rae Okafor',
      q1Role: 'Product designer',
      q2Quote: 'The shuffle key is dangerously fun. Our landing page shipped in an afternoon.',
      q2Name: 'Jonah Fields',
      q2Role: 'Founder, Lumen',
      q3Quote: 'Finally, inspiration that arrives as code instead of a mood board.',
      q3Name: 'Priya Natarajan',
      q3Role: 'Design engineer',
      logo1: 'Northwind',
      logo2: 'Fieldnote',
      logo3: 'Paperplane',
      logo4: 'Lumen',
      logo5: 'Orbital',
      logo6: 'Kettle',
      stat1Value: '12k',
      stat1Label: 'sections clipped',
      stat2Value: '4.8×',
      stat2Label: 'faster first drafts',
      stat3Value: '2',
      stat3Label: 'frameworks out of the box',
    },
    pricing: {
      eyebrow: 'Pricing',
      heading: 'Pick a tape length',
      intro: 'Start free. Upgrade when your mixes outgrow the shoebox.',
      t1Name: 'Demo',
      t1Price: '$0',
      t1PriceYearly: '$0',
      t1Desc: 'For trying it out',
      t1Cta: 'Start free',
      t1F1: '1 project',
      t1F2: '50 clips',
      t1F3: 'Astro + Next export',
      t1F4: 'Community support',
      t2Name: 'Album',
      t2Price: '$12',
      t2PriceYearly: '$10',
      t2Desc: 'For working designers',
      t2Cta: 'Go Album',
      t2F1: 'Unlimited projects',
      t2F2: 'Unlimited clips',
      t2F3: 'MCP handoff',
      t2F4: 'Version branching',
      t3Name: 'Studio',
      t3Price: '$29',
      t3PriceYearly: '$24',
      t3Desc: 'For teams and agencies',
      t3Cta: 'Talk to us',
      t3F1: 'Everything in Album',
      t3F2: 'Shared libraries',
      t3F3: 'ReviseMy reviews',
      t3F4: 'Koati prototypes',
      footnote: 'Per seat, per month. Yearly saves about 20%.',
    },
    footer: {
      brand: 'Mixtape',
      tagline: 'Clip the web. Mix your site.',
      ctaHeading: 'Press record on your next site',
      ctaButton: 'Start a tape',
      col1Title: 'Product',
      col1L1: 'Extension',
      col1L2: 'Canvas',
      col1L3: 'Packets',
      col1L4: 'Changelog',
      col2Title: 'Company',
      col2L1: 'About',
      col2L2: 'Blog',
      col2L3: 'Careers',
      col2L4: 'Contact',
      col3Title: 'Resources',
      col3L1: 'Docs',
      col3L2: 'MCP guide',
      col3L3: 'Templates',
      col3L4: 'Community',
      legal: '© 2026 Mixtape. Made with clipped inspiration.',
    },
  },
}

/**
 * The copy a section should show. With content kept, the source copy; otherwise
 * your copy, falling back to the source for any field you haven't written.
 */
export function resolveFields(
  type: SectionType,
  sourceFields: Record<string, string>,
  content: ProjectContent,
  keepSource: boolean,
): { fields: Record<string, string>; retained: string[] } {
  if (keepSource) return { fields: { ...sourceFields }, retained: Object.keys(sourceFields) }
  const mine = content.fields[type] ?? {}
  const fields: Record<string, string> = {}
  const retained: string[] = []
  for (const [k, v] of Object.entries(sourceFields)) {
    if (mine[k] != null && mine[k] !== '') fields[k] = mine[k]
    else {
      fields[k] = v
      retained.push(k)
    }
  }
  return { fields, retained }
}
