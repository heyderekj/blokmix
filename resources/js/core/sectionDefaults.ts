// A skin's say over sections and pictures: defaults per type of section and for empty pictures. They sit underneath
// what a section or block chose for itself, so swapping skins never rewrites a section. Pure, shared by the frames and
// the exports.

import type { BlockInfo, GuideState, MediaFill, PictureDefault, SectionDefault, SectionType, Slot } from './types'
import type { TreatmentValue } from './treatments'

/** A section that chose "no backdrop" while its skin offers one. */
export const NO_BACKDROP: TreatmentValue = { id: 'none', params: {} }

type SectionLook = Pick<Slot, 'keep' | 'surface' | 'backdrop' | 'motion' | 'spacing'>

/** The section as it shows: its own choices, then its type's defaults. A section keeping its own captured look takes none. */
export function withSectionDefaults<S extends SectionLook>(slot: S, type: SectionType, sections: GuideState['sections'], ownMotion: boolean): S {
  const off = slot.backdrop?.id === NO_BACKDROP.id
  const def: SectionDefault | undefined = slot.keep.style ? undefined : sections?.[type]
  if (!def && !off) return slot
  const out: S = { ...slot }
  if (def?.surface && !slot.surface) out.surface = def.surface
  if (off) out.backdrop = undefined
  else if (def?.backdrop && !slot.backdrop) out.backdrop = def.backdrop
  // A clip's own motion stays until you pick; a skin moves what has none (bare layouts).
  if (def?.motion && !slot.motion && slot.keep.motion && !ownMotion) out.motion = def.motion
  if (def?.spacing) out.spacing = { ...def.spacing, ...slot.spacing, ...(def.spacing.mobile || slot.spacing?.mobile ? { mobile: { ...def.spacing.mobile, ...slot.spacing?.mobile } } : {}) }
  return out
}

/** A small stable number from a block's id, so each empty picture draws differently and the same every time. */
const seedOf = (id: string) => {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) % 100000 || 1
}

/**
 * What an image block shows: its own fill, else the skin's picture style. Only built-in layouts' pictures take one;
 * a captured section's images are the real thing, and a section keeping its own look keeps them.
 */
/** Picture styles soft enough to sit behind words; any other (shapes, lines, dots, blocks, type) would cross them. */
const SOFT: string[] = ['mesh', 'grain-gradient']

export function pictureFor(
  own: MediaFill | undefined,
  b: Pick<BlockInfo, 'id' | 'kind' | 'media' | 'field'>,
  picture: PictureDefault | undefined,
  origin: 'clip' | 'layout',
  keepsStyle: boolean,
  site?: { type: SectionType; logo?: MediaFill },
): MediaFill | undefined {
  // Your logo fills the nav's and footer's own logo (not a logo strip's customer logos), clipped or built in.
  if (!own && !keepsStyle && site?.logo && isSiteLogo(b, site.type)) return site.logo
  if (own || !picture || b.kind !== 'image' || origin !== 'layout' || keepsStyle) return own
  // A logo is the brand's name, and a block holding words shows them: neither is an empty picture.
  if (/^logo/i.test(b.media ?? '') || b.field) return own
  // A picture behind the words (a hero's backdrop) gets soft art: the theme's shapes and lines would cross the words.
  if (/^backdrop$/i.test(b.media ?? '') && !SOFT.includes(picture.style)) return { source: 'placeholder', style: 'mesh', seed: seedOf(b.id) }
  return { source: 'placeholder', style: picture.style, seed: seedOf(b.id), ...(picture.params ? { params: picture.params } : {}) }
}

/** The site's own logo spot: the nav's or footer's logo picture. */
export const isSiteLogo = (b: Pick<BlockInfo, 'kind' | 'media'>, type: SectionType) =>
  b.kind === 'image' && (type === 'nav' || type === 'footer') && /^logo1?$/i.test(b.media ?? '')
