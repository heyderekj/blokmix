// The main colors of a picture (a logo, a photo), for palettes that go with it: drawn
// small on a canvas, counted in coarse buckets, greys and near-whites set aside.

import { hexToOklch } from '@/core/palette'

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** Up to `n` distinct colorful colors, most common first (a grey-only picture gives none). */
export async function colorsFrom(src: Blob | string, n = 3): Promise<string[]> {
  try {
    const img: CanvasImageSource & { width: number; height: number } =
      typeof src === 'string'
        ? await new Promise((resolve, reject) => {
            const i = new Image()
            i.crossOrigin = 'anonymous'
            i.onload = () => resolve(Object.assign(i, { width: i.naturalWidth, height: i.naturalHeight }))
            i.onerror = reject
            i.src = src
          })
        : await createImageBitmap(src)
    const size = 64
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const x = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      x.n++
      x.r += r
      x.g += g
      x.b += b
      buckets.set(key, x)
    }
    const picked: { hex: string; h: number }[] = []
    for (const x of [...buckets.values()].sort((a, b) => b.n - a.n)) {
      const h = hex(x.r / x.n, x.g / x.n, x.b / x.n)
      const lch = hexToOklch(h)
      if (!lch || lch[1] < 0.05 || lch[0] > 0.95 || lch[0] < 0.15) continue
      if (picked.some((p) => Math.min(Math.abs(p.h - lch[2]), 360 - Math.abs(p.h - lch[2])) < 25)) continue
      picked.push({ hex: h, h: lch[2] })
      if (picked.length === n) break
    }
    return picked.map((p) => p.hex)
  } catch {
    return []
  }
}
