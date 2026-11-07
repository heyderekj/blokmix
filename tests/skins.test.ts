import { describe, expect, it } from 'vitest'
import { applySkin, closestSkin, contrastFailures, dressOldGuide, dressSavedMix, parseSkin, RETIRED_SKINS, skinById, skinList, skinRefOf, skinTokens, surpriseMe, type Skin } from '@/core/skins'
import { FEEL_WORDS, themesFor } from '@/core/feel'
import { VARIANTS } from '@/core/blocks/variants'
import { TEXT_STYLES } from '@/core/textStyles'
import { areasOfCommand, cleanContract, contractMarkdown, contractRefusal, emptyContract, type Contract } from '@/core/contract'
import { pictureFor, withSectionDefaults } from '@/core/sectionDefaults'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { snapshotKey } from '@/core/versions'
import { BARE_TYPES, lintBones } from '@/core/lint'
import { allFonts } from '@/core/library'
import { BASE_FONTS, fontsForTokens } from '@/core/tokens'
import { DEFAULT_KEEP, type GuideState, type SectionType, type Site, type TokenKey, type Slot, type VersionNode } from '@/core/types'
import { DEFAULT_CONTENT } from '@/core/content'
import { siteFromSlots } from '@/core/site'
import { packetFiles } from '@/core/export/packet'
import { composeSite } from '@/core/compose'
import { referenceHtml } from '@/core/export/reference-html'
import { library } from '@/data/library'
import { defaultFor } from '@/core/blocks/style'
import { sectionTokens, SURFACES, surfaceTokens } from '@/core/surface'
import { BACKDROP_IDS, backdropCss, backdropInfo, readBackdrop } from '@/core/treatments'
import { paletteFrom } from '@/core/palette'
import { BASE_TOKENS, contrastRatio } from '@/core/tokens'
import { ICON_SETS } from '@/core/icons'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'

const skin = (over: Partial<Skin> = {}): Skin => ({ id: 'test', name: 'Test', words: '', tier: 'free', mode: 'light', feel: [], tokens: { 'color.primary': '#112233', 'radius.base': '3px', 'font.display': "'Fraunces', serif" }, ...over })
const contract = (areas: Contract['areas'], more: Partial<Contract> = {}): Contract => ({ ...emptyContract(), areas, ...more })
const withCandidate = (): GuideState => ({
  ...emptyGuide(),
  candidates: [{ id: 'c#color', clipId: 'c', group: 'color', values: { 'color.primary': '#ff0000' }, promotedAt: 1 }],
})

describe('applySkin', () => {
  it('wins over a clipped candidate, which stays on offer', () => {
    const guide = withCandidate()
    expect(resolveGuide(guide).tokens['color.primary']).toBe('#ff0000')
    const next = applySkin(guide, skin())
    expect(resolveGuide(next).tokens['color.primary']).toBe('#112233')
    expect(next.candidates).toHaveLength(1)
  })

  it('leaves what the contract keeps exactly as it resolves', () => {
    const guide = withCandidate()
    const next = applySkin(guide, skin(), contract({ color: 'keep' }))
    const t = resolveGuide(next).tokens
    expect(t['color.primary']).toBe('#ff0000')
    expect(t['radius.base']).toBe('3px')
    expect(next.skin).toEqual({ id: 'test', name: 'Test' })
  })

  it('keeps swatches, so x: color refs stay defined', () => {
    const guide = { ...emptyGuide(), swatches: [{ id: 's', name: 'Brand', value: '#123456' }] }
    expect(applySkin(guide, skin()).swatches).toEqual(guide.swatches)
  })

  it('replaces looks, sections and pictures unless they are kept', () => {
    const before: GuideState = { ...emptyGuide(), components: { button: { variant: 'ghost' } }, sections: { hero: { surface: 'soft' } }, picture: { style: 'mesh' } }
    const on = skin({ components: { button: { variant: 'pill' } }, sections: { hero: { surface: 'brand' } }, picture: { style: 'arch' } })
    const swapped = applySkin(before, on)
    expect(swapped.components?.button?.variant).toBe('pill')
    expect(swapped.sections?.hero?.surface).toBe('brand')
    expect(swapped.picture?.style).toBe('arch')
    const held = applySkin(before, on, contract({ looks: 'keep', sections: 'keep', pictures: 'keep' }))
    expect(held.components?.button?.variant).toBe('ghost')
    expect(held.sections?.hero?.surface).toBe('soft')
    expect(held.picture?.style).toBe('mesh')
  })

  it('drops what the last skin set when the next has none', () => {
    const on = applySkin(emptyGuide(), skin({ components: { button: { variant: 'pill' } } }))
    const off = applySkin(on, skin())
    expect(off.components).toBeUndefined()
    expect('components' in off).toBe(false)
  })
})

