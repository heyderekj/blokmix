import type { LinkTarget, BlockEdit, BlockMotion, BlockStyle, MediaFill, SectionSpacing } from '@/core/types'
import { detectLink } from '@/core/media'
import { ICON_NAMES, blockIconName } from '@/core/icons'
import { type CommandInput } from '@/core/commands/schema'
import { variantsFor } from '@/core/blocks/variants'
import { resolveGuide } from '@/core/guide'
import { slotClip } from '@/data/library'
import { sectionLinks } from '@/core/links'
import { useStore } from '../store'
import { CommandError, findSection, findBlock, wordsFor, describeSection, clean, styleFrom, linkScopeFor } from './refs'
import { isFillId } from '@/core/treatments'
import { treatmentFrom } from './treatments'

/** Changing one block (or every block of a kind): looks, style, spacing, media, icons, motion, links, banners. */
export const write = {
  set_block: (i: CommandInput<'set_block'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    const st = useStore.getState()
    if (i.reset) st.editBlock(slot.id, b.id, null)
    const patch: Partial<BlockEdit> = {}
    if (i.look !== undefined) {
      if (i.look !== null && !variantsFor(b.kind).some((v) => v.id === i.look))
        throw new CommandError(`No look "${i.look}" for a ${b.kind}. Looks: ${variantsFor(b.kind).map((v) => v.id).join(', ') || 'none'}`)
      patch.variant = i.look ?? undefined
    }
    const style = styleFrom(i.style)
    if (style) patch.style = style
    if (i.motion) patch.motion = Object.fromEntries(Object.entries(i.motion).map(([k, v]) => [k, v === null || v === 'normal' ? undefined : v])) as Partial<BlockMotion>
    if (i.hidden !== undefined) patch.hidden = i.hidden || undefined
    if (i.mobile === null) patch.mobile = undefined
    else if (i.mobile) patch.mobile = { ...(i.mobile.style ? { style: styleFrom(i.mobile.style) } : {}), ...(i.mobile.hidden !== undefined ? { hidden: i.mobile.hidden } : {}) }
    if (Object.keys(patch).length) st.editBlock(slot.id, b.id, patch)
    return describeSection(findSection(slot.id), 0).blocks.find((x) => x.id === b.id)
  },
  use_look_for_all: (i: CommandInput<'use_look_for_all'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (!slot.edits?.[slot.clipId]?.[b.id]) throw new CommandError(`${b.label} has no changes to share yet`)
    useStore.getState().promoteBlock(slot.id, b.id)
    return { kind: b.kind, lookForAll: useStore.getState().guide.components?.[b.kind] }
  },
  set_look_for_all: (i: CommandInput<'set_look_for_all'>) => {
    const st = useStore.getState()
    if (i.clear) {
      st.clearComponent(i.kind)
      return { kind: i.kind, lookForAll: null }
    }
    if (i.look && !variantsFor(i.kind).some((v) => v.id === i.look)) throw new CommandError(`No look "${i.look}" for a ${i.kind}`)
    const cur = st.guide.components?.[i.kind] ?? {}
    const style = { ...cur.style, ...styleFrom(i.style) }
    for (const k of Object.keys(style) as (keyof BlockStyle)[]) if (style[k] === undefined) delete style[k]
    const next = { variant: i.look === undefined ? cur.variant : (i.look ?? undefined), style: Object.keys(style).length ? style : undefined }
    useStore.setState((s) => ({ guide: { ...s.guide, components: { ...s.guide.components, [i.kind]: next } } }))
    return { kind: i.kind, lookForAll: next }
  },
  set_section_spacing: (i: CommandInput<'set_section_spacing'>) => {
    const slot = findSection(i.section)
    const patch: Partial<SectionSpacing> = clean({ top: i.top, bottom: i.bottom })
    // Only the sides you name change on phones; null (for one side or all) follows desktop again.
    if (i.mobile !== undefined) patch.mobile = i.mobile === null ? { top: undefined, bottom: undefined } : Object.fromEntries(Object.entries(i.mobile).map(([k, v]) => [k, v ?? undefined]))
    useStore.getState().setSectionSpacing(slot.id, patch)
    return { spacing: findSection(slot.id).spacing ?? {} }
  },
  set_text_style: (i: CommandInput<'set_text_style'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (i.style === undefined && i.size === undefined) throw new CommandError('Give a style, a size, or both.')
    const style: Partial<BlockStyle> = {}
    if (i.style !== undefined) style.text = i.style ?? undefined
    if (i.size !== undefined) style.size = i.size ?? undefined
    useStore.getState().editBlock(slot.id, b.id, { style: style as BlockStyle })
    const now = findSection(slot.id).edits?.[slotClip(findSection(slot.id)).id]?.[b.id]?.style
    return { block: b.label, style: now?.text ?? 'automatic', size: now?.size ?? null }
  },
  set_section_width: (i: CommandInput<'set_section_width'>) => {
    const slot = findSection(i.section)
    useStore.getState().setSectionWidth(slot.id, i.width)
    return { section: slot.id, width: findSection(slot.id).width ?? 'standard' }
  },
  set_section_surface: (i: CommandInput<'set_section_surface'>) => {
    const slot = findSection(i.section)
    useStore.getState().setSurface(slot.id, i.surface)
    return { section: slot.id, surface: findSection(slot.id).surface ?? useStore.getState().guide.sections?.[slot.type]?.surface ?? 'page' }
  },
  set_image: (i: CommandInput<'set_image'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block. Image blocks: ${slotClip(slot).blocks.filter((x) => x.kind === 'image').map((x) => x.label).join('; ') || 'none'}`)
    const st = useStore.getState()
    if (i.remove) {
      st.editBlock(slot.id, b.id, { media: undefined })
      return { block: b.label, media: null }
    }
    const cur = slot.edits?.[slot.clipId]?.[b.id]?.media
    if (i.shader && i.placeholder) throw new CommandError('Give a placeholder or a shader, not both')
    // A live shader: its dials and preset checked like any treatment's.
    const shader = i.shader ?? (!i.placeholder && cur?.source === 'shader' ? cur.shader : undefined)
    if (shader) {
      const was = cur?.source === 'shader' && cur.shader ? { id: cur.shader, params: cur.params, seed: cur.seed } : undefined
      const v = treatmentFrom('fill', shader, { preset: i.preset, params: i.params, seed: i.seed }, was)
      const next: MediaFill = { source: 'shader', shader: v.id, params: v.params, seed: v.seed ?? 1, alt: i.alt ?? cur?.alt, fit: i.fit ?? cur?.fit, lightbox: cur?.lightbox }
      st.editBlock(slot.id, b.id, { media: next })
      return { block: b.label, media: next }
    }
    if (i.preset) throw new CommandError('Presets are for shaders here; generative placeholders take params')
    const style = i.placeholder ?? (cur?.source === 'placeholder' ? cur.style : undefined)
    // Generative placeholders take dials, checked against their spec.
    const params =
      style && isFillId(style) && (i.params || cur?.params)
        ? treatmentFrom('fill', style, { params: i.params }, cur?.source === 'placeholder' && cur.style === style ? { id: style, params: cur.params } : undefined).params
        : undefined
    if (i.params && !(style && isFillId(style))) throw new CommandError('Only the generative placeholders have dials (grain-gradient, dither, halftone, topo, flow, blocks, ascii, op-art, marble)')
    const next: MediaFill = i.placeholder
      ? { source: 'placeholder', style: i.placeholder, seed: i.seed ?? 1, params, alt: i.alt ?? cur?.alt, fit: i.fit ?? cur?.fit }
      : cur
        ? { ...cur, ...(i.alt !== undefined ? { alt: i.alt || undefined } : {}), ...(i.fit ? { fit: i.fit } : {}), ...(i.seed !== undefined && (cur.source === 'placeholder' || cur.source === 'mock') ? { seed: i.seed } : {}), ...(i.params ? { params } : {}), ...(i.focus !== undefined ? { focus: i.focus ?? undefined } : {}) }
        : (() => {
            throw new CommandError('Give a placeholder style, or set a picture first')
          })()
    st.editBlock(slot.id, b.id, { media: next })
    return { block: b.label, media: next }
  },
  set_media: (i: CommandInput<'set_media'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block; media goes in image blocks`)
    const cur = slot.edits?.[slot.clipId]?.[b.id]?.media
    let next: MediaFill
    if (i.url) {
      const found = detectLink(i.url)
      if (!found) throw new CommandError('That link isn’t a video file (.mp4, .webm), a Lottie (.lottie, .json), or a YouTube/Vimeo page')
      next = { source: found.source, link: found.link, play: found.source === 'embed' ? 'click' : 'inview', loop: found.source !== 'embed', lightbox: found.source === 'embed', alt: cur?.alt }
    } else if (cur && (cur.source === 'video' || cur.source === 'lottie' || cur.source === 'embed' || i.lightbox !== undefined || i.alt !== undefined)) next = { ...cur }
    else throw new CommandError('Give a url, or put a video or animation in this block first')
    if (i.play) {
      if (i.play === 'scrub' && next.source !== 'lottie') throw new CommandError('Only Lottie animations can follow the scroll')
      if (next.source === 'embed' && i.play !== 'click') throw new CommandError('Embeds play on click (their player loads only when asked)')
      next.play = i.play
    }
    if (i.loop !== undefined) next.loop = i.loop
    if (i.lightbox !== undefined) next.lightbox = i.lightbox
    if (i.alt !== undefined) next.alt = i.alt || undefined
    if (i.thumbnail !== undefined) next.poster = i.thumbnail ?? undefined
    useStore.getState().editBlock(slot.id, b.id, { media: next })
    return { block: b.label, media: next }
  },
  set_icon: (i: CommandInput<'set_icon'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'icon') throw new CommandError(`${b.label} isn’t an icon block`)
    if (i.name && !ICON_NAMES.includes(i.name)) throw new CommandError(`No icon "${i.name}". Icons: ${ICON_NAMES.join(', ')}`)
    useStore.getState().editBlock(slot.id, b.id, { icon: i.name ?? undefined })
    return { block: b.label, icon: i.name ?? blockIconName(slotClip(slot).html, b.id) ?? null, set: resolveGuide(useStore.getState().guide).tokens['icon.set'] }
  },
  set_section_motion: (i: CommandInput<'set_section_motion'>) => {
    const slot = findSection(i.section)
    useStore
      .getState()
      .setSectionMotion(slot.id, i.mode === 'captured' ? null : i.mode === 'none' ? { mode: 'none' } : { mode: 'preset', enter: i.enter ?? 'rise', stagger: i.stagger, onScroll: i.on_scroll, speed: i.speed === 'normal' ? undefined : i.speed })
    return { motion: findSection(slot.id).motion ?? { mode: 'captured' } }
  },
  set_link: (i: CommandInput<'set_link'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (!b.linkable) throw new CommandError(`${b.label} isn’t a link or button. Links here: ${slotClip(slot).blocks.filter((x) => x.linkable).map((x) => x.label).join('; ') || 'none'}`)
    let link: LinkTarget | undefined
    switch (i.to) {
      case 'section':
        link = { to: 'section', slotId: findSection(i.target ?? '').id }
        break
      case 'page':
        if (!i.target) throw new CommandError('Say which page, e.g. "/about".')
        link = { to: 'page', path: i.target.startsWith('/') ? i.target : `/${i.target}` }
        break
      case 'url':
        if (!i.target) throw new CommandError('Say which web address.')
        link = { to: 'url', url: i.target, newTab: i.new_tab ?? true }
        break
      case 'email':
        link = { to: 'email', address: i.target ?? '' }
        break
      case 'phone':
        link = { to: 'phone', number: i.target ?? '' }
        break
      case 'none':
        link = { to: 'none' }
        break
      case 'auto':
        link = undefined
    }
    useStore.getState().editBlock(slot.id, b.id, { link })
    const live = findSection(slot.id)
    const l = sectionLinks(slotClip(live).blocks, live.edits?.[live.clipId], wordsFor(live), linkScopeFor(live.id), live.id)[b.id]
    return { block: b.label, href: l.href, newTab: l.newTab, auto: l.auto }
  },
  set_slider: (i: CommandInput<'set_slider'>) => {
    const slot = findSection(i.section)
    const options = slotClip(slot).slider
    if (!options) throw new CommandError('That section isn’t a slider.')
    const check = (name: string, value: string | number | undefined, allowed: readonly (string | number)[] | undefined) => {
      if (value !== undefined && !allowed?.includes(value)) throw new CommandError(`${name} can be: ${(allowed ?? []).join(', ') || 'nothing on this layout'}`)
    }
    check('slide', i.slide, options.slide?.map((o) => o.id))
    check('show', i.show, options.show)
    check('intro', i.intro, options.intro?.map((o) => o.id))
    useStore.getState().setSlider(slot.id, { ...(i.slide ? { slide: i.slide } : {}), ...(i.show ? { show: i.show } : {}), ...(i.intro ? { intro: i.intro } : {}) })
    return { slider: findSection(slot.id).slider ?? {}, options }
  },
  add_block: (i: CommandInput<'add_block'>) => {
    const slot = findSection(i.section)
    const after = findBlock(slot, i.after)
    const id = useStore.getState().addBlock(slot.id, i.kind, after.id)
    if (!id) throw new CommandError('That blok can’t go there. Try after a block outside a list, or after one inside an item.')
    const live = findSection(slot.id)
    const added = slotClip(live).blocks.find((b) => b.id === id)
    if (i.text && added?.field && i.kind !== 'image' && i.kind !== 'icon') {
      // In every item, the words go in each item's own field.
      for (const f of Object.keys(slotClip(live).fields).filter((f) => f === added.field || (added.field && f.replace(/\d+/, '#') === added.field.replace(/\d+/, '#'))))
        useStore.getState().setWord(slot.id, f, i.text)
    }
    const now = slotClip(findSection(slot.id))
    return { block: id, label: now.blocks.find((b) => b.id === id)?.label ?? id, field: added?.field ?? null, words: wordsFor(findSection(slot.id)) }
  },
  set_banner: (i: CommandInput<'set_banner'>) => {
    const slot = findSection(i.section)
    if (slot.type !== 'nav') throw new CommandError('Banners go on navs. Pick the nav section.')
    useStore.getState().setBanner(slot.id, i.on)
    const banner = slotClip(findSection(slot.id)).blocks.find((b) => b.kind === 'banner')
    const hidden = banner ? !!findSection(slot.id).edits?.[slot.clipId]?.[banner.id]?.hidden : true
    return { banner: !hidden && banner ? { block: banner.id, label: banner.label } : null }
  },
}
