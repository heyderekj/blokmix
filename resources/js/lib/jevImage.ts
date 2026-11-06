// Pictures for Jev: JPEG or PNG, 280–1568 px a side. Uploads are WebP and stock photos
// can come as WebP or AVIF, so everything is drawn onto a canvas and sent as JPEG.
// A picture too thin to reach 280 px on its short side is letterboxed, and the box it
// landed in comes back with it, so a Box answer can be mapped onto the real picture.

import type { JevAsset } from '@/core/jev'

const MIN = 280
const MAX = 1568

export interface JevImage {
  asset: JevAsset
  /** Where the picture sits on the canvas sent, as fractions of it (all 0–1). */
  inner: { left: number; top: number; width: number; height: number }
}

/** The canvas size for a picture: at most 1568 on its long side, padded to 280 on its short one. */
export function jevSize(w: number, h: number, longest = MAX): { w: number; h: number; dw: number; dh: number } {
  const s = Math.min(1, longest / Math.max(w, h))
  let dw = Math.max(1, Math.round(w * s))
  let dh = Math.max(1, Math.round(h * s))
  // Small pictures grow to the minimum (a 200px logo is still worth a look).
  const grow = Math.max(1, MIN / Math.min(dw, dh))
  if (grow > 1 && Math.max(dw, dh) * grow <= MAX) {
    dw = Math.round(dw * grow)
    dh = Math.round(dh * grow)
  }
  return { w: Math.max(MIN, dw), h: Math.max(MIN, dh), dw, dh }
}

async function load(src: Blob | string): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof src !== 'string') return createImageBitmap(src)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.src = src
  await img.decode()
  return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function draw(img: CanvasImageSource, w: number, h: number, longest?: number): Promise<JevImage> {
  const size = jevSize(w, h, longest)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.w, size.h)
  const x = Math.round((size.w - size.dw) / 2)
  const y = Math.round((size.h - size.dh) / 2)
  ctx.drawImage(img, x, y, size.dw, size.dh)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No JPEG'))), 'image/jpeg', 0.86))
  return {
    asset: { type: 'image', format: 'jpg', data_base64: await toBase64(blob) },
    inner: { left: x / size.w, top: y / size.h, width: size.dw / size.w, height: size.dh / size.h },
  }
}

/** A picture (a Blob from the asset store, or a URL that allows CORS) as a JPEG Jev can read. */
export async function toJevJpeg(src: Blob | string, longest?: number): Promise<JevImage | null> {
  try {
    const img = await load(src)
    return await draw(img, img.width, img.height, longest)
  } catch {
    return null
  }
}

/** An SVG drawing (a swatch card, a placeholder) as a JPEG. */
export async function svgToJpeg(svg: string, width: number, height: number): Promise<JevImage | null> {
  try {
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await img.decode()
    return await draw(img, width, height)
  } catch {
    return null
  }
}

/** A Box answer (fractions of the canvas sent) as fractions of the picture itself, clamped to it. */
export function boxOnPicture(box: { top: number; bottom: number; left: number; right: number }, inner: JevImage['inner']) {
  const fx = (v: number) => Math.max(0, Math.min(1, (v - inner.left) / inner.width))
  const fy = (v: number) => Math.max(0, Math.min(1, (v - inner.top) / inner.height))
  return { top: fy(box.top), bottom: fy(box.bottom), left: fx(box.left), right: fx(box.right) }
}