describe('surpriseMe', () => {
  const pool = () => skinList()

  it('rolls only what the contract marks Surprise', () => {
    const guide = applySkin(emptyGuide(), skinById('studio')!)
    const before = resolveGuide(guide).tokens
    const out = surpriseMe(guide, contract({ type: 'surprise' }), 3, pool())!
    const after = resolveGuide(out.guide).tokens
    expect(out.picks.map((p) => p.area)).toEqual(['type'])
    expect(after['color.primary']).toBe(before['color.primary'])
    expect(after['radius.base']).toBe(before['radius.base'])
    expect(after['font.display']).toBe(skinTokens(out.picks[0].skin)['font.display'])
    expect(out.words).toMatch(/^Type from /)
  })

  it('never touches a kept area when nothing is marked', () => {
    const guide = applySkin(emptyGuide(), skinById('studio')!)
    const out = surpriseMe(guide, contract({ color: 'keep' }), 9, pool())!
    expect(out.picks.map((p) => p.area)).not.toContain('color')
    expect(resolveGuide(out.guide).tokens['color.primary']).toBe(resolveGuide(guide).tokens['color.primary'])
  })

  it('has nothing to do when every style area is kept', () => {
    const areas = Object.fromEntries(['color', 'type', 'shape', 'space', 'motion', 'looks', 'sections', 'pictures'].map((a) => [a, 'keep'])) as Contract['areas']
    expect(surpriseMe(emptyGuide(), contract(areas), 1, pool())).toBeNull()
  })
})

describe('section defaults', () => {
  const base = { keep: { ...DEFAULT_KEEP } } as Pick<Slot, 'keep' | 'surface' | 'backdrop' | 'motion' | 'spacing'>
  const sections: GuideState['sections'] = { hero: { surface: 'brand', backdrop: { id: 'dots' }, motion: { mode: 'preset', enter: 'rise' }, spacing: { top: 'roomy' } } }

  it('sit under what the section chose', () => {
    const shown = withSectionDefaults(base, 'hero', sections, false)
    expect(shown.surface).toBe('brand')
    expect(shown.backdrop?.id).toBe('dots')
    expect(shown.motion?.mode).toBe('preset')
    expect(shown.spacing?.top).toBe('roomy')
    const mine = withSectionDefaults({ ...base, surface: 'page', spacing: { top: 'none' } }, 'hero', sections, false)
    expect(mine.surface).toBe('page')
    expect(mine.spacing?.top).toBe('none')
  })

  it('stay out of a section keeping its own look', () => {
    const own = { ...base, keep: { ...DEFAULT_KEEP, style: true } }
    expect(withSectionDefaults(own, 'hero', sections, false).surface).toBeUndefined()
  })

  it('leave a clip’s own motion alone', () => {
    expect(withSectionDefaults(base, 'hero', sections, true).motion).toBeUndefined()
  })

  it('let a section turn the backdrop off', () => {
    expect(withSectionDefaults({ ...base, backdrop: { id: 'none' } }, 'hero', sections, false).backdrop).toBeUndefined()
  })

  it('fill empty pictures in layouts only', () => {
    const b = { id: 'b1', kind: 'image' as const }
    const fill = pictureFor(undefined, b, { style: 'arch' }, 'layout', false)
    expect(fill).toMatchObject({ source: 'placeholder', style: 'arch' })
    expect(pictureFor(undefined, b, { style: 'arch' }, 'clip', false)).toBeUndefined()
    expect(pictureFor(undefined, b, { style: 'arch' }, 'layout', true)).toBeUndefined()
    expect(pictureFor(undefined, { ...b, media: 'logo' }, { style: 'arch' }, 'layout', false)).toBeUndefined()
    expect(pictureFor(undefined, { ...b, media: 'cover', field: 'brand' }, { style: 'arch' }, 'layout', false)).toBeUndefined()
    const own = { source: 'stock' as const }
    expect(pictureFor(own, b, { style: 'arch' }, 'layout', false)).toBe(own)
  })

  it('reach the export', () => {
    const slot: Slot = { id: 's', type: 'hero', clipId: 'hero.layout-split', locked: false, keep: { ...DEFAULT_KEEP } }
    const guide = applySkin(emptyGuide(), skin({ sections: { hero: { surface: 'brand' } }, picture: { style: 'arch' } }))
    const page = composeSite({ site: siteFromSlots([slot]), guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })
    const hero = page.sections[0]
    expect(hero.media.length).toBeGreaterThan(0)
    // The band's tokens only reach the section if its root carries the class they're scoped to.
    expect(referenceHtml(page)).toMatch(/class="[^"]*mx-s1\b/)
    expect(hero.css).toContain(`--mx-color-bg: ${resolveGuide(guide).tokens['color.primary']}`)
  })
})

