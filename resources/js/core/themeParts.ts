import { AREA_LABEL, STYLE_AREAS, isKept, type Contract, type StyleArea } from './contract'
import { PART_RECIPES } from './partRecipes'
import { primaryFamily } from './tokens'
import { PAIRINGS } from './colorPairs'
import { resolveGuide } from './guide'
import { skinTokens, type Skin, skinList, swapThemeParts } from './skins'
import type { GuideState } from './types'

export function partDescription(skin: Skin, area: StyleArea): string {
  const t = skinTokens(skin)
  switch (area) {
    case 'type':
      return `${primaryFamily(t['font.display'])} headings · ${primaryFamily(t['font.body'])} body`
    case 'space':
      return `${t['space.content']} page · ${t['space.text']} reading width`
    case 'shape':
      return `${t['radius.base']} corners · ${t['stroke.width']} lines`
    case 'motion':
      return `${skin.sections?.hero?.motion?.enter ?? 'Still'} entrance · ${t['motion.duration']} interactions`
    case 'looks':
      return `${skin.components?.card?.variant ?? 'Plain'} cards · ${skin.components?.button?.secondary?.variant ?? 'plain'} secondary buttons`
    case 'pictures':
      return skin.picture?.style ?? 'Plain placeholders'
    case 'sections':
      return `${skin.sections?.hero?.backdrop?.id ?? skin.sections?.hero?.surface ?? 'Plain'} hero · ${skin.sections?.cta?.surface ?? 'plain'} closing section`
    case 'color':
      return `${skin.mode} · ${t['color.primary']}`
  }
}

// Compare resolved values, independently of JSON property order or how a token was chosen.
function key(guide: GuideState) {
  return JSON.stringify(
    [
      resolveGuide(guide).tokens,
      guide.components,
      guide.sections,
      guide.picture,
      guide.effects,
      guide.textStyles,
      guide.brand?.color,
      guide.brand?.variant?.accentTurn ?? 120,
      guide.brand?.variant?.tint ?? 1,
    ],
    (_, value) =>
      value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value,
  )
}

export function listParts(guide: GuideState, contract?: Contract, only?: StyleArea) {
  const current = key(guide)
  return (only ? [only] : STYLE_AREAS).map((area) => {
    const options = skinList().map((s) => ({
      id: s.id,
      name: area === 'color' && guide.brand ? `${s.name} · replace brand color` : `${s.name} · ${partDescription(s, area)}`,
    }))
    options.unshift(...PART_RECIPES.filter((p) => p.area === area).map(({ id, name }) => ({ id, name })))
    if (area === 'color' && guide.brand)
      options.unshift(...PAIRINGS.flatMap((pair) => ['light', 'dark'].map((mode) => ({ id: `brand/${pair.id}/${mode}`, name: `${pair.name} · ${mode}` }))))
    const seen = new Set<string>()
    let on: string | null = null
    const distinct = options.filter((p) => {
      const resolved = key(swapThemeParts(guide, { [area]: p.id }))
      if (seen.has(resolved)) return false
      seen.add(resolved)
      if (resolved === current) on = p.id
      return true
    })
    return { area, name: AREA_LABEL[area].name, kept: isKept(contract, area), current: on as string | null, options: distinct }
  })
}
