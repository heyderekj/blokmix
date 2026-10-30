import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { unzlibSync } from 'fflate'
import * as paper from '@paper-design/shaders'
import { library } from '@/data/library'
import { BASE_TOKENS } from '@/core/tokens'
import { surfaceTokens } from '@/core/surface'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP, type Slot, type TokenSet } from '@/core/types'
import { composePage } from '@/core/compose'
import { packetFiles } from '@/core/export/packet'
import { astroFiles } from '@/core/export/astro'
import { nextFiles } from '@/core/export/next'
import { referenceHtml } from '@/core/export/reference-html'
import { PAPER_SHADERS_VERSION, SHADERS_JS, SHADER_CSS, encodePng, standInPoster } from '@/core/export/shaders'
import { renderMedia, shaderFor } from '@/core/media'
import { SHADERS, SHADER_IDS, backdropCss, backdropParams, clampParams, shaderSpec, treatmentInfo, treatmentList, zodFor, type ShaderSpec } from '@/core/treatments'
import { frameStateFor, withoutShaders } from '@/state/derived'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'

// The guide turned dark (the way a section's inverse surface does).
const dark: TokenSet = surfaceTokens(BASE_TOKENS, 'inverse')

/** The uniforms a fragment shader declares. */
const FRAGMENT: Record<string, string> = {
  'mesh-gradient': paper.meshGradientFragmentShader,
  'grain-flow': paper.grainGradientFragmentShader,
  dithering: paper.ditheringFragmentShader,
  'liquid-metal': paper.liquidMetalFragmentShader,
  'fluted-glass': paper.flutedGlassFragmentShader,
  'god-rays': paper.godRaysFragmentShader,
}
// The sizing uniforms are read by Paper's shared vertex shader.
const VERTEX = readFileSync('node_modules/@paper-design/shaders/dist/vertex-shader.js', 'utf8')
const declared = (src: string) => new Set([...(src + VERTEX).matchAll(/uniform\s+\w+\s+(u_\w+)/g)].map((m) => m[1]))

const isPng = (b: unknown) => b instanceof Uint8Array && [137, 80, 78, 71].every((x, i) => b[i] === x)

describe('shader specs', () => {
  it('give each shader exactly the uniforms its fragment declares, in range, the same every time', () => {
    for (const id of SHADER_IDS) {
      const own = declared(FRAGMENT[id])
      for (const params of [undefined, ...SHADERS[id].presets.map((p) => p.values)])
        for (const tokens of [BASE_TOKENS, dark]) {
          const spec = shaderFor(id, params, 3, tokens, '4/3')
          for (const k of Object.keys(spec.u)) expect(own.has(k), `${id} sets ${k}, which it doesn’t declare`).toBe(true)
          const json = JSON.stringify(spec)
          expect(json, id).not.toMatch(/NaN|null|undefined/)
          for (const k of Object.keys(spec.u).filter((x) => /color/i.test(x) && x !== 'u_colorsCount'))
            for (const c of (Array.isArray((spec.u[k] as number[][])[0]) ? spec.u[k] : [spec.u[k]]) as number[][]) for (const x of c) expect(x >= 0 && x <= 1, `${id} ${k}`).toBe(true)
          expect(json).toBe(JSON.stringify(shaderFor(id, params, 3, tokens, '4/3')))
        }
      // Everything the shader reads but the mount doesn't set itself comes from the spec or the runtime.
      const runtime = new Set(['u_time', 'u_resolution', 'u_pixelRatio', 'u_noiseTexture', 'u_image', 'u_imageAspectRatio'])
      const spec = shaderSpec(id, undefined, 1, BASE_TOKENS)
      for (const u of own) expect(u in spec.u || runtime.has(u), `${id} never sets ${u}`).toBe(true)
    }
  })

  it('re-theme with the style guide, and shuffling moves them along their loop', () => {
    for (const id of SHADER_IDS) expect(JSON.stringify(shaderSpec(id, undefined, 1, BASE_TOKENS).u), id).not.toBe(JSON.stringify(shaderSpec(id, undefined, 1, dark).u))
    expect(shaderSpec('mesh-gradient', undefined, 1, BASE_TOKENS).frame).toBe(0)
    expect(shaderSpec('mesh-gradient', undefined, 2, BASE_TOKENS).frame).toBeGreaterThan(0)
    expect(shaderSpec('mesh-gradient', { speed: 1.5 }, 1, BASE_TOKENS).speed).toBe(1.5)
  })

  it('look through a palette picture (fluted glass) and say which choice ids Paper knows', () => {
    const glass = shaderFor('fluted-glass', { behind: 'waves' }, 2, BASE_TOKENS, '16/9')
    expect(glass.image).toMatch(/^data:image\/svg\+xml/)
    expect(glass.speed).toBe(0)
    expect(shaderFor('mesh-gradient', undefined, 1, BASE_TOKENS).image).toBeUndefined()
    // Choices map onto Paper's own enums: an unknown one would come out undefined.
    expect(shaderSpec('grain-flow', { shape: 'truchet' }, 1, BASE_TOKENS).u.u_shape).toBe(paper.GrainGradientShapes.truchet)
    expect(shaderSpec('dithering', { type: '8x8' }, 1, BASE_TOKENS).u.u_type).toBe(paper.DitheringTypes['8x8'])
  })

  it('are listed as live backdrops and fills, with dials agents can set', () => {
    for (const surface of ['backdrop', 'fill'] as const) {
      const live = treatmentList(surface).filter((t) => t.live)
      expect(live.map((t) => t.id)).toEqual([...SHADER_IDS])
      for (const t of live) for (const p of t.presets) expect(zodFor(t.params).safeParse(p.values).success, `${surface} ${t.id} ${p.id}`).toBe(true)
    }
    expect(Object.keys(backdropParams('god-rays'))).toContain('strength')
    expect(backdropParams('god-rays').inverse).toBeUndefined()
    expect(treatmentInfo('fill', 'liquid-metal')?.params.strength).toBeUndefined()
  })
})

