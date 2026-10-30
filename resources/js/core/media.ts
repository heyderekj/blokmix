// Images in blocks: placeholders drawn from your palette, uploads and stock.
// Pure, so the canvas, the exports and an agent all make the same picture.

import type { MediaFill, MediaLink, MediaPlay, PlaceholderStyle, StockPhoto, TokenSet } from './types'
import type { ParamValues } from './treatments/params'

import { FILLS, fillSvg, isFillId } from './treatments/fills'
import { mixHex } from './treatments/params'

export { mixHex }
import { mockRender } from './treatments/mocks'
import { isShaderId, shaderSpec, type ShaderId, type ShaderSpec } from './treatments/shaders'

export const PLACEHOLDER_LABEL: Record<PlaceholderStyle, string> = {
  mesh: 'Mesh',
  shapes: 'Shapes',
  arch: 'Arch',
  waves: 'Waves',
  grid: 'Grid',
  portrait: 'Portrait',
  ...(Object.fromEntries(Object.values(FILLS).map((f) => [f.id, f.label])) as Record<(typeof FILLS)[keyof typeof FILLS]['id'], string>),
}

/** A tiny seeded random, so a placeholder looks the same every time until you shuffle it. */
function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** "4/3" → [800, 600]. */
export function sizeForRatio(ratio: string | undefined, long = 800): [number, number] {
  const [w, h] = (ratio ?? '4/3').split('/').map(Number)
  if (!(w > 0 && h > 0)) return [long, Math.round(long * 0.75)]
  return w >= h ? [long, Math.round((long * h) / w)] : [Math.round((long * w) / h), long]
}

