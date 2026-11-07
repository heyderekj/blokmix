import type { BlockEdit, MediaFill, TokenKey } from './types'
import { ORIGINAL } from './blocks/style'
import { FILL_IDS } from './treatments/fills'

/**
 * What Free leaves out, and Plus opens (config/blokmix.php `plans`, docs/pricing.md). Pure, so the board, its
 * commands and tests read the same lists. Whether a layout is open lives in `core/library.ts` (`layoutOpen`).
 */

/** Plus, in plain words, for the buy sheet. */
export const PLUS_OPENS = [
  'As many mixes as you like, yours to keep',
  'Every layout and theme, not just the core few',
  'Every style guide control, block look and Mashup',
  'Effects, backdrops, generative pictures and live shaders',
  '10 GB of images and video',
] as const

/** The knobs Free keeps beside the Feel dials and Light/Dark: your brand's colors and its fonts. */
export const FREE_TOKENS: ReadonlySet<TokenKey> = new Set<TokenKey>(['color.primary', 'color.accent', 'font.display', 'font.body', 'font.mono'])

/** Pictures that need Plus: UI mockups, live shaders and the generative placeholders. */
export function fillNeedsPlus(fill: Pick<MediaFill, 'source' | 'style'> | null | undefined): boolean {
  if (!fill) return false
  return fill.source === 'mock' || fill.source === 'shader' || (fill.source === 'placeholder' && !!fill.style && (FILL_IDS as readonly string[]).includes(fill.style))
}

/** What part of a block change needs Plus, in words ("A block look"), or null when Free has it. */
export function blockEditNeedsPlus(patch: Partial<BlockEdit> | null): string | null {
  if (!patch) return null
  if (patch.variant && patch.variant !== ORIGINAL) return 'A block look'
  if (fillNeedsPlus(patch.media)) return patch.media!.source === 'mock' ? 'A UI mockup' : patch.media!.source === 'shader' ? 'A live shader' : 'A generative picture'
  return null
}
