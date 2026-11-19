import { briefFeel, type Brief } from './brief'
import type { Contract } from './contract'
import { emptyGuide, resolveGuide } from './guide'
import { applySkin, refId, themeList, type Skin } from './skins'
import { primaryFamily } from './tokens'
import type { GuideState } from './types'
import { toneOfGuide } from './dials'

export function visualKey(guide: GuideState) {
  const tokens = resolveGuide(guide).tokens
  const sections = Object.entries(guide.sections ?? {}).flatMap(([type, { motion, ...fields }]) => (Object.keys(fields).length ? [[type, fields]] : []))
  return JSON.stringify([
    Object.entries(tokens).filter(([key]) => !key.startsWith('motion.')),
    guide.textStyles,
    guide.components,
    guide.effects,
    sections,
    guide.picture,
  ])
}

export function themeReason(guide: GuideState) {
  const t = resolveGuide(guide).tokens
  const type = primaryFamily(t['font.display'])
  const corners = parseFloat(t['radius.base'])
  return `${type} headings, ${corners >= 12 ? 'rounded' : corners <= 3 ? 'square' : 'softly rounded'} corners and a ${toneOfGuide(t)} background.`
}

/**
 * How well a theme fits a brief, as dressed (`tokens`): feel words said outright count most, then the industry and
 * format it was made for, then the industry's usual feel. The tone is read from the colors, so a brand color that
 * turns a theme dark counts as dark.
 */
export function themeFit(skin: Skin, tokens: ReturnType<typeof resolveGuide>['tokens'], brief: Brief = {}, words: readonly string[] = brief.feel ?? []): number {
  const defaults = briefFeel({ ...brief, feel: undefined })
  const tags = new Set<string>(skin.feel)
  if (toneOfGuide(tokens) === 'dark') tags.add('dark')
  else tags.delete('dark')
  const explicit = words.filter((w) => tags.has(w)).length
  const industry = brief.industry && skin.industries?.includes(brief.industry)
  return explicit * 20 + (industry ? 6 : 0) + (brief.format && skin.formats?.includes(brief.format) ? 2 : 0) + defaults.filter((w) => tags.has(w)).length
}

interface RankOptions {
  brief?: Brief
  words?: readonly string[]
  guide?: GuideState
  contract?: Contract
  pool?: Skin[]
  different?: boolean
  exclude?: string[]
  count?: number
}

export function rankThemes({
  brief = {},
  words = brief.feel ?? [],
  guide = emptyGuide(),
  contract,
  pool = themeList(),
  different,
  exclude = [],
  count = 3,
}: RankOptions = {}) {
  const scored = pool
    .filter((s) => s.id !== 'wireframe')
    .map((skin) => {
      const result = applySkin(guide, skin, contract)
      const tokens = resolveGuide(result).tokens
      const fit = themeFit(skin, tokens, brief, words)
      return {
        skin,
        guide: result,
        reason: themeReason(result),
        fit,
        key: visualKey(result),
        family: primaryFamily(tokens['font.display']),
        color: tokens['color.primary'],
      }
    })
  const chosen: typeof scored = []
  const used = new Set(scored.filter((c) => exclude.includes(c.skin.id) || (different && c.skin.id === refId(guide.skin))).map((c) => c.key))
  while (chosen.length < count) {
    const score = (c: (typeof scored)[number]) => (different ? -c.fit : c.fit) - chosen.filter((p) => p.family === c.family || p.color === c.color).length * 2
    const next = scored.filter((c) => !used.has(c.key)).sort((a, b) => score(b) - score(a) || a.skin.id.localeCompare(b.skin.id))[0]
    if (!next) break
    chosen.push(next)
    used.add(next.key)
  }
  return chosen
}

export function themesFor(words: readonly string[], pool: Skin[], opts: { different?: boolean; count?: number } = {}): Skin[] {
  return rankThemes({ words, pool, ...opts }).map((r) => r.skin)
}