/** A placeholder picture in your palette, as SVG. Generative ones take their dials. */
export function placeholderSvg(style: PlaceholderStyle, seed: number, tokens: TokenSet, ratio?: string, params?: ParamValues): string {
  const [W, H] = sizeForRatio(ratio)
  if (isFillId(style)) return fillSvg(style, params, seed, tokens, W, H)
  const r = rng(seed)
  const bg = tokens['color.bg']
  const surface = tokens['color.surface']
  const primary = tokens['color.primary']
  const accent = tokens['color.accent']
  const text = tokens['color.text']
  const soft = mixHex(primary, surface, 0.28)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const m = Math.min(W, H)
  let body = ''

  if (style === 'mesh') {
    const blobs = [primary, accent, soft, mixHex(accent, surface, 0.5)]
      .map((c) => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(m * (0.35 + r() * 0.35)).toFixed(0)}" fill="${c}" opacity="0.85"/>`)
      .join('')
    body = `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(m / 7).toFixed(0)}"/></filter></defs><rect width="100%" height="100%" fill="${surface}"/><g filter="url(#b)">${blobs}</g>`
  } else if (style === 'shapes') {
    const cx = W * (0.3 + r() * 0.15)
    const cy = H * (0.45 + r() * 0.1)
    body = `<rect width="100%" height="100%" fill="${surface}"/>
<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(m * 0.26).toFixed(0)}" fill="${primary}"/>
<rect x="${(W * 0.5).toFixed(0)}" y="${(H * 0.28).toFixed(0)}" width="${(m * 0.38).toFixed(0)}" height="${(m * 0.38).toFixed(0)}" rx="${(m * 0.04).toFixed(0)}" fill="${accent}" transform="rotate(${(r() * 30 - 15).toFixed(0)} ${(W * 0.62).toFixed(0)} ${(H * 0.45).toFixed(0)})"/>
<path d="M${(W * 0.12).toFixed(0)} ${(H * 0.86).toFixed(0)}h${(W * 0.76).toFixed(0)}" stroke="${text}" stroke-opacity="0.35" stroke-width="${(m * 0.012).toFixed(1)}" stroke-linecap="round"/>`
  } else if (style === 'arch') {
    const aw = W * 0.42
    const ax = (W - aw) / 2
    body = `<rect width="100%" height="100%" fill="${surface}"/>
<path d="M${ax.toFixed(0)} ${H}V${(H * 0.42).toFixed(0)}a${(aw / 2).toFixed(0)} ${(aw / 2).toFixed(0)} 0 0 1 ${aw.toFixed(0)} 0V${H}Z" fill="${soft}"/>
<circle cx="${(W * (0.5 + (r() - 0.5) * 0.12)).toFixed(0)}" cy="${(H * 0.42).toFixed(0)}" r="${(m * 0.11).toFixed(0)}" fill="${accent}"/>
<path d="M0 ${(H * 0.78).toFixed(0)}Q${(W * 0.5).toFixed(0)} ${(H * (0.62 + r() * 0.1)).toFixed(0)} ${W} ${(H * 0.8).toFixed(0)}V${H}H0Z" fill="${primary}"/>`
  } else if (style === 'waves') {
    const layers = [mixHex(primary, surface, 0.35), mixHex(primary, surface, 0.65), primary]
    body =
      `<rect width="100%" height="100%" fill="${surface}"/><circle cx="${(W * (0.65 + r() * 0.2)).toFixed(0)}" cy="${(H * 0.28).toFixed(0)}" r="${(m * 0.12).toFixed(0)}" fill="${accent}"/>` +
      layers
        .map((c, n) => {
          const y = H * (0.5 + n * 0.14)
          const a = H * (0.05 + r() * 0.06)
          return `<path d="M0 ${y.toFixed(0)}C${(W * 0.25).toFixed(0)} ${(y - a).toFixed(0)} ${(W * 0.5).toFixed(0)} ${(y + a).toFixed(0)} ${W} ${(y - a / 2).toFixed(0)}V${H}H0Z" fill="${c}"/>`
        })
        .join('')
  } else if (style === 'grid') {
    const gap = m / 12
    let dots = ''
    for (let x = gap / 2; x < W; x += gap) for (let y = gap / 2; y < H; y += gap) dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(gap * 0.06).toFixed(1)}"/>`
    body = `<rect width="100%" height="100%" fill="${bg}"/><g fill="${text}" fill-opacity="0.18">${dots}</g>
<circle cx="${(W * (0.35 + r() * 0.3)).toFixed(0)}" cy="${(H * 0.5).toFixed(0)}" r="${(m * 0.24).toFixed(0)}" fill="${primary}"/>
<rect x="${(W * 0.55).toFixed(0)}" y="${(H * 0.2).toFixed(0)}" width="${(m * 0.18).toFixed(0)}" height="${(m * 0.18).toFixed(0)}" rx="${(m * 0.03).toFixed(0)}" fill="${pick([accent, soft])}"/>`
  } else {
    const shirt = pick([primary, mixHex(text, surface, 0.6), accent])
    body = `<rect width="100%" height="100%" fill="${soft}"/>
<circle cx="${(W / 2).toFixed(0)}" cy="${(H * 0.4).toFixed(0)}" r="${(m * 0.17).toFixed(0)}" fill="${mixHex(surface, text, 0.82)}"/>
<path d="M${(W / 2 - m * 0.34).toFixed(0)} ${H}a${(m * 0.34).toFixed(0)} ${(m * 0.3).toFixed(0)} 0 0 1 ${(m * 0.68).toFixed(0)} 0Z" fill="${shirt}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** An upload as the core sees it: an image as a data URL, or a video/Lottie as bytes. */
export interface UploadData {
  dataUrl?: string
  bytes?: ArrayBuffer
  mime?: string
  /** A still for videos, as a data URL. */
  poster?: string
}

/** What a frame (or an export) needs to draw an image block. */
export interface MediaRender {
  kind: 'image' | 'video' | 'lottie' | 'embed' | 'mock' | 'shader'
  /** A URL or data URI. Empty when the bytes travel separately (uploaded video or Lottie: see `asset`). */
  src: string
  alt: string
  fit: 'cover' | 'contain'
  /** Uploaded video or Lottie: the asset id whose bytes the frame receives. */
  asset?: string
  mime?: string
  poster?: string
  play?: MediaPlay
  loop?: boolean
  lightbox?: boolean
  /** Embeds: the player URL, loaded only when someone plays it. */
  player?: string
  /** Mockups: their markup (in its frame) and CSS. */
  html?: string
  css?: string
  /** Shaders: what the runtime (/mx-shaders.js) runs. */
  shader?: ShaderSpec
}

/**
 * A shader's spec, with the palette picture it looks through (fluted glass)
 * drawn as a placeholder in the same palette and shape.
 */
export function shaderFor(id: ShaderId, params: ParamValues | undefined, seed: number, tokens: TokenSet, ratio?: string): ShaderSpec {
  return shaderSpec(id, params, seed, tokens, (style) => svgDataUri(placeholderSvg(style, seed, tokens, ratio)))
}

/** Resolve a fill to what's drawn. */
export function renderMedia(fill: MediaFill, tokens: TokenSet, ratio: string | undefined, uploads: (id: string) => UploadData | undefined): MediaRender | null {
  const alt = fill.alt ?? ''
  const fit = fill.fit ?? 'cover'
  const moving = { play: fill.play ?? defaultPlay(fill), loop: fill.loop ?? true, lightbox: !!fill.lightbox }
  const posterOf = (p: string | undefined) => (p ? (uploads(p)?.dataUrl ?? p) : undefined)
  if (fill.source === 'placeholder') return { kind: 'image', src: svgDataUri(placeholderSvg(fill.style ?? 'mesh', fill.seed ?? 1, tokens, ratio, fill.params)), alt, fit, lightbox: !!fill.lightbox }
  if (fill.source === 'mock') {
    const m = fill.mock ? mockRender(fill.mock, fill.params, fill.seed ?? 1, tokens) : null
    return m ? { kind: 'mock', src: '', alt, fit, html: m.html, css: m.css } : null
  }
  if (fill.source === 'shader') return fill.shader && isShaderId(fill.shader) ? { kind: 'shader', src: '', alt, fit, shader: shaderFor(fill.shader, fill.params, fill.seed ?? 1, tokens, ratio) } : null
  if (fill.source === 'stock' && fill.stock) return { kind: 'image', src: stockUrl(fill.stock, 1600), alt: alt || fill.stock.description || '', fit, lightbox: !!fill.lightbox }
  if (fill.source === 'upload' && fill.asset) {
    const src = uploads(fill.asset)?.dataUrl
    return src ? { kind: 'image', src, alt, fit, lightbox: !!fill.lightbox } : null
  }
  if (fill.source === 'video' || fill.source === 'lottie') {
    const kind = fill.source
    if (fill.asset) {
      const a = uploads(fill.asset)
      if (!a) return null
      return { kind, src: '', asset: fill.asset, mime: a.mime, alt, fit, poster: posterOf(fill.poster) ?? a.poster, ...moving }
    }
    if (fill.link) return { kind, src: fill.link.url, alt, fit, poster: posterOf(fill.poster), ...moving }
    return null
  }
  if (fill.source === 'embed' && fill.link?.id) {
    // Embeds are a poster and a play button until someone asks: the player loads on click.
    return { kind: 'embed', src: '', alt, fit, poster: posterOf(fill.poster) ?? embedPoster(fill.link), player: embedPlayer(fill.link), play: 'click', loop: false, lightbox: fill.lightbox ?? true }
  }
  return null
}

/** Sensible playback for what it is: Lotties and short videos loop in view; embeds wait for a click. */
export function defaultPlay(fill: MediaFill): MediaPlay {
  return fill.source === 'embed' ? 'click' : 'inview'
}

/* ---------- links ---------- */

/** What a pasted link is: a video file, a Lottie, or a YouTube/Vimeo page. */
export function detectLink(raw: string): { source: 'video' | 'lottie' | 'embed'; link: MediaLink } | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^www\./, '')
  const yt =
    host === 'youtu.be' ? u.pathname.slice(1) : host.endsWith('youtube.com') ? (u.searchParams.get('v') ?? /^\/(?:embed|shorts)\/([\w-]+)/.exec(u.pathname)?.[1]) : null
  if (yt) return { source: 'embed', link: { url: raw.trim(), provider: 'youtube', id: yt } }
  const vm = host.endsWith('vimeo.com') ? /\/(\d+)/.exec(u.pathname)?.[1] : null
  if (vm) return { source: 'embed', link: { url: raw.trim(), provider: 'vimeo', id: vm } }
  const path = u.pathname.toLowerCase()
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return { source: 'video', link: { url: u.toString() } }
  if (/\.(lottie|json)$/.test(path)) return { source: 'lottie', link: { url: u.toString() } }
  return null
}

export function embedPoster(l: MediaLink): string | undefined {
  if (l.provider === 'youtube' && l.id) return `https://i.ytimg.com/vi/${l.id}/hq720.jpg`
  return undefined
}

