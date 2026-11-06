// Screenshots for Jev from Node: the library keeps WebP, Jev takes JPEG/PNG at 280–1568 px
// a side. Chrome (playwright-core, like the capture scripts) decodes and redraws them.

import { readFileSync } from 'node:fs'
import type { Browser, Page } from 'playwright-core'
import type { JevAsset } from '../../resources/js/core/jev'
import { jevSize } from '../../resources/js/lib/jevImage'

export interface Converted {
  asset: JevAsset
  width: number
  height: number
}

/** A page to draw on, reused for every picture. */
export async function drawingPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><canvas></canvas>')
  return page
}

/** A WebP/PNG/JPEG file as a Jev-sized JPEG (letterboxed on white if it's too thin). */
export async function fileToJevJpeg(page: Page, path: string, mime = 'image/webp'): Promise<Converted | null> {
  const b64 = readFileSync(path).toString('base64')
  const size = await page.evaluate(async ({ b64, mime }) => {
    const img = new Image()
    img.src = `data:${mime};base64,${b64}`
    await img.decode()
    return { w: img.naturalWidth, h: img.naturalHeight }
  }, { b64, mime })
  if (!size.w || !size.h) return null
  const s = jevSize(size.w, size.h)
  const data = await page.evaluate(async ({ b64, mime, s }) => {
    const img = new Image()
    img.src = `data:${mime};base64,${b64}`
    await img.decode()
    const c = document.querySelector('canvas')!
    c.width = s.w
    c.height = s.h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s.w, s.h)
    ctx.drawImage(img, Math.round((s.w - s.dw) / 2), Math.round((s.h - s.dh) / 2), s.dw, s.dh)
    return c.toDataURL('image/jpeg', 0.85).replace(/^data:[^,]+,/, '')
  }, { b64, mime, s })
  return { asset: { type: 'image', format: 'jpg', data_base64: data }, width: s.w, height: s.h }
}