describe('shader backdrops', () => {
  it('lift the section into its own layer, fade by strength and stand in with their colors', () => {
    const css = backdropCss({ id: 'mesh-gradient', params: { strength: 60 } }, BASE_TOKENS, '.root')
    expect(css).toMatch(/^@layer effects \{\n\.root \{ /)
    expect(css).toContain('isolation: isolate;')
    expect(css).toContain('.root > .mx-backdrop { opacity: 0.6; }')
    expect(css).toContain('@layer clip { :where(.root) { position: relative; } }')
    expect(css).toContain('radial-gradient(')
    expect(css).not.toMatch(/NaN|undefined/)
  })
})

describe('the shader player', () => {
  it('is built from the installed Paper Shaders and keeps its notice', () => {
    const pkg = JSON.parse(readFileSync('node_modules/@paper-design/shaders/package.json', 'utf8'))
    expect(PAPER_SHADERS_VERSION, 'run npx vite-node scripts/build-shaders.ts').toBe(pkg.version)
    expect(pkg.license).toBe('Apache-2.0')
    expect(SHADERS_JS).toMatch(/^\/\*! Blokmix shader player\. Includes Paper Shaders [\d.]+ .*Apache-2\.0/)
    expect(SHADERS_JS).toContain('mxShaders')
    // It goes inline in the reference build and frames.
    expect(SHADERS_JS).not.toMatch(/<\/script/i)
    expect(() => new Function(SHADERS_JS)).not.toThrow()
    expect(SHADERS_JS.length).toBeLessThan(150_000)
  })

  it('draws a stand-in poster as a real PNG', () => {
    const spec = shaderSpec('grain-flow', undefined, 1, BASE_TOKENS)
    const png = standInPoster(spec, 1600, 900)
    expect(isPng(png)).toBe(true)
    const dv = new DataView(png.buffer, png.byteOffset)
    expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([160, 90])
    expect(png).toEqual(standInPoster(spec, 1600, 900))
    // Two red pixels: the IDAT inflates back to its filter bytes and pixels.
    const two = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255]))
    const idat = two.indexOf(0x49, 33) // "IDAT"
    const len = new DataView(two.buffer).getUint32(idat - 4)
    expect([...unzlibSync(two.subarray(idat + 4, idat + 4 + len))]).toEqual([0, 255, 0, 0, 255, 255, 0, 0, 255])
  })
})