/** Privacy-friendly players that start when they load (they only load on a click). */
export function embedPlayer(l: MediaLink): string | undefined {
  if (l.provider === 'youtube' && l.id) return `https://www.youtube-nocookie.com/embed/${l.id}?autoplay=1&rel=0&playsinline=1`
  if (l.provider === 'vimeo' && l.id) return `https://player.vimeo.com/video/${l.id}?autoplay=1&dnt=1`
  return undefined
}

/* ---------- stock (Unsplash) ---------- */

/** Unsplash asks for hotlinked image URLs; size them with their imgix params. */
export function stockUrl(p: StockPhoto, w: number): string {
  const u = new URL(p.url)
  u.searchParams.set('w', String(w))
  u.searchParams.set('q', '80')
  u.searchParams.set('auto', 'format')
  u.searchParams.set('fit', 'max')
  return u.toString()
}

export const UTM = 'utm_source=blokmix&utm_medium=referral'

export function stockCredit(p: StockPhoto): string {
  return `Photo by ${p.author} (${p.authorUrl}?${UTM}) on Unsplash (https://unsplash.com/?${UTM})`
}

interface UnsplashResult {
  id: string
  width: number
  height: number
  description: string | null
  alt_description: string | null
  urls: { raw: string; small: string }
  links: { html: string; download_location: string }
  user: { name: string; links: { html: string } }
}

