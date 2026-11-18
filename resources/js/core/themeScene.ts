import { resolveGuide } from './guide'
import { placeholderSvg, svgDataUri } from './media'
import { surfaceTokens } from './surface'
import type { GuideState } from './types'

export function themeScene(guide: GuideState, title: string, body = 'A closer look') {
  const tokens = resolveGuide(guide).tokens
  const hero = surfaceTokens(tokens, guide.sections?.hero?.surface)
  const band = surfaceTokens(tokens, guide.sections?.features?.surface ?? 'soft')
  const radius = Math.min(28, parseFloat(tokens['radius.base']) || 0)
  const inset = Math.max(18, Math.min(44, parseFloat(tokens['space.section']) / 3))
  const card = guide.components?.card?.variant
  const art = guide.picture && svgDataUri(placeholderSvg(guide.picture.style, 7, tokens, '2/1', guide.picture.params))
  const button = guide.components?.button
  const lines = [
    {
      text: title || 'Your site',
      x: inset,
      y: 88,
      width: 350,
      size: 47,
      family: tokens['font.display'],
      weight: Number(tokens['type.displayWeight']),
      color: hero['color.text'],
    },
    { text: body, x: inset, y: 132, width: 325, size: 24, family: tokens['font.body'], weight: 400, color: hero['color.muted'] },
    {
      text: button?.variant === 'caps' ? 'GET STARTED' : 'Get started',
      x: inset + 12,
      y: 190,
      width: 109,
      size: 19,
      family: tokens['font.body'],
      weight: 600,
      color: hero['color.onPrimary'],
    },
    {
      text: button?.secondary?.variant === 'arrow' ? 'Learn more →' : 'Learn more',
      x: inset + 151,
      y: 190,
      width: 117,
      size: 18,
      family: tokens['font.body'],
      weight: 500,
      color: hero['color.text'],
    },
  ]
  return { hero, band, radius, inset, card, art, lines, pill: button?.variant === 'pill', outline: button?.secondary?.variant === 'outline' }
}
export type ThemeScene = ReturnType<typeof themeScene>
