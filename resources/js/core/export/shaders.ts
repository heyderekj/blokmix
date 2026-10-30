// Live shaders in exports and frames: the element they run in, its CSS, and a
// poster. Posters are baked from the real shader in the browser (lib/shaderPosters.ts);
// without WebGL (an export from the command line) a soft gradient in the same
// colors stands in, drawn here, so every export has a poster PNG.

import { zlibSync } from 'fflate'
import type { HEl } from '../html/parse'
import { shaderColors, type ShaderSpec } from '../treatments/shaders'
import { rng } from '../treatments/params'

export { SHADERS_JS, PAPER_SHADERS_VERSION } from './shaders-runtime.generated'

/** The shader element's layout: it covers its block, or sits behind a section's content. */
export const SHADER_CSS = `.mx-shader { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; }
.mx-shader.mx-backdrop { z-index: -1; pointer-events: none; }
.mx-shader > .mx-shader-poster { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: cover; display: block; }
.mx-shader[data-live] > .mx-shader-poster { visibility: hidden; }
`

/** The spec as the element carries it (data-shader). */
export function shaderAttr(spec: ShaderSpec): string {
  return JSON.stringify(spec)
}

/**
 * The element a shader runs in: `.mx-media` filling an image block (with its alt
 * as the label) or `.mx-backdrop` behind a section, with its poster inside.
 */
export function shaderElement(spec: ShaderSpec, o: { as: 'media' | 'backdrop'; poster: string; w: number; h: number; alt?: string }): HEl {
  const label: [string, string][] = o.as === 'backdrop' || !o.alt ? [['aria-hidden', 'true']] : [['role', 'img'], ['aria-label', o.alt]]
  const img: HEl = {
    t: 'el',
    tag: 'img',
    ns: 'html',
    attrs: [['class', 'mx-shader-poster'], ['src', o.poster], ['alt', ''], ['width', String(o.w)], ['height', String(o.h)], ['loading', 'lazy'], ['decoding', 'async']],
    kids: [],
  }
  return { t: 'el', tag: 'div', ns: 'html', attrs: [['class', `mx-shader mx-${o.as}`], ['data-shader', shaderAttr(spec)], ...label], kids: [img] }
}

/** Poster sizes: a section's backdrop is wide; a block's follows its ratio. */
export const BACKDROP_POSTER: [number, number] = [1600, 900]

/**
 * A poster without WebGL: the shader's colors as soft glows over its first,
 * small (the browser smooths it when it's scaled up). Seeded, so it's stable.
 */
export function standInPoster(spec: ShaderSpec, w: number, h: number): Uint8Array {
  const k = 160 / Math.max(w, h)
  const W = Math.max(2, Math.round(w * k))
  const H = Math.max(2, Math.round(h * k))
  const [back = [0, 0, 0, 1], ...rest] = shaderColors(spec)
  const r = rng(spec.frame + 11)
  const spots = rest.slice(0, 6).map((c) => ({ c, x: r() * W, y: r() * H, rad: (0.35 + r() * 0.35) * Math.max(W, H) }))
  const px = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let [cr, cg, cb] = back
      for (const s of spots) {
        const d = Math.hypot(x - s.x, y - s.y) / s.rad
        const a = Math.max(0, 1 - d) ** 2 * s.c[3]
        cr += (s.c[0] - cr) * a
        cg += (s.c[1] - cg) * a
        cb += (s.c[2] - cb) * a
      }
      const i = (y * W + x) * 4
      px[i] = Math.round(cr * 255)
      px[i + 1] = Math.round(cg * 255)
      px[i + 2] = Math.round(cb * 255)
      px[i + 3] = 255
    }
  return encodePng(W, H, px)
}

/** Bytes as a data URI, for the single-file reference build. */
export function pngDataUri(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(s)}`
}

/** RGBA pixels as a PNG (one IDAT, no filtering). */
export function encodePng(w: number, h: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1)
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

let table: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