/** Unsplash search results as stock photos (plus the download-tracking URL to ping when one is chosen). */
export function parseUnsplash(json: { results?: UnsplashResult[] }): (StockPhoto & { track: string })[] {
  return (json.results ?? []).map((x) => ({
    provider: 'unsplash' as const,
    id: x.id,
    url: x.urls.raw,
    thumb: x.urls.small,
    width: x.width,
    height: x.height,
    author: x.user.name,
    authorUrl: x.user.links.html,
    link: x.links.html,
    description: x.alt_description ?? x.description ?? undefined,
    track: x.links.download_location,
  }))
}

export function unsplashSearchUrl(query: string, ratio?: string): string {
  const [w, h] = sizeForRatio(ratio)
  const orientation = w > h * 1.15 ? 'landscape' : h > w * 1.15 ? 'portrait' : 'squarish'
  const u = new URL('https://api.unsplash.com/search/photos')
  u.searchParams.set('query', query)
  u.searchParams.set('per_page', '18')
  u.searchParams.set('orientation', orientation)
  u.searchParams.set('content_filter', 'high')
  return u.toString()
}

/** A data URL as bytes, for writing uploads into an export. */
export function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:image\/([a-z+]+);base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, ext: m[1] === 'jpeg' ? 'jpg' : m[1].replace('+xml', '') }
}
