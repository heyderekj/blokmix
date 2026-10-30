// The small player for live shaders. Bundled by scripts/build-shaders.ts into
// core/export/shaders-runtime.generated.ts, it runs inside canvas frames and
// ships with exported sites as /mx-shaders.js; the export panel imports it
// directly to bake posters. One element contract everywhere:
//
//   <div class="mx-shader …" data-shader='{"id":…,"u":{…},"speed":…,"frame":…}'>
//     <img class="mx-shader-poster" src="poster.png" alt="">   (exports)
//   </div>
//
// Reduced motion keeps the poster (frames have none, so they render one still
// frame instead); without WebGL the poster simply stays.

import {
  ShaderMount,
  ditheringFragmentShader,
  flutedGlassFragmentShader,
  getShaderNoiseTexture,
  godRaysFragmentShader,
  grainGradientFragmentShader,
  liquidMetalFragmentShader,
  meshGradientFragmentShader,
  type ShaderMountUniforms,
} from '@paper-design/shaders'
import type { ShaderId, ShaderSpec } from '@/core/treatments/shaders'

const FRAGMENTS: Record<ShaderId, string> = {
  'mesh-gradient': meshGradientFragmentShader,
  'grain-flow': grainGradientFragmentShader,
  dithering: ditheringFragmentShader,
  'liquid-metal': liquidMetalFragmentShader,
  'fluted-glass': flutedGlassFragmentShader,
  'god-rays': godRaysFragmentShader,
}
const NOISE: ShaderId[] = ['grain-flow', 'god-rays']

type Host = HTMLElement & { paperShaderMount?: ShaderMount; __mxSpec?: ShaderSpec }

function loaded(img: HTMLImageElement): Promise<HTMLImageElement> {
  return img.decode().then(() => img)
}

/** A picture as a PNG-backed image, so WebGL can read it in every browser (some won't upload an SVG). */
async function raster(src: string, long = 1024): Promise<HTMLImageElement> {
  const svg = await loaded(Object.assign(new Image(), { src }))
  const k = long / Math.max(svg.naturalWidth || long, svg.naturalHeight || long)
  const c = document.createElement('canvas')
  c.width = Math.round((svg.naturalWidth || long) * k)
  c.height = Math.round((svg.naturalHeight || long) * k)
  c.getContext('2d')!.drawImage(svg, 0, 0, c.width, c.height)
  return loaded(Object.assign(new Image(), { src: c.toDataURL('image/png') }))
}

const noise = { img: null as Promise<HTMLImageElement> | null }
const pictures = new Map<string, Promise<HTMLImageElement>>()

/** The textures a spec needs: Paper's noise, and the picture behind fluted glass. */
async function textures(spec: ShaderSpec): Promise<ShaderMountUniforms> {
  const out: ShaderMountUniforms = {}
  if (NOISE.includes(spec.id)) out.u_noiseTexture = await (noise.img ??= loaded(getShaderNoiseTexture()!))
  if (spec.image) {
    let p = pictures.get(spec.image)
    if (!p) {
      if (pictures.size > 40) pictures.clear()
      pictures.set(spec.image, (p = raster(spec.image)))
    }
    out.u_image = await p
  }
  return out
}

export interface MountOptions {
  /** 0 renders one still frame. */
  speed?: number
  /** For reading pixels back (posters). */
  preserve?: boolean
  /** Cap on rendered pixels (posters render at their own size). */
  maxPixels?: number
  minPixelRatio?: number
}

/** Run a spec in an element (the shader's canvas goes in first, behind anything else in it). */
export async function mountShader(el: HTMLElement, spec: ShaderSpec, o: MountOptions = {}): Promise<ShaderMount> {
  const host = el as Host
  host.__mxSpec = spec
  const extra = await textures(spec)
  // Something newer was asked for while the textures loaded.
  if (host.__mxSpec !== spec) throw new Error('superseded')
  return new ShaderMount(el, FRAGMENTS[spec.id], { ...spec.u, ...extra } as ShaderMountUniforms, o.preserve ? { preserveDrawingBuffer: true } : undefined, o.speed ?? spec.speed, spec.frame, o.minPixelRatio, o.maxPixels)
}

/** The page-side player: finds shader elements, runs them, keeps them in step with changes. */
export function installShaders(win: Window & { mxShaders?: unknown }) {
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches
  const parse = (el: Element): ShaderSpec | null => {
    try {
      return JSON.parse(el.getAttribute('data-shader') ?? '')
    } catch {
      return null
    }
  }
  const poster = (el: Element) => el.querySelector(':scope > .mx-shader-poster')
  const speedOf = (spec: ShaderSpec) => (reduce ? 0 : spec.speed)

  async function mount(el: Host, spec: ShaderSpec) {
    // With reduced motion a poster is the still; without one (frames), render a still instead.
    if (reduce && poster(el)) return
    try {
      const m = await mountShader(el, spec, { speed: speedOf(spec) })
      if (el.__mxSpec === spec) el.setAttribute('data-live', '')
      // Browsers drop the oldest WebGL contexts past a handful: show the poster again rather than a blank canvas.
      m.canvasElement.addEventListener('webglcontextlost', () => {
        if (el.paperShaderMount === m) dispose(el)
      })
    } catch {
      // No WebGL (or it ran out of contexts): the poster, or the CSS stand-in behind, stays.
    }
  }

  /** Point an element at a spec: same shader → new uniforms in place (dragging a dial); another → a fresh mount. */
  function update(el: Host, spec: ShaderSpec) {
    const prev = el.__mxSpec
    el.setAttribute('data-shader', JSON.stringify(spec))
    const m = el.paperShaderMount
    if (m && prev?.id === spec.id && prev.image === spec.image) {
      el.__mxSpec = spec
      m.setUniforms(spec.u as ShaderMountUniforms)
      m.setSpeed(speedOf(spec))
      if (prev.frame !== spec.frame) m.setFrame(spec.frame)
      return
    }
    dispose(el)
    el.__mxSpec = spec
    void mount(el, spec)
  }

  function dispose(el: Host) {
    el.paperShaderMount?.dispose()
    el.removeAttribute('data-live')
    delete el.__mxSpec
  }

  function wire(root: ParentNode) {
    root.querySelectorAll<Host>('.mx-shader[data-shader]:not([data-wired])').forEach((el) => {
      el.setAttribute('data-wired', '')
      const spec = parse(el)
      if (!spec || !FRAGMENTS[spec.id]) return
      el.__mxSpec = spec
      void mount(el, spec)
    })
  }

  win.mxShaders = { wire, update, dispose }
  const doc = win.document
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => wire(doc))
  else wire(doc)
}
