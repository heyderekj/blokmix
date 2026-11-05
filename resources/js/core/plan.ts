import type { BlockEdit, MediaFill, TokenKey } from './types'
import { FILL_IDS } from './treatments/fills'

/**
 * What Free leaves out, and a mix pack opens (config/blokmix.php `plans`, docs/pricing.md). Pure, so the board, its
 * commands and tests read the same lists. Whether a layout is open lives in `core/library.ts` (`layoutOpen`).
 */

/** A mix pack, in plain words, for the buy sheet. */
export const PACK_OPENS = [
  'Three mixes, open at once, yours to keep',
  'Every layout, not just the core few',
  'Every skin, Surprise me, every style guide control and block look',
  'Effects, backdrops, generative pictures and live shaders',
  'Unlimited clips and 10 GB of images and video',
] as const

/** The knobs Free keeps beside the Feel dials and Light/Dark: your brand's colors and its fonts. */
export const FREE_TOKENS: ReadonlySet<TokenKey> = new Set<TokenKey>(['color.primary', 'color.accent', 'font.display', 'font.body', 'font.mono'])

/** Pictures that need a mix pack: UI mockups, live shaders and the generative placeholders. */
export function fillNeedsPack(fill: Pick<MediaFill, 'source' | 'style'> | null | undefined): boolean {
  if (!fill) return false
  return fill.source === 'mock' || fill.source === 'shader' || (fill.source === 'placeholder' && !!fill.style && (FILL_IDS as readonly string[]).includes(fill.style))
}

/** What part of a block change needs a mix pack, in words ("A block look"), or null when Free has it. */
export function blockEditNeedsPack(patch: Partial<BlockEdit> | null): string | null {
  if (!patch) return null
  if (patch.variant) return 'A block look'
  if (fillNeedsPack(patch.media)) return patch.media!.source === 'mock' ? 'A UI mockup' : patch.media!.source === 'shader' ? 'A live shader' : 'A generative picture'
  return null
}
