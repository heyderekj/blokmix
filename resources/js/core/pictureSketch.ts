// Small editorial illustrations. Each subject has a physical motif and a matching UI fragment.
// All coordinates are in artwork space so the same composition can fit a card, a hero or a thumbnail.
import type { TokenSet } from './types'
import { mixHex, type ParamValues } from './treatments/params'

import { type SketchId, type SketchMode } from './sketchCatalog'

type Ink = { ink: string; paper: string; color: string; light: string }
const line = (d: string, stroke: string, width = 2) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" />`
const shape = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`
const box = (x: number, y: number, w: number, h: number, fill: string, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`
const dot = (x: number, y: number, r: number, fill: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const label = (x: number, y: number, value: string, size: number, bold = false) => `<text x="${x}" y="${y}" stroke="none" fill="currentColor" font-family="${bold ? 'Arial, sans-serif' : 'monospace'}" font-size="${size}" font-weight="${bold ? 700 : 500}">${value}</text>`

type Subject = {
  pigment: string
  heading: string
  // Motifs fit a 240 × 180 sheet. The panel sits on a separate 192 × 130 sheet.
  motif: (p: Ink) => string
  panel: (p: Ink) => string
}

const subjects: Record<SketchId, Subject> = {
  'bread-counter': {
    pigment: '#ff852a', heading: 'PICKUP TICKET',
    motif: ({ ink, paper, color, light }) => `
      ${shape('M11 140 171 112 234 139 79 169Z', light)}
      <g transform="rotate(-14 119 96)" stroke="${ink}" stroke-width="2.4">
        ${shape('M21 107C21 79 58 49 104 45 146 39 197 53 216 88 226 107 209 125 186 132 138 146 67 143 36 128 27 123 21 117 21 107Z', color)}
        ${line('M24 110Q66 140 155 130T215 93', ink) + line('M36 97q4-15 22-28m35-13 10-3m65 3 12 5m-24 53 19-5',paper,2)}
        ${['M54 95Q65 67 91 59Q76 83 54 95Z','M90 91Q107 59 133 54Q119 78 90 91Z','M129 96Q152 64 175 66Q157 85 129 96Z'].map(d=>shape(d,paper)).join('')}
        ${line('M46 114l6 3m9-5 4 2m78 4 5-1m16-10 5-2m21-8 4-2',ink,1.4)}
      </g>`,
    panel: ({ ink }) => label(16, 60, 'No. 024', 29, true) + `<path d="M16 71h159" stroke="${ink}" stroke-dasharray="3 4"/>` + label(16,94,'1 × Country loaf',13) + label(16,116,'PICKUP   09:30',11),
  },
  'pottery-shelf': {
    pigment: '#ff6241', heading: 'STUDIO STORE',
    motif: ({ ink, paper, color, light }) => `
      ${shape('M11 143 179 130 234 144 54 158Z',light)}
      <g stroke="${ink}" stroke-width="2.5">
        ${shape('M41 65Q65 58 99 65L95 81C96 93 116 104 112 127Q111 143 83 145L56 144Q28 142 28 123C26 106 47 89 46 80Z',color)}
        <ellipse cx="70" cy="65" rx="29" ry="6" fill="${paper}"/>
        ${line('M35 112Q48 108 56 115T78 116T107 115M34 119Q47 116 55 122T79 123T108 121',ink)}
        ${shape('M128 85Q143 77 178 84L175 91Q184 91 189 98C198 115 180 126 172 123L169 134Q150 143 134 134Z',paper)}
        ${line('M177 98c13-5 12 14-3 18',ink,4)}
        <ellipse cx="153" cy="85" rx="25" ry="4.5" fill="${light}"/>
      </g>`,
    panel: ({ ink, color }) => label(16,60,'Clay cup',25,true) + label(16,83,'OCHRE  /  250 ML',11) + line('M16 94h160',ink,1) + label(16,117,'$28',19,true) + box(119,101,56,19,color,9) + label(130,115,'Add +',11,true),
  },
  'trail-map': {
    pigment: '#11c389', heading: 'FIELD GUIDE',
    motif: ({ ink, paper, color, light }) => `
      ${dot(176,44,17,color)}
      <g stroke="${ink}" stroke-width="2.3">
        ${shape('M13 135 66 66 86 82 114 34 178 117 197 94 230 138Z',paper)}
        ${shape('M66 66 77 100 87 91 99 108 114 34 178 117 197 94 191 138 15 138Z',color)}
        ${shape('M13 136Q66 116 113 130T232 130L218 151Q137 139 78 151T13 136Z',light)}
        ${line('M114 34l12 34-9-5-5 14-8-15m-38 5 4 18-6-4-7 12',ink)}
        ${line('M142 129q-39 4-13 9t-30 7-29 10',ink,2)}
      </g>`,
    panel: ({ ink, color }) => label(16,56,'Ridge loop',23,true) + shape('M17 90 39 84 53 87 81 68 98 80 118 66 136 74 150 63 176 76V93H17Z',color) + line('M16 96h160',ink,1) + label(16,116,'6.4 KM   +320 M',12),
  },
  'print-edition': {
    pigment: '#9578ff', heading: 'PRINT ARCHIVE',
    motif: ({ ink, paper, color, light }) => `
      <g stroke="${ink}" stroke-width="2.2">
        ${shape('M30 60 132 30 168 125 65 153Z',light)}
        ${shape('M74 42 181 28 206 133 98 151Z',paper)}
        <g transform="matrix(1,-.15,.22,1,87,50)">
          ${box(0,0,83,77,color)}
          ${shape('M5 72 29 21 46 49 57 29 82 72Z',ink)}
          ${dot(62,19,9,paper)}
          ${line('M0 85h61m-60 6h36',ink,2)}
        </g>
      </g>`,
    panel: ({ ink, color }) => label(16,64,'Edition 04',24,true) + label(16,84,'RISOGRAPH / A3',11) + line('M16 96h160',ink,1) + box(16,104,22,15,ink) + box(39,104,22,15,color) + label(100,116,'2 COLORS',11),
  },
  'balance-book': {
    pigment: '#51cda0', heading: 'MONTHLY BUDGET',
    motif: ({ ink, paper, color, light }) => `
      <g transform="rotate(-11 119 90)" stroke="${ink}" stroke-width="2.5">
        ${box(28,59,150,86,light,11)}${box(48,40,157,93,color,11)}
        ${box(62,57,27,20,paper,5)}${line('M63 66h25m-13-8v19',ink,1.4)}
        ${line('M65 100h15m6 0h15m6 0h15m6 0h15',ink,3)}
        ${line('M66 116h48',ink,2)}
        ${dot(174,65,8,paper)}${dot(184,65,8,light)}
      </g>`,
    panel: ({ ink, color }) => label(16,61,'$2,480',29,true) + label(16,80,'AVAILABLE',10) + line('M16 114h160',ink,1) + [9,14,10,19,25,22,31,38].map((h,i)=>box(18+i*20,113-h,13,h,i===7?ink:color)).join(''),
  },
  'day-ticket': {
    pigment: '#ff9d32', heading: 'DAY PROGRAM',
    motif: ({ ink, paper, color, light }) => `
      <g stroke="${ink}" stroke-width="2.4" transform="rotate(-15 120 95)">
        ${box(32,56,166,82,light,7)}
        ${shape('M49 41H204V65Q188 72 204 81V121H49V91Q65 83 49 75Z',color)}
        ${line('M166 44v9m0 5v9m0 5v9m0 5v9m0 5v13',ink,1.7)}
        ${shape('M99 54l6 15 16 2-13 11 4 16-13-9-15 9 4-16-12-11 17-2Z',paper)}
        ${line('M178 63v40m5-40v40m4-40v40',ink)}
      </g>`,
    panel: ({ ink, color }) => label(16,55,'Saturday',23,true) + line('M16 67h160',ink,1) + dot(20,86,4,color) + label(33,90,'10:00   Doors',12) + dot(20,108,4,color) + label(33,112,'11:00   Workshop',12),
  },
}

export function sketchMode(params?: ParamValues): SketchMode {
  return params?.mode === 'image' || params?.mode === 'ui' ? params.mode : 'combined'
}

export function sketchSvg(id: SketchId, mode: SketchMode, tokens: TokenSet, w: number, h: number, photo?: string): string {
  const subject = subjects[id]
  const color = mixHex(subject.pigment, tokens['color.accent'], 0.92)
  const ink = mixHex('#201e29', tokens['color.primary'], 0.92)
  const paper = '#fff9e9'
  const p = { ink, color, paper, light: mixHex(color, paper, 0.53) }
  const receipt = id === 'bread-counter'
  const dark = id === 'balance-book'
  const panelInk: Ink = dark ? { ...p, ink: paper } : p
  const ticket = 'M0 0H192V128l-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4Z'
  const shell = receipt ? shape(ticket, paper) : box(0,0,192,130,dark ? ink : paper,id === 'pottery-shelf' ? 13 : 5)
  const card = `<g stroke="${ink}" stroke-width="1.7">
    <g transform="translate(3 4)">${receipt ? shape(ticket,ink) : box(0,0,192,130,ink,id === 'pottery-shelf' ? 13 : 5)}</g>${shell}
    <g color="${panelInk.ink}">${line('M0 30h192',panelInk.ink,1.3)}
    ${dot(16,15,4,color)}${label(30,19,subject.heading,11)}<g stroke="none">${subject.panel(panelInk)}</g></g></g>`
  const tall = w / h < 1.12
  const stacked = mode === 'combined' && tall
  const width = mode === 'combined' ? (stacked ? 260 : 420) : 252
  const height = stacked ? 272 : 202
  const illustration = photo
    ? `<g transform="rotate(-3 120 90)" stroke="${ink}" stroke-width="2">${box(9,14,222,154,paper,2)}
       <image x="16" y="21" width="208" height="133" href="${photo}" preserveAspectRatio="xMidYMid slice" />
       ${line('M17 160h32m134 0h14',ink,1.1)}</g>`
    : subject.motif(p)
  const motif = mode === 'ui' ? '' : `<g transform="translate(${mode === 'combined' ? 0 : 6} ${stacked ? 0 : 10})">${illustration}</g>`
  const cardPosition = mode === 'ui' ? 'translate(27 32)' : stacked ? 'translate(67 142) scale(.87)' : 'translate(211 56) rotate(-2)'
  const panel = mode === 'image' ? '' : `<g transform="${cardPosition}">${card}</g>`
  // Fit the whole drawing, with a quiet margin on even the shortest gallery crops.
  const scale = 0.91 * Math.min(w / width, h / height)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${box(0,0,w,h,mixHex(color,paper,0.62))}
    <g color="${ink}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${(w-width*scale)/2} ${(h-height*scale)/2}) scale(${scale})">${motif}${panel}</g></svg>`
}
