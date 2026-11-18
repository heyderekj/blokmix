import { resolveGuide } from './guide'
import { isSamplePhoto } from './types'
import { isMockId, type MockId } from './treatments/mocks'
import { placeholderSvg, samplePhotoSrc, svgDataUri } from './media'
import { surfaceTokens } from './surface'
import type { GuideState, TokenSet } from './types'

// Keep theme specimens canvas-safe while preserving the silhouette of the full HTML mockup.
function miniatureScreen(id: MockId, t: TokenSet) {
  const ink = t['color.text']
  const accent = t['color.accent']
  const surface = t['color.surface']
  const rect = (x: number, y: number, w: number, h: number, fill: string, radius = 2) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`
  const rows = (x: number, y: number, widths: number[], step: number, color: string) =>
    widths.map((w, i) => rect(x, y + i * step, w, 4, color)).join('')
  const chart = (x: number) => [17, 29, 21, 38, 31, 44].map((h,i) => rect(x+i*11,88-h,7,h,accent)).join('')
  const screens: Record<MockId, () => string> = {
    dashboard: () => rect(8,23,32,71,surface) + rows(12,34,[19,15,16,18],9,ink) + chart(57),
    analytics: () => rect(12,27,50,12,ink) + chart(44),
    calendar: () => Array.from({length:28},(_,i)=>rect(12+i%7*21,27+Math.floor(i/7)*17,17,12,i%9===1 ? accent : surface)).join(''),
    chat: () => rect(16,29,82,15,surface,7) + rect(64,50,80,15,accent,7) + rect(16,72,61,15,surface,7),
    cards: () => [11,60,109].map(x=>rect(x,26,42,60,surface)+rect(x+4,30,34,26,accent)+rows(x+4,65,[29,20],8,ink)).join(''),
    phone: () => rect(56,6,48,88,ink,8) + rect(60,12,40,74,surface,5) + rect(64,24,32,24,accent) + rows(65,57,[27,21,25],8,ink),
    table: () => [15,69,119].map(x=>rows(x,27,[24,21,29,25,18],13,ink)).join(''),
    form: () => rect(27,26,105,14,surface) + rect(27,48,105,14,surface) + rect(27,72,54,13,accent),
    toasts: () => [25,49,73].map(y=>rect(31,y,99,17,surface,5)+rect(37,y+4,9,9,accent,5)+rect(54,y+6,53,4,ink)).join(''),
    code: () => rows(14,25,[68,33,51,23],16,ink) + rows(34,33,[52,90,70,41],16,accent),
  }
  return svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">${rect(0,0,160,100,t['color.bg'])}${rect(0,0,160,14,surface)}${rect(8,5,4,4,ink)}${rect(15,5,4,4,ink)}${screens[id]()}</svg>`)
}

export function themeScene(guide: GuideState, title: string, body = 'A closer look') {
  const tokens = resolveGuide(guide).tokens
  const hero = surfaceTokens(tokens, guide.sections?.hero?.surface)
  const band = surfaceTokens(tokens, guide.sections?.features?.surface ?? 'soft')
  const radius = Math.min(28, parseFloat(tokens['radius.base']) || 0)
  const inset = Math.max(18, Math.min(44, parseFloat(tokens['space.section']) / 3))
  const card = guide.components?.card?.variant
  const picture = guide.picture
  const first = picture?.subjects?.[0]
  const style = first ?? picture?.style
  const art = style && (isMockId(style) ? miniatureScreen(style, tokens) : isSamplePhoto(style) ? samplePhotoSrc[style]
    : svgDataUri(placeholderSvg(style, 7, tokens, '5/3', first ? { mode: picture?.mode ?? 'combined', photo: picture?.photo ?? false } : picture?.params)))
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
