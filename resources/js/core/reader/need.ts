// "I need a [page | section] that [does what]": what to add, read from your words. The schema, prompt and bench are
// here now; the board asks for it in a later phase.

import type { SectionType } from '../types'
import type { PageTemplate } from '../site'
import type { ReadNeed } from './schema'

export interface Need {
  what: 'page' | 'section'
  /** For a page: which template (blank when none fits). */
  template: PageTemplate | null
  /** The sections that would do it, best first. */
  sections: SectionType[]
  /** What it's for, in your words. */
  purpose: string | null
}

/** A need the board can act on, or null when the read didn't say whether it's a page or a section. */
export function needOf(read: ReadNeed | null): Need | null {
  if (!read?.what) return null
  const sections = [...new Set(read.sections)].slice(0, 4) as SectionType[]
  if (read.what === 'section' && !sections.length) return null
  return { what: read.what, template: read.what === 'page' ? ((read.template ?? 'blank') as PageTemplate) : null, sections, purpose: read.purpose }
}