describe('frames', () => {
  const hero = Object.values(library.clips).find((c) => c.type === 'hero' && c.blocks.some((b) => b.kind === 'image'))!
  const image = hero.blocks.find((b) => b.kind === 'image')!

  it('get the backdrop’s shader and shader pictures in their state', () => {
    const slot = {
      keep: { ...DEFAULT_KEEP, style: false },
      backdrop: { id: 'god-rays', preset: 'stage' },
      edits: { [hero.id]: { [image.id]: { media: { source: 'shader' as const, shader: 'liquid-metal', params: { shape: 'circle' } } } } },
    }
    const s = frameStateFor(hero, slot, 'unified', BASE_TOKENS, DEFAULT_CONTENT, 'desktop')
    expect(s.backdrop?.id).toBe('god-rays')
    expect(s.blocks.css).toContain('.mx-backdrop { opacity: 1; }')
    expect(s.media[image.id]).toMatchObject({ kind: 'shader', shader: { id: 'liquid-metal' } })
    expect(frameStateFor(hero, { ...slot, backdrop: { id: 'grid' } }, 'unified', BASE_TOKENS, DEFAULT_CONTENT, 'desktop').backdrop).toBeNull()
    expect(renderMedia({ source: 'shader', shader: 'nope' }, BASE_TOKENS, '4/3', () => undefined)).toBeNull()
    // Hidden alternatives keep the backdrop's CSS stand-in but run no shader.
    const asleep = withoutShaders(s)
    expect(asleep.backdrop).toBeNull()
    expect(asleep.media[image.id]).toBeUndefined()
    expect(asleep.blocks.css).toBe(s.blocks.css)
  })

  it('carry the shader CSS, and their scripts still parse', async () => {
    const { buildSrcdoc } = await import('@/frame/srcdoc')
    const doc = buildSrcdoc({ html: '<section></section>', css: '', tokensCss: '', fontHrefs: [] } as Parameters<typeof buildSrcdoc>[0])
    expect(doc).toContain(SHADER_CSS)
    expect(doc).not.toContain('mxShadersRuntime') // the player comes on demand, not in every frame
    for (const m of doc.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(m[1])).not.toThrow()
  })
})

describe('exports', () => {
  const hero = Object.values(library.clips).find((c) => c.type === 'hero' && c.blocks.some((b) => b.kind === 'image'))!
  const image = hero.blocks.find((b) => b.kind === 'image')!
  const slot: Slot = {
    id: 's1',
    type: 'hero',
    clipId: hero.id,
    locked: false,
    keep: { ...DEFAULT_KEEP, style: false, content: false },
    backdrop: { id: 'mesh-gradient', preset: 'drift', seed: 2 },
    edits: { [hero.id]: { [image.id]: { media: { source: 'shader', shader: 'dithering', seed: 1, alt: 'A moving pattern' } } } },
  }
  const guide = emptyGuide()
  const page = composePage({ slots: [slot], guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })
  const s = page.sections[0]

  it('compose each shader with a poster to bake', () => {
    expect(page.shaders.map((x) => [x.spec.id, x.path])).toEqual([
      ['dithering', `media/s1-${image.id}.png`],
      ['mesh-gradient', 'media/s1-backdrop.png'],
    ])
    for (const x of page.shaders) expect(isPng(page.mediaFiles[x.path]), x.path).toBe(true)
    expect(page.moving).toBe(false)
    expect(s.backdrop).toMatchObject({ label: 'Mesh gradient', live: true, poster: '/media/s1-backdrop.png' })
    expect(s.media[0]).toMatchObject({ source: 'shader', kind: 'shader', src: `/media/s1-${image.id}.png`, shader: { id: 'dithering' } })
    expect(s.css).toContain('.mx-backdrop { opacity: 1; }')
  })

  it('write the player, its CSS, the element and the posters into Astro', () => {
    const files = astroFiles(page)
    expect(files['astro/public/mx-shaders.js']).toBe(SHADERS_JS)
    expect(files['astro/src/styles/base.css']).toContain(SHADER_CSS)
    expect(files['astro/src/layouts/Base.astro']).toContain('<script is:inline src="/mx-shaders.js" defer></script>')
    for (const x of page.shaders) expect(isPng(files[`astro/public/${x.path}`]), x.path).toBe(true)
    const component = Object.entries(files).find(([k]) => k.endsWith('.astro') && k.includes('components'))![1] as string
    expect(component).toContain('class="mx-shader mx-backdrop" data-shader="{&quot;id&quot;:&quot;mesh-gradient&quot;')
    expect(component).toContain('class="mx-shader mx-media" data-shader="{&quot;id&quot;:&quot;dithering&quot;')
    expect(component).toContain('role="img" aria-label="A moving pattern"')
    expect(component).toContain('<img class="mx-shader-poster" src="/media/s1-backdrop.png" alt=""')
    // The spec survives the trip through the attribute.
    const attr = /data-shader="([^"]+)"/.exec(component)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    expect((JSON.parse(attr) as ShaderSpec).u).toEqual(page.shaders.find((x) => x.spec.id === JSON.parse(attr).id)!.spec.u)
  })

  it('write them into Next too', () => {
    const files = nextFiles(page)
    expect(files['next/public/mx-shaders.js']).toBe(SHADERS_JS)
    expect(files['next/app/layout.tsx']).toContain('<Script src="/mx-shaders.js" strategy="afterInteractive" />')
    expect(files['next/app/base.css']).toContain(SHADER_CSS)
    const component = Object.entries(files).find(([k]) => k.endsWith('.tsx') && k.includes('components'))![1] as string
    expect(component).toContain('className="mx-shader mx-backdrop"')
  })

  it('inline the player and posters in the reference build, and use baked posters once they’re in', () => {
    const html = referenceHtml(page)
    expect(html).toContain(SHADERS_JS)
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).not.toContain('src="/media/s1-backdrop.png"')
    const baked = encodePng(1, 1, new Uint8Array([1, 2, 3, 255]))
    const after = referenceHtml({ ...page, mediaFiles: { ...page.mediaFiles, 'media/s1-backdrop.png': baked } })
    expect(after).toContain(`src="data:image/png;base64,${Buffer.from(baked).toString('base64')}"`)
  })

  it('tell the builder about them in the packet', () => {
    const packet = packetFiles({ page, guide: resolveGuide(guide), library, mixName: 'Test', targets: ['astro'] } as Parameters<typeof packetFiles>[0])
    const notes = packet['BLOKMIX.md'] as string
    expect(notes).toContain('**Backdrop:** Mesh gradient, a live WebGL shader')
    expect(notes).toContain('live WebGL shader “dithering”')
    expect(notes).toContain('## Live shaders')
    expect(notes).toContain('Apache-2.0')
  })

  it('ship nothing extra when there are no shaders', () => {
    const plain = composePage({ slots: [{ ...slot, backdrop: { id: 'grid' }, edits: {} }], guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })
    expect(plain.shaders).toEqual([])
    const files = astroFiles(plain)
    expect(files['astro/public/mx-shaders.js']).toBeUndefined()
    expect(files['astro/src/styles/base.css']).not.toContain('.mx-shader')
    expect(referenceHtml(plain)).not.toContain('mxShaders')
  })
})

