// What Blokmix's own words mean, written for Jev: each section type and each kind of
// site, with what it covers, what belongs elsewhere, and examples. The gap finder, a page
// from your words, Say it and the five-second test all ask about these, so they live once.
// Contrastive wording (`not_for`) is what keeps neighbours (features vs content, cta vs
// hero) apart; edit here when an answer surprises you.

import type { Kind, SectionType } from '../types'
import type { Criterion } from './types'

type Described = Exclude<Criterion, string | null>

export const SECTION_CRITERIA: Record<SectionType, Described> = {
  nav: { what: 'The bar of links across the top: brand name or logo, a few page links, maybe one button', not_for: 'A footer of links at the bottom', examples: ['Logo · Product · Pricing · Sign in'] },
  hero: { what: 'The opening section of a home page: the main headline saying what this is, a short intro and the main button', not_for: 'A page title on an inner page (header), a closing call to action (cta)', examples: ['Bread worth getting up for. Order by 8, pick up by 10.'] },
  header: { what: 'The title section at the top of an inner page (About, Blog, Pricing): a heading and a line under it', not_for: 'The home page’s opening pitch (hero)', examples: ['About us · How a small team bakes for a whole town'] },
  logos: { what: 'A row or wall of customer, partner or press logos, maybe with a line like “Trusted by”', not_for: 'Photos of people (team) or a gallery of work', examples: ['As seen in The Times, Wired, Monocle'] },
  features: { what: 'What it does or offers, as several parallel points: each a short title and a sentence, often with an icon or picture', not_for: 'One long story told in paragraphs (content), prices (pricing)', examples: ['Fast setup · Works offline · Private by default'] },
  stats: { what: 'A few big numbers with short labels', not_for: 'Prices (pricing), a list of points with no numbers (features)', examples: ['12k customers · 4.9 rating · 30 countries'] },
  content: { what: 'Prose: a story, a mission, a how-we-work explanation, an article-like block of paragraphs, maybe with one picture', not_for: 'Several parallel points (features), questions and answers (faq)', examples: ['We started in a garage in 2014…'] },
  gallery: { what: 'A set of pictures shown together: work, products, places, a portfolio', not_for: 'Logos (logos), people with names and roles (team)', examples: ['Selected work: six project photos with captions'] },
  team: { what: 'The people: names with roles, often with photos or short bios', not_for: 'Quotes from customers (testimonials)', examples: ['Ana Ruiz, Head baker · Tom Lee, Founder'] },
  testimonials: { what: 'What customers or readers say: quotes with who said them', not_for: 'The team introducing themselves (team), a list of logos (logos)', examples: ['“Best croissant in town.” — Priya, regular since 2019'] },
  pricing: { what: 'Plans, packages, a price list or a menu with prices', not_for: 'Big numbers that aren’t prices (stats)', examples: ['Starter $9/mo · Pro $29/mo', 'Espresso 3.50 · Flat white 4.20'] },
  blog: { what: 'A list of posts, articles, news or updates, each with a title and usually a date or excerpt', not_for: 'One article’s body (content)', examples: ['How we source our flour · March 3'] },
  faq: { what: 'Questions and their answers', not_for: 'A single question used as a headline (hero)', examples: ['Do you deliver? Yes, within 5 miles.'] },
  contact: { what: 'How to get in touch or visit: email, phone, address, hours, a form or a map', not_for: 'A closing pitch with one button (cta)', examples: ['hello@bakery.com · 12 Mill St · Open 7–3'] },
  cta: { what: 'A short closing push near the end: one line and one main button, or a newsletter sign-up', not_for: 'The opening pitch at the top (hero), full contact details (contact)', examples: ['Ready to start? Book a call'] },
  footer: { what: 'The bottom of the page: links in columns, legal line, small print, social links', not_for: 'The top bar (nav)', examples: ['© 2026 Mill Bakery · Privacy · Instagram'] },
}

export const KIND_CRITERIA: Record<Kind, Described> = {
  product: { what: 'An app, software or a product people buy or sign up for', not_for: 'A person’s own portfolio (personal), a shop or café with a place to visit (local)', examples: ['A budgeting app', 'A smart lamp'] },
  studio: { what: 'A studio, agency, freelancer or service business selling its work to clients', not_for: 'Software people sign up for (product)', examples: ['A design studio', 'A wedding photographer', 'An accountant'] },
  local: { what: 'A local business people visit or order from: a café, restaurant, shop, clinic, gym', not_for: 'A business that only works online (product, studio)', examples: ['A bakery', 'A dentist', 'A bike shop'] },
  event: { what: 'An event, conference, launch, festival or meetup with a date', not_for: 'A business that’s open all year (local)', examples: ['A design conference in May', 'A product launch'] },
  personal: { what: 'One person’s own site: portfolio, résumé, about me', not_for: 'A studio of several people (studio), writing as the main thing (writing)', examples: ['A developer’s portfolio', 'A CV'] },
  writing: { what: 'Writing first: a blog, newsletter, magazine or publication', not_for: 'A person’s portfolio with a few posts (personal)', examples: ['A weekly newsletter', 'A food blog'] },
}

/** Plain names for the kinds, for what people read. */
export const KIND_WORDS: Record<Kind, string> = {
  product: 'a product or app',
  studio: 'a studio or service',
  local: 'a local business',
  event: 'an event',
  personal: 'a personal site',
  writing: 'writing or a newsletter',
}
