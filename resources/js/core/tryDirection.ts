// Another direction for a site you already have: its own pages and words, laid out with a direction's layouts and
// dressed in its look. What you made stays yours: locked sections keep their layout, layouts or the look set to Keep
// in Rules for your agent stay as they are, and every swap carries your words, pictures and links (`withClip`). Pure,
// so the Drafts panel's row and `try_direction` land the same thing.

import { directionPage, type Direction } from './directions'
import { withClip } from './library'
import { pageView, updateSlotIn } from './site'
import { applySkin, skinById, swapThemeParts } from './skins'
import { isKept, type Contract } from './contract'
import type { GuideState, Library, Site } from './types'

/** Every page's sections in the direction's layouts (shared nav and footer once), your words carried. */
export function siteInDirection(site: Site, d: Direction, lib: Library, contract?: Contract): Site {
  if (isKept(contract, 'layout')) return site
  let out = site
  const done = new Set<string>()
  for (const page of site.pages) {
    const view = pageView(out, page.id)
    const ids = directionPage(d, view.map((s) => s.type), lib)
    view.forEach((s, i) => {
      const id = ids[i]
      if (done.has(s.id) || s.locked || !id || lib.clips[id]?.type !== s.type) return
      done.add(s.id)
      out = updateSlotIn(out, s.id, (x) => withClip(x, id, lib))
    })
  }
  return out
}

/** The site's guide in the direction's look, as Rules for your agent allow (your brand color stays, as with any theme). */
export function guideInDirection(guide: GuideState, d: Direction, contract?: Contract): GuideState {
  const skin = skinById(d.theme)
  if (!skin) return guide
  const dressed = applySkin(guide, skin, contract)
  if (!d.parts) return dressed
  try {
    return swapThemeParts(dressed, d.parts, contract)
  } catch {
    return dressed
  }
}