describe('commands', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
    useStore.temporal.getState().clear()
  })

  it('put a shader behind a section and in an image block, checking their dials', () => {
    const hero = currentSlots(useStore.getState()).find((s) => s.type === 'hero')!
    runCommand('set_section_backdrop', { section: 'hero', backdrop: 'god-rays', preset: 'halo', params: { strength: 70 }, seed: 3 })
    expect(currentSlots(useStore.getState()).find((s) => s.id === hero.id)!.backdrop).toMatchObject({ id: 'god-rays', preset: 'halo', seed: 3, params: { strength: 70 } })
    expect(() => runCommand('set_section_backdrop', { section: 'hero', backdrop: 'liquid-metal', params: { shape: 'cube' } })).toThrow(/Liquid metal/)

    const withImage = currentSlots(useStore.getState()).find((s) => library.clips[s.clipId].blocks.some((b) => b.kind === 'image'))
    if (!withImage) return
    const img = library.clips[withImage.clipId].blocks.find((b) => b.kind === 'image')!
    const r = runCommand('set_image', { section: withImage.id, block: img.id, shader: 'liquid-metal', preset: 'drop', params: { repetition: 4 }, alt: 'Chrome drop' }) as { media: Record<string, unknown> }
    expect(r.media).toMatchObject({ source: 'shader', shader: 'liquid-metal', params: { shape: 'circle', repetition: 4 }, alt: 'Chrome drop' })
    // Dials alone change the shader that's there, keeping the rest.
    runCommand('set_image', { section: withImage.id, block: img.id, params: { speed: 0 } })
    const fill = currentSlots(useStore.getState()).find((s) => s.id === withImage.id)!.edits![withImage.clipId][img.id].media!
    expect(fill).toMatchObject({ source: 'shader', shader: 'liquid-metal', params: { shape: 'circle', repetition: 4, speed: 0 } })
    expect(() => runCommand('set_image', { section: withImage.id, block: img.id, shader: 'dithering', placeholder: 'topo' })).toThrow(/not both/)
    // Back to a placeholder.
    runCommand('set_image', { section: withImage.id, block: img.id, placeholder: 'topo' })
    expect(currentSlots(useStore.getState()).find((s) => s.id === withImage.id)!.edits![withImage.clipId][img.id].media).toMatchObject({ source: 'placeholder', style: 'topo' })
  })

  it('list shaders as live', () => {
    const r = runCommand('list_treatments', { surface: 'fill' }) as { treatments: { id: string; live?: boolean }[] }
    expect(r.treatments.filter((t) => t.live).map((t) => t.id)).toEqual([...SHADER_IDS])
    expect(clampParams(SHADERS['god-rays'].params, { from: 9 }).from).toBe(1)
  })
})
