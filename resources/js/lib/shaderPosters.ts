// Shader stills, rendered in this browser with the same player the frames and
// exports run: posters for exports (compose writes a stand-in; these replace it)
// and thumbnails for the pickers. One render at a time, so only one extra WebGL
// context is ever alive.

import { useEffect, useState } from 'react'
import type { ComposedPage } from '@/core/compose'
import type { ShaderSpec } from '@/core/treatments'

let queue: Promise<unknown> = Promise.resolve()

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))

/** One still of a shader at a size, as an image file. Rejects without WebGL. */
export function renderShader(spec: ShaderSpec, w: number, h: number, type = 'image/png', quality?: number): Promise<Blob> {
  const run = async () => {
    const { mountShader } = await import('@/frame/shader-runtime')
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;opacity:0;pointer-events:none;z-index:-1;contain:strict`
    document.body.appendChild(host)
    const m = await mountShader(host, spec, { speed: 0, preserve: true, minPixelRatio: 1, maxPixels: w * h }).catch((e) => {
      host.remove()
      throw e
    })
    try {
      // The canvas takes its size from a resize observer, then draws (a new canvas starts at 300×150).
      for (let i = 0; i < 60 && Math.abs(m.canvasElement.width - w) > 1; i++) await nextFrame()
      if (Math.abs(m.canvasElement.width - w) > 1) throw new Error('The shader never took its size')
      await nextFrame()
      const blob = await new Promise<Blob | null>((r) => m.canvasElement.toBlob(r, type, quality))
      if (!blob) throw new Error('The shader drew nothing')
      return blob
    } finally {
      m.dispose()
      host.remove()
    }
  }
  const p = queue.then(run, run)
  queue = p.catch(() => {})
  return p
}

/** Every shader poster on a page, baked: path → PNG bytes. Ones that can't be drawn keep their stand-in. */
export async function bakeShaderPosters(page: ComposedPage): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {}
  for (const s of page.shaders) {
    if (out[s.path]) continue
    try {
      out[s.path] = new Uint8Array(await (await renderShader(s.spec, s.w, s.h)).arrayBuffer())
    } catch {
      // No WebGL here: the stand-in poster stays.
    }
  }
  return out
}

/** The page with its baked posters in place of the stand-ins. */
export async function withBakedPosters(page: ComposedPage): Promise<ComposedPage> {
  if (!page.shaders.length) return page
  return { ...page, mediaFiles: { ...page.mediaFiles, ...(await bakeShaderPosters(page)) } }
}

const thumbs = new Map<string, Promise<string>>()

/** A small still of a shader, for pickers (null until it's drawn, or without WebGL). */
export function useShaderThumb(spec: ShaderSpec | null, w = 160, h = 120): string | null {
  const key = spec ? JSON.stringify([spec, w, h]) : ''
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!spec) return setUrl(null)
    let p = thumbs.get(key)
    if (!p) {
      if (thumbs.size > 200) thumbs.clear()
      p = renderShader(spec, w, h, 'image/webp', 0.85).then((b) => URL.createObjectURL(b))
      thumbs.set(key, p)
      p.catch(() => thumbs.delete(key))
    }
    let live = true
    p.then((u) => live && setUrl(u)).catch(() => live && setUrl(null))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return url
}
