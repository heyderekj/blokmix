// A palette as a little page, for Jev to look at: the background, a surface band with a
// card, a headline and lines of text in the text and muted colors, a primary button with
// its label, and an accent mark. Bars stand in for words, so no font is needed to draw it.

import type { Palette } from '../palette'

export const SWATCH = { w: 560, h: 320 }

export function swatchSvg(p: Palette): string {
  const c = (k: keyof Palette) => p[k]
  const { w, h } = SWATCH
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${c('color.bg')}"/>
<rect x="0" y="0" width="${w}" height="44" fill="${c('color.bg')}"/>
<rect x="28" y="17" width="64" height="10" rx="5" fill="${c('color.text')}"/>
<rect x="360" y="19" width="40" height="6" rx="3" fill="${c('color.muted')}"/>
<rect x="414" y="19" width="40" height="6" rx="3" fill="${c('color.muted')}"/>
<rect x="468" y="12" width="64" height="20" rx="10" fill="${c('color.primary')}"/>
<rect x="484" y="19" width="32" height="6" rx="3" fill="${c('color.onPrimary')}"/>
<line x1="0" y1="44" x2="${w}" y2="44" stroke="${c('color.border')}" stroke-width="1.5"/>
<rect x="28" y="72" width="26" height="8" rx="4" fill="${c('color.accent')}"/>
<rect x="28" y="92" width="250" height="20" rx="4" fill="${c('color.text')}"/>
<rect x="28" y="120" width="190" height="20" rx="4" fill="${c('color.text')}"/>
<rect x="28" y="156" width="230" height="7" rx="3.5" fill="${c('color.muted')}"/>
<rect x="28" y="170" width="200" height="7" rx="3.5" fill="${c('color.muted')}"/>
<rect x="28" y="196" width="104" height="32" rx="16" fill="${c('color.primary')}"/>
<rect x="48" y="209" width="64" height="7" rx="3.5" fill="${c('color.onPrimary')}"/>
<rect x="142" y="196" width="96" height="32" rx="16" fill="none" stroke="${c('color.border')}" stroke-width="1.5"/>
<rect x="160" y="209" width="60" height="7" rx="3.5" fill="${c('color.text')}"/>
<rect x="306" y="68" width="226" height="164" rx="14" fill="${c('color.surface')}" stroke="${c('color.border')}" stroke-width="1.5"/>
<circle cx="336" cy="100" r="12" fill="${c('color.accent')}"/>
<rect x="358" y="94" width="110" height="10" rx="5" fill="${c('color.text')}"/>
<rect x="326" y="128" width="186" height="6" rx="3" fill="${c('color.muted')}"/>
<rect x="326" y="142" width="160" height="6" rx="3" fill="${c('color.muted')}"/>
<rect x="326" y="190" width="186" height="26" rx="8" fill="${c('color.primary')}"/>
<rect x="0" y="252" width="${w}" height="68" fill="${c('color.surface')}"/>
<rect x="28" y="276" width="140" height="8" rx="4" fill="${c('color.text')}"/>
<rect x="28" y="292" width="220" height="6" rx="3" fill="${c('color.muted')}"/>
<rect x="420" y="272" width="112" height="28" rx="14" fill="${c('color.text')}"/>
<rect x="444" y="283" width="64" height="6" rx="3" fill="${c('color.bg')}"/>
</svg>`
}