describe('the skins themselves', () => {
  it('load, eight of them, starting from Wireframe', () => {
    expect(skinList().map((s) => s.id).sort()).toEqual(['afterhours', 'dreampop', 'flyer', 'liner-notes', 'lofi', 'studio', 'vinyl', 'wireframe'])
    expect(skinList()[0].id).toBe('wireframe')
  })

  it('still answer to the ids of the themes folded into them, by today’s name', () => {
    for (const [old, now] of Object.entries(RETIRED_SKINS)) {
      expect(skinById(now), now).toBeTruthy()
      expect(skinById(old)?.id, old).toBe(now)
    }
    expect(skinRefOf({ id: 'calm', name: 'Calm' })).toEqual({ id: 'studio', name: 'Studio' })
    expect(skinRefOf({ id: 'own', name: 'Your own' })).toEqual({ id: 'own', name: 'Your own' })
  })

  // What every theme but the sketch decides, so none is a palette swap of another.
  it.each(skinList().filter((s) => s.id !== 'wireframe').map((s) => s.id))('%s is a whole look: colors, type, block looks, bands and pictures', (id) => {
    const s = skinById(id)!
    for (const k of ['color.bg', 'color.surface', 'color.text', 'color.muted', 'color.border', 'color.primary', 'color.onPrimary', 'color.accent', 'font.display', 'font.body', 'font.mono', 'icon.set'] as const)
      expect(s.tokens[k], `${id} ${k}`).toBeTruthy()
    expect(Object.keys(s.textStyles?.label ?? {}).length, `${id} label`).toBeGreaterThan(0)
    // Layouts size the headline to the window (clamp with vw); a Display style would fix it at one size everywhere.
    expect(s.textStyles?.display, `${id} display`).toBeUndefined()
    for (const style of Object.keys(s.textStyles ?? {})) expect(TEXT_STYLES, `${id} ${style}`).toContain(style)
    const has = (kind: 'badge' | 'card' | 'icon' | 'button', v?: string) => !!v && (VARIANTS[kind] ?? []).some((x) => x.id === v)
    expect(has('badge', s.components?.badge?.variant), `${id} badge`).toBe(true)
    expect(has('card', s.components?.card?.variant), `${id} card`).toBe(true)
    expect(has('icon', s.components?.icon?.variant), `${id} icon`).toBe(true)
    expect(has('button', s.components?.button?.secondary?.variant), `${id} quieter button`).toBe(true)
    expect(Object.values(s.sections ?? {}).some((d) => d.surface || d.backdrop), `${id} band or backdrop`).toBe(true)
    expect(s.picture?.style, `${id} picture`).toBeTruthy()
    expect(s.words.length, `${id} words`).toBeGreaterThan(0)
  })

  it('cover every feel word, and dark twice', () => {
    for (const w of FEEL_WORDS) expect(skinList().filter((s) => s.feel.includes(w)).length, w).toBeGreaterThanOrEqual(w === 'dark' ? 2 : 1)
    expect(themesFor(['dark'], skinList()).slice(0, 2).every((s) => s.mode === 'dark')).toBe(true)
  })

  it.each(skinList().map((s) => s.id))('%s reads at AA', (id) => {
    expect(contrastFailures(skinTokens(skinById(id)!))).toEqual([])
  })

  it.each(skinList().map((s) => s.id))('%s has fonts the library can load', (id) => {
    const t = skinTokens(skinById(id)!)
    const fonts = fontsForTokens(t, [...allFonts(library), ...BASE_FONTS]).map((f) => f.family)
    for (const key of ['font.display', 'font.body'] as const) {
      const family = t[key].split(',')[0].replace(/['"]/g, '').trim()
      expect(fonts, `${id}: ${family}`).toContain(family)
    }
  })

  it.each(skinList().map((s) => s.id))('%s draws icons that read: a colored glyph 3:1 on its page, an icon set it has', (id) => {
    const skin = skinById(id)!
    const t = skinTokens(skin)
    const ink = { tinted: 'color.primary', tile: 'color.primary', accent: 'color.accent' }[skin.components?.icon?.variant ?? ''] as TokenKey | undefined
    if (ink) expect(contrastRatio(t[ink], t['color.bg']), `${id} ${ink}`).toBeGreaterThanOrEqual(3)
    expect(ICON_SETS.map((s) => s.id), id).toContain(t['icon.set'])
  })

  it('box icons only where the skin asks for it', () => {
    const boxed = skinList().filter((s) => !['bare', 'tinted', undefined].includes(s.components?.icon?.variant)).map((s) => s.id)
    expect(boxed.length).toBeLessThanOrEqual(3)
  })

  it('keep one main action: a skin that fills buttons says what the quieter ones do', () => {
    for (const s of skinList()) {
      const b = s.components?.button
      if (b?.variant) expect(b.secondary?.variant, s.id).toBeTruthy()
    }
  })

  it('tell a quieter button from the main one', () => {
    const blocks = library.clips['hero.layout-split'].blocks.filter((b) => b.kind === 'button')
    expect(blocks.map((b) => !!b.secondary)).toEqual([false, true])
    const components = { button: { variant: 'caps', secondary: { variant: 'outline' } } }
    expect(defaultFor(components, blocks[0])?.variant).toBe('caps')
    expect(defaultFor(components, blocks[1])?.variant).toBe('outline')
    expect(defaultFor({ button: { variant: 'ghost' } }, blocks[1])?.variant).toBe('ghost')
  })

  it.each(skinList().map((s) => s.id))('%s reads on the bands it uses', (id) => {
    const skin = skinById(id)!
    const t = skinTokens(skin)
    for (const def of Object.values(skin.sections ?? {})) {
      if (def.surface) expect(contrastFailures(surfaceTokens(t, def.surface)), `${id} ${def.surface}`).toEqual([])
    }
  })

  it('keeps words readable on every skin, band and backdrop, with any brand color', () => {
    const palettes = [...skinList().map((s) => skinTokens(s)), { ...skinTokens(skinById('wireframe')!), ...paletteFrom('#e2508d', 'light') }, { ...skinTokens(skinById('wireframe')!), ...paletteFrom('#3dff8f', 'dark') }]
    // Thin patterns never change what's behind words unless they fill, so only their fills need checking.
    const thin = ['grain', 'dots', 'grid', 'lines', 'topo']
    const backdrops = BACKDROP_IDS.flatMap((id) => {
      const presets = backdropInfo(id).presets.filter((p) => !thin.includes(id) || p.values.fill)
      return [...(thin.includes(id) ? [] : [{ id }]), ...presets.map((p) => ({ id, params: p.values }))]
    })
    const bad: string[] = []
    palettes.forEach((t, n) => {
      for (const surface of SURFACES) {
        const slot = { surface }
        const band = surfaceTokens(t, surface)
        if ((contrastRatio(band['color.muted'], band['color.bg']) ?? 0) < 4.5) bad.push(`${n} ${surface}: muted on band`)
        if ((contrastRatio(band['color.onPrimary'], band['color.primary']) ?? 0) < 4.5) bad.push(`${n} ${surface}: button label`)
        for (const backdrop of backdrops) {
          const shown = sectionTokens(t, { ...slot, backdrop })
          const { behind } = readBackdrop(backdrop, band)
          for (const c of behind) {
            if ((contrastRatio(shown['color.text'], c) ?? 0) < 4.5) bad.push(`${n} ${surface} ${backdrop.id}: text ${shown['color.text']} on ${c}`)
            if ((contrastRatio(shown['color.muted'], c) ?? 0) < 4.5) bad.push(`${n} ${surface} ${backdrop.id}: muted ${shown['color.muted']} on ${c}`)
          }
          if ((contrastRatio(shown['color.onPrimary'], shown['color.primary']) ?? 0) < 4.5) bad.push(`${n} ${surface} ${backdrop.id}: button ${shown['color.onPrimary']} on ${shown['color.primary']}`)
        }
      }
    })
    expect(bad.slice(0, 12), `${bad.length} failures`).toEqual([])
  }, 60_000)

  it('turns text light over a dark fill, and paints the backdrop in fixed colors then', () => {
    const t = skinTokens(skinById('wireframe')!)
    const blueprint = { id: 'grid', params: { gap: 32, strength: 18, color: 'onPrimary', fill: true, base: 'primary' } }
    expect(readBackdrop(blueprint, t).ink).toBeTruthy()
    expect(sectionTokens(t, { backdrop: blueprint })['color.text']).not.toBe(t['color.text'])
    const css = backdropCss(blueprint, t, '.x', true)
    expect(css).toContain(t['color.primary'])
    expect(css).not.toContain('var(--mx-color')
  })

  it('places a backdrop on its own fading layer, leaving the section its color', () => {
    const t = skinTokens(skinById('wireframe')!)
    const whole = backdropCss({ id: 'dots' }, t, '.x')
    expect(whole).not.toContain('::before')
    const top = backdropCss({ id: 'dots', params: { anchor: 'top', reach: 60 } }, t, '.x')
    expect(top).toContain('.x::before')
    expect(top).toContain('mask-image: linear-gradient(to bottom, #000 0, transparent 60%)')
    expect(top).toContain('position: relative')
    const corner = backdropCss({ id: 'orb', params: { anchor: 'bottom-left', reach: 80 } }, t, '.x')
    expect(corner).toContain('at 0% 100%')
    const live = backdropCss({ id: 'mesh-gradient', params: { anchor: 'right', reach: 80 } }, t, '.x')
    expect(live).toMatch(/\.x > \.mx-backdrop \{ opacity: [\d.]+; mask-image: linear-gradient\(to left/)
  })

  it('softens a placed backdrop less than one behind every word', () => {
    const t = skinTokens(skinById('wireframe')!)
    const strength = (params: Record<string, unknown>) => (readBackdrop({ id: 'stripes', params: params as never }, t).value.params?.strength as number) ?? 100
    expect(strength({ strength: 100, anchor: 'right', reach: 50 })).toBeGreaterThan(strength({ strength: 100 }))
  })

  it('softens a backdrop nothing could read over', () => {
    const t = skinTokens(skinById('wireframe')!)
    const stripes = { id: 'stripes', params: { strength: 100 } }
    const read = readBackdrop(stripes, t)
    expect(read.softened).toBe(true)
    expect(read.value.params!.strength).toBeLessThan(100)
  })

  it('refuses a file with an unknown token or backdrop', () => {
    expect(() => parseSkin('x', { name: 'X', tokens: { 'color.nope': '#000' } })).toThrow(/unknown token/)
    expect(() => parseSkin('x', { name: 'X', sections: { hero: { backdrop: { id: 'nope' } } } })).toThrow(/backdrop/)
  })

  it('leaves at least two free skins beside Wireframe', () => {
    expect(skinList().filter((s) => s.tier === 'free' && s.id !== 'wireframe').length).toBeGreaterThanOrEqual(2)
  })
})

describe('the contract', () => {
  it('cleans what it reads', () => {
    expect(cleanContract({ areas: { color: 'keep', type: 'tweak', nope: 'keep', space: 'lol' }, keep: [' a ', 3, ''], surprise: 'x' })).toEqual({ areas: { color: 'keep' }, keep: ['a'], surprise: [] })
    expect(cleanContract(undefined)).toEqual(emptyContract())
  })

  it('refuses agent commands on kept areas, with why', () => {
    const c = contract({ color: 'keep', layout: 'keep', words: 'keep' })
    expect(contractRefusal(c, 'set_token', { key: 'color.primary', value: '#000' })).toMatch(/Keep for Color/)
    expect(contractRefusal(c, 'set_token', { key: 'radius.base', value: '2px' })).toBeNull()
    expect(contractRefusal(c, 'swap_section', {})).toMatch(/Layout/)
    expect(contractRefusal(c, 'set_words', {})).toMatch(/Words/)
    expect(contractRefusal(c, 'add_note', {})).toBeNull()
    expect(contractRefusal(undefined, 'set_token', { key: 'color.primary' })).toBeNull()
  })

  it('names only a look or style change on a block', () => {
    expect(areasOfCommand('set_block', { look: 'pill' })).toEqual(['looks'])
    expect(areasOfCommand('set_block', { hidden: true })).toEqual([])
  })

  it('writes the Markdown', () => {
    const md = contractMarkdown(contract({ color: 'keep', sections: 'surprise' }, { keep: ['The two-column hero'], surprise: ['The footer'] }), { name: 'Calm' })
    expect(md).toContain('## Always keep')
    expect(md).toContain('**Color**')
    expect(md).toContain('The two-column hero')
    expect(md).toContain('## Surprise me')
    expect(md).toContain('**Sections**')
    expect(md).toContain('The footer')
    expect(md).toContain('**Calm**')
    expect(contractMarkdown(undefined)).toContain('Don’t add surprises')
  })

  it('goes into the packet, and opens rule 1 only where it says Surprise', () => {
    const slot: Slot = { id: 's', type: 'hero', clipId: 'hero.layout-split', locked: false, keep: { ...DEFAULT_KEEP } }
    const guideState = applySkin(emptyGuide(), skinById('studio')!)
    const guide = resolveGuide(guideState)
    const input = { page: composeSite({ site: siteFromSlots([slot]), guide, content: DEFAULT_CONTENT, library, page: guideState }), guide, guideState, library, mixName: 'M', targets: ['astro' as const] }
    const plain = packetFiles(input)
    expect(plain['CONTRACT.md']).toContain('# Contract')
    expect(JSON.parse(plain['blokmix.json'] as string).skin.name).toBe('Studio')
    expect(plain['BLOKMIX.md']).not.toContain('marks Surprise')
    const open = packetFiles({ ...input, contract: contract({ color: 'surprise', type: 'keep' }) })
    expect(open['BLOKMIX.md']).toContain('CONTRACT.md marks Surprise (color)')
    expect(open['BLOKMIX.md']).toContain('Never change: type')
    expect(JSON.parse(open['blokmix.json'] as string).contract.areas).toEqual({ color: 'surprise', type: 'keep' })
  })
})

describe('versions see a skin', () => {
  it('counts a swap as a change, and an empty contract as none', () => {
    const site = siteFromSlots([])
    const a = { site, guide: emptyGuide(), content: DEFAULT_CONTENT }
    expect(snapshotKey(a)).toBe(snapshotKey({ ...a, contract: emptyContract() }))
    expect(snapshotKey(a)).not.toBe(snapshotKey({ ...a, guide: applySkin(a.guide, skin()) }))
    expect(snapshotKey(a)).not.toBe(snapshotKey({ ...a, contract: contract({ color: 'keep' }) }))
  })
})

describe('bare layouts', () => {
  const bare = Object.values(library.clips).filter((c) => c.origin === 'layout' && BARE_TYPES.includes(c.type as SectionType))
  it.each(bare.map((c) => c.id))('%s is bones only', (id) => {
    const c = library.clips[id]
    expect(lintBones({ html: c.html, css: c.css, motionCss: c.motionCss })).toEqual([])
  })

  const bones = (html: string, css: string) => lintBones({ html: `<section class="mx-x-y" data-mx-section="features">${html}</section>`, css: `.mx-x-y { ${css} }`, motionCss: null })
  it('leave an icon’s box to the skin and size it in em', () => {
    const ico = '<span class="ico" data-mx-block="icon"><svg data-mx-icon="star"></svg></span>'
    expect(bones(ico, '& .ico { font-size: var(--mx-text-lg); } & .ico svg { width: 1.25em; height: 1.25em; }')).toEqual([])
    expect(bones(ico, '& .ico { background: var(--mx-color-surface); }').join()).toMatch(/own box/)
    expect(bones(ico, '& .item:hover .ico { box-shadow: inset 0 0 0 var(--mx-stroke) var(--mx-color-border); }').join()).toMatch(/own box/)
    expect(bones(ico, '& .ico svg { width: 20px; }').join()).toMatch(/sized in px/)
  })
  it('keep one main action, one eyebrow per head and spacing on the scale', () => {
    expect(bones('<a class="btn primary"></a><a class="btn primary"></a>', '').join()).toMatch(/2 main buttons/)
    expect(bones('<header class="head"><p class="eyebrow"></p><span data-mx-block="badge"></span></header>', '').join()).toMatch(/more than one eyebrow/)
    expect(bones('<header class="head"><p class="eyebrow"></p></header><ul><li><span data-mx-block="badge"></span></li></ul>', '')).toEqual([])
    expect(bones('', '& .a { padding: 12px var(--mx-space-4); }').join()).toMatch(/off the spacing scale/)
    expect(bones('', '& .a { margin-top: 0; padding: var(--mx-space-4); border-top: 1px solid; gap: 2px; }')).toEqual([])
  })
})

describe('the commands', () => {
  it('take a few areas of the contract at a time, and refuse agents on kept ones', () => {
    runCommand('set_contract', { areas: { color: 'keep', type: 'surprise' }, keep: ['The two-column hero'] })
    expect(useStore.getState().contract).toMatchObject({ areas: { color: 'keep', type: 'surprise' }, keep: ['The two-column hero'] })
    expect(() => runCommand('set_token', { key: 'color.primary', value: '#000000' })).toThrow(/Keep for Color/)
    runCommand('set_token', { key: 'color.primary', value: '#000000' }, 'you')
    runCommand('set_contract', { areas: { color: 'tweak', type: 'tweak' }, keep: [] })
    expect(useStore.getState().contract).toEqual(emptyContract())
  })

  it('apply a skin as one undo step, leaving block edits alone', () => {
    const before = useStore.temporal.getState().pastStates.length
    runCommand('apply_skin', { skin: 'studio' })
    expect(useStore.getState().guide.skin?.id).toBe('studio')
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1)
    expect(() => runCommand('apply_skin', { skin: 'nope' })).toThrow(/No skin/)
  })
})

describe('mixes saved before skins', () => {
  it('finds each skin from its own values', () => {
    for (const s of skinList()) expect(closestSkin(skinTokens(s), skinList())?.id, s.id).toBe(s.id)
  })

  it('never calls a colorful mix a wireframe, and matches on tone and color', () => {
    const t = { ...BASE_TOKENS, 'color.bg': '#0b0d0e', 'color.text': '#e8f0ec', 'color.primary': '#44ff99', 'color.onPrimary': '#04140b' }
    expect(closestSkin(t, skinList())?.mode).toBe('dark')
    expect(closestSkin(BASE_TOKENS, skinList())?.id).not.toBe('wireframe')
  })

  it('adds only what it lacks, keeping its own values', () => {
    const old: GuideState = { ...emptyGuide(), choices: { 'color.primary': { kind: 'custom', value: '#123456' }, 'font.display': { kind: 'custom', value: "'Fraunces', serif" } }, components: { button: { variant: 'ghost' } } }
    const before = resolveGuide(old).tokens
    const out = dressOldGuide(old, skinList())
    expect(resolveGuide(out).tokens).toEqual(before)
    expect(out.skin).toBeTruthy()
    expect(out.components?.button?.variant).toBe('ghost')
    expect(dressOldGuide(old, skinList())).toEqual(out)
  })

  it('dresses a saved mix and its versions on opening, and leaves the rest alone', () => {
    const slot: Slot = { id: 's', type: 'hero', clipId: 'hero.layout-split', locked: false, keep: { ...DEFAULT_KEEP } }
    const site = siteFromSlots([slot])
    const snapshot = { site, guide: emptyGuide(), content: DEFAULT_CONTENT, slotNotes: {}, clipHashes: {} }
    const version = { id: 'v', letter: 'A', parentId: null, title: 'A', status: 'in-progress', createdAt: 1, kind: 'snapshot', snapshot } as VersionNode
    const state = (p: { guide: GuideState; site?: Site; versions?: Record<string, VersionNode> }) => dressSavedMix({ site, versions: {}, ...p }, library, skinList())
    const old = state({ guide: emptyGuide(), versions: { v: version } })
    expect(old.guide.skin?.id).toBeTruthy()
    expect(old.guide.skin?.id).not.toBe('wireframe')
    expect(old.versions!.v.snapshot.guide.skin).toEqual(old.guide.skin)
    const chosen = applySkin(emptyGuide(), skinById('wireframe')!)
    expect(state({ guide: chosen }).guide).toEqual(chosen)
    const empty = state({ guide: emptyGuide(), site: siteFromSlots([]) })
    expect(empty.guide.skin?.id).toBe('own')
    expect(empty.guide.components).toBeUndefined()
  })
})

describe('locking', () => {
  it('stops agents changing a section, but not leaving marks or the owner changing it', () => {
    const hero = useStore.getState().site.pages[0].slots.find((x) => x.type === 'hero')!
    useStore.getState().toggleLock(hero.id)
    expect(() => runCommand('set_section_surface', { section: hero.id, surface: 'soft' })).toThrow(/locked/)
    expect(() => runCommand('add_note', { section: hero.id, text: 'Love this', kind: 'keep' })).not.toThrow(/locked/)
    runCommand('set_section_surface', { section: hero.id, surface: 'soft' }, 'you')
    useStore.getState().toggleLock(hero.id)
    runCommand('set_section_surface', { section: hero.id, surface: 'page' })
  })
})

describe('sliders', () => {
  const sliders = ['hero.layout-slider', 'gallery.layout-slider', 'testimonials.layout-slider', 'logos.layout-slider']
  const rows = ['features.layout-carousel', 'team.layout-carousel', 'testimonials.layout-row', 'blog.layout-row', 'gallery.layout-filmstrip']
  const pageOf = (clipId: string, slider?: Slot['slider']) => {
    const slot: Slot = { id: 's', type: library.clips[clipId].type, clipId, locked: false, keep: { ...DEFAULT_KEEP }, ...(slider ? { slider } : {}) }
    const guide = emptyGuide()
    return composeSite({ site: siteFromSlots([slot]), guide: resolveGuide(guide), content: DEFAULT_CONTENT, library, page: guide })
  }

  it.each([...sliders, ...rows])('%s scrolls natively, with its slides in a list', (id) => {
    const { html } = library.clips[id]
    expect(html).toContain('data-slider-track')
    expect(html).toMatch(/data-slider-track[^>]*data-mx-list=|data-mx-list=[^>]*data-slider-track/)
    expect(html).not.toContain('type="radio"')
  })

  it.each(sliders)('%s says what can be arranged', (id) => {
    expect(library.clips[id].slider?.show?.length).toBeGreaterThan(1)
  })

  it('writes the choices to the section root, only when chosen', () => {
    const html = referenceHtml(pageOf('hero.layout-slider', { slide: 'over', show: 2, intro: 'above' }))
    expect(html).toMatch(/data-slide="over"/)
    expect(html).toMatch(/data-show="2"/)
    expect(html).toMatch(/data-intro="above"/)
    expect(referenceHtml(pageOf('hero.layout-slider'))).not.toMatch(/<section[^>]*data-show=/)
  })

  it('ships the script only with a slider, in every build', () => {
    const page = pageOf('hero.layout-slider')
    expect(page.sliding).toBe(true)
    expect(referenceHtml(page)).toContain('data-slider-next')
    const files = packetFiles({ page, guide: resolveGuide(emptyGuide()), guideState: emptyGuide(), library, mixName: 'M', targets: ['astro', 'next'] })
    expect(files['astro/public/mx-slider.js']).toBeTruthy()
    expect(files['next/public/mx-slider.js']).toBeTruthy()
    expect(pageOf('hero.layout-split').sliding).toBe(false)
  })

  it('takes only the options a layout offers', () => {
    const before = useStore.getState().site
    const page = useStore.getState().site.pages[0]
    const hero = page.slots.find((x) => x.type === 'hero')!
    const clipBefore = hero.clipId
    runCommand('swap_section', { section: hero.id, clip_id: 'hero.layout-slider' })
    runCommand('set_slider', { section: hero.id, slide: 'over', show: 2 })
    expect(useStore.getState().site.pages[0].slots.find((x) => x.id === hero.id)!.slider).toEqual({ slide: 'over', show: 2 })
    expect(() => runCommand('set_slider', { section: hero.id, slide: 'nope' })).toThrow(/slide can be/)
    useStore.setState({ site: before })
    expect(useStore.getState().site.pages[0].slots.find((x) => x.id === hero.id)!.clipId).toBe(clipBefore)
    expect(() => runCommand('set_slider', { section: hero.id, show: 2 })).toThrow(/isn.t a slider/)
  })
})
