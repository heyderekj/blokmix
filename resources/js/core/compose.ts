import type { BlockEdit, MediaFill, MediaPlay, SectionMotion, Clip, CssVars, FontSource, GuideState, Keep, Library, ProjectContent, ResolvedGuide, SectionType, Slot, TokenSet } from './types'
import { applyFields, attr, mapTree, parseHtml, type HEl, type HNode } from './html/parse'
import { blockCss, effectiveEdit, sectionSpacingCss, slug } from './blocks/style'
import { LAYER_ORDER } from './export/base-css'
import { motionCss as presetMotionCss } from './motion'
import { dataUrlBytes, placeholderSvg, renderMedia, sizeForRatio, stockCredit, type MediaRender, type UploadData } from './media'
import { resolveFields } from './content'
import { BASE_FONTS, expandTokens, fontsForTokens, varsToCss } from './tokens'
import { allFonts } from './library'

export interface ComposedSection {
  slotId: string
  position: number
  type: SectionType
  component: string
  clip: Clip
  keep: Keep
  tree: HNode[]
  /** Section CSS including local token overrides when the section keeps its own style. */
  css: string
  motionCss: string | null
  localVars: CssVars | null
  /** Block looks you changed: variant and style per block, for the packet. */
  blocks: { id: string; label: string; kind: string; edit: BlockEdit }[]
  /** The section's motion choice (absent = as clipped). */
  motion?: SectionMotion
  /** Pictures in its image blocks. */
  media: ComposedMedia[]
  retained: string[]
  notes: string[]
}

export interface ComposedMedia {
  blockId: string
  label: string
  source: MediaFill['source']
  kind: MediaRender['kind']
  poster: string | null
  /** The still inline, for the single-file reference build. */
  inlinePoster: string | null
  /** Embeds: the player URL, loaded on click. */
  player: string | null
  play: MediaPlay | null
  loop: boolean
  lightbox: boolean
  /** Path in the exported site (public/…), or the remote URL for stock. */
  src: string
  /** The same picture inline (data URI or URL), for the single-file reference build. */
  inline: string
  alt: string
  credit: string | null
}

export interface ComposedPage {
  title: string
  tokens: TokenSet
  vars: CssVars
  fonts: FontSource[]
  sections: ComposedSection[]
  /** Image files to write into the site's public folder. */
  mediaFiles: Record<string, string | Uint8Array>
  /** Some section has video, a Lottie, an embed or a lightbox: ship the media player. */
  moving: boolean
}

export interface ComposeInput {
  slots: Slot[]
  guide: ResolvedGuide
  content: ProjectContent
  library: Library
  slotNotes?: Record<string, string[]>
  title?: string
  /** Extra brand colours and page-wide block looks from the style guide. */
  page?: Pick<GuideState, 'swatches' | 'components'>
  /** Uploaded images by asset id (data URLs), from the browser's asset store. */
  uploads?: (id: string) => UploadData | undefined
}

const pascal = (s: string) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')

export function componentName(clip: Clip): string {
  const folder = clip.id.split('.')[1]
  return pascal(clip.type) + pascal(folder)
}

/** Everything the exporters, the packet and the reference build share. */
export function composePage(input: ComposeInput): ComposedPage {
  const catalog = [...allFonts(input.library), ...BASE_FONTS]
  const fonts = new Map<string, FontSource>()
  const addFonts = (t: TokenSet) => fontsForTokens(t, catalog).forEach((f) => fonts.set(f.family, f))
  addFonts(input.guide.tokens)

  const used = new Map<string, number>()
  const mediaFiles: Record<string, string | Uint8Array> = {}
  const sections: ComposedSection[] = []

  input.slots.forEach((slot, position) => {
    const clip = input.library.clips[slot.clipId]
    if (!clip) return
    let component = componentName(clip)
    const n = (used.get(component) ?? 0) + 1
    used.set(component, n)
    if (n > 1) component += n

    const { fields, retained } = resolveFields(clip.type, clip.fields, input.content, slot.keep.content, slot.words)

    // Blocks with a changed look get a class (unique to this section) that the block CSS targets.
    const edits = slot.edits?.[clip.id]
    const changed = clip.blocks
      .map((b) => ({ b, edit: effectiveEdit(edits?.[b.id], input.page?.components?.[b.kind]) }))
      .filter((x): x is { b: (typeof x)['b']; edit: BlockEdit } => !!x.edit)
    const blockClass = (id: string) => `mx-s${position + 1}-${id}`
    const preset = slot.motion?.mode === 'preset' ? slot.motion : undefined
    // Staggered sections animate their top-level blocks, so those need a class too.
    const staggered = preset?.stagger ? clip.blocks.filter((b) => !b.parent || clip.blocks.find((x) => x.id === b.parent)?.kind === 'list').map((b) => b.id) : []
    const changedIds = new Set([...changed.map((x) => x.b.id), ...staggered])
    let order = 0
    const spaced = !!sectionSpacingCss(slot.spacing, 'x') || !!preset
    const addClass = (el: HEl, cls: string): HEl => ({
      ...el,
      attrs: el.attrs.some(([k]) => k === 'class') ? el.attrs.map(([k, v]) => (k === 'class' ? [k, `${v} ${cls}`] : [k, v])) : [...el.attrs, ['class', cls]],
    })
    // Pictures and moving media: an element over the block's own art, which keeps its size and shape.
    const media: ComposedMedia[] = []
    for (const { b, edit } of changed) {
      if (b.kind !== 'image' || !edit.media) continue
      const fill = edit.media
      const r = renderMedia(fill, input.guide.tokens, b.ratio, input.uploads ?? (() => undefined))
      if (!r) continue
      const base = `media/s${position + 1}-${b.id}`
      let src = r.src
      let poster = r.poster
      if (fill.source === 'placeholder') {
        src = `/${base}.svg`
        mediaFiles[`${base}.svg`] = placeholderSvg(fill.style ?? 'mesh', fill.seed ?? 1, input.guide.tokens, b.ratio)
      } else if (fill.source === 'upload') {
        const file = dataUrlBytes(r.src)
        if (file) {
          src = `/${base}.${file.ext}`
          mediaFiles[`${base}.${file.ext}`] = file.bytes
        }
      } else if (fill.asset) {
        // An uploaded video or Lottie: the file itself, plus the video's still.
        const up = input.uploads?.(fill.asset)
        if (up?.bytes) {
          const ext = extFor(r.kind, up.mime)
          src = `/${base}.${ext}`
          mediaFiles[`${base}.${ext}`] = new Uint8Array(up.bytes)
        }
      }
      if (poster?.startsWith('data:')) {
        const still = dataUrlBytes(poster)
        if (still) {
          mediaFiles[`${base}-poster.${still.ext}`] = still.bytes
          poster = `/${base}-poster.${still.ext}`
        }
      }
      media.push({
        blockId: b.id,
        label: b.label,
        source: fill.source,
        kind: r.kind,
        src,
        inline: r.src,
        poster: poster ?? null,
        inlinePoster: r.poster ?? null,
        player: r.player ?? null,
        play: r.play ?? null,
        loop: r.loop ?? false,
        lightbox: !!r.lightbox,
        alt: r.alt,
        credit: fill.source === 'stock' && fill.stock ? stockCredit(fill.stock) : null,
      })
    }
    const mediaFor = new Map(media.map((m) => [m.blockId, m]))
    const marked = mapTree(parseHtml(clip.html), (el) => {
      if (spaced && attr(el, 'data-mx-section') !== undefined) return addClass(el, `mx-s${position + 1}`)
      if (attr(el, 'data-mx-block') === undefined) return el
      const id = `b${order++}`
      if (!changedIds.has(id)) return el
      const withClass = addClass(el, blockClass(id))
      const m = mediaFor.get(id)
      if (!m) return withClass
      const [w, h] = sizeForRatio(clip.blocks.find((x) => x.id === id)?.ratio, 1600)
      const block = m.lightbox ? { ...withClass, attrs: [...withClass.attrs, ['data-lightbox', ''] as [string, string]] } : withClass
      return { ...block, kids: [...block.kids, ...mediaElements(m, w, h)] }
    })
    const tree = applyFields(marked, fields)
    const blocksCss = blockCss({
      blocks: clip.blocks,
      edits,
      components: input.page?.components,
      select: (b) => `.${clip.rootClass}.${blockClass(b.id)}, .${clip.rootClass} .${blockClass(b.id)}`,
    }) + (spaced ? `\n${sectionSpacingCss(slot.spacing, `.${clip.rootClass}.mx-s${position + 1}`)}` : '')
    const mediaCss = media
      .map((m) => {
        const sel = `.${clip.rootClass} .${blockClass(m.blockId)}`
        const fit = changed.find((x) => x.b.id === m.blockId)?.edit.media?.fit === 'contain' ? 'contain' : 'cover'
        // position: relative sits in the clip layer under :where(), so a clip that positions the block keeps winning.
        return `@layer clip { :where(${sel}) { position: relative; } }\n@layer blocks {\n${sel} { overflow: hidden; }\n${sel} > :not(.mx-media, .mx-play) { visibility: hidden; }\n${sel} > .mx-media { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: ${fit}; display: block; border: 0; border-radius: inherit; }\n}`
      })
      .join('\n')
    const rootSel = `.${clip.rootClass}.mx-s${position + 1}`
    const generated = presetMotionCss({
      blocks: clip.blocks,
      edits: (b) => effectiveEdit(edits?.[b.id], input.page?.components?.[b.kind]),
      section: slot.motion,
      select: (b) => `.${clip.rootClass} .${blockClass(b.id)}`,
      root: rootSel,
      prefix: `mx-s${position + 1}-m`,
    })

    let localVars: CssVars | null = null
    let css = clip.css
    if (slot.keep.style) {
      const { ['--mx-vh']: _vh, ...rest } = expandTokens(clip.tokens)
      localVars = rest
      css = `${varsToCss(rest, `.${clip.rootClass}`)}\n\n${css}`
      addFonts(clip.tokens)
    }

    // The clip's own motion, unless a preset (or None) replaces it; then any presets you chose.
    const captured =
      slot.keep.motion && clip.motionCss && (!slot.motion || slot.motion.mode === 'captured')
        ? `@layer motion {\n  @media (prefers-reduced-motion: no-preference) {\n${indent(clip.motionCss, '    ')}\n  }\n}`
        : null
    const motionCss = [captured, generated && `/* Motion presets */\n${generated}`].filter(Boolean).join('\n\n') || null
    // Layers keep the cascade simple: a block's look always beats the clip's own CSS.
    // The order is repeated in each file so it holds whichever stylesheet a bundler loads first.
    css = `${LAYER_ORDER}\n\n@layer clip {\n${indent(css)}\n}${blocksCss ? `\n\n/* Blocks you restyled */\n${blocksCss}` : ''}${mediaCss ? `\n\n/* Pictures */\n${mediaCss}` : ''}`

    sections.push({
      slotId: slot.id,
      position,
      type: clip.type,
      component,
      clip,
      keep: slot.keep,
      tree,
      css,
      motionCss,
      localVars,
      blocks: changed.map(({ b, edit }) => ({ id: b.id, label: b.label, kind: b.kind, edit })),
      motion: slot.motion,
      media,
      retained: slot.keep.content ? [] : retained,
      notes: input.slotNotes?.[slot.id] ?? [],
    })
  })

  return {
    title: input.title ?? input.content.brand,
    tokens: input.guide.tokens,
    vars: {
      ...expandTokens(input.guide.tokens),
      ...Object.fromEntries((input.page?.swatches ?? []).map((w) => [`--mx-color-x-${slug(w.name)}`, w.value])),
    },
    fonts: [...fonts.values()],
    sections,
    mediaFiles,
    moving: sections.some((x) => x.media.some((m) => m.kind !== 'image' || m.lightbox)),
  }
}

function indent(s: string, by = '  '): string {
  return s
    .split('\n')
    .map((l) => (l ? by + l : l))
    .join('\n')
}

function extFor(kind: MediaRender['kind'], mime: string | undefined): string {
  if (kind === 'lottie') return mime === 'application/json' ? 'json' : 'lottie'
  if (mime?.includes('webm')) return 'webm'
  if (mime?.includes('quicktime')) return 'mov'
  return 'mp4'
}

const el = (tag: string, attrs: [string, string][], kids: HNode[] = []): HEl => ({ t: 'el', tag, ns: 'html', attrs, kids })

/** The element(s) that draw a picture or moving media inside its block. */
function mediaElements(m: ComposedMedia, w: number, h: number): HEl[] {
  const size: [string, string][] = [
    ['width', String(w)],
    ['height', String(h)],
  ]
  if (m.kind === 'video') {
    const attrs: [string, string][] = [['class', 'mx-media'], ['src', m.src], ...size, ['muted', ''], ['playsinline', ''], ['preload', 'metadata'], ['data-play', m.play ?? 'inview']]
    if (m.loop) attrs.push(['loop', ''])
    if (m.play === 'autoplay') attrs.push(['autoplay', ''])
    if (m.poster) attrs.push(['poster', m.poster])
    if (m.alt) attrs.push(['aria-label', m.alt])
    return [el('video', attrs)]
  }
  if (m.kind === 'lottie') {
    const attrs: [string, string][] = [['class', 'mx-media'], ...size, ['data-lottie', m.src], ['data-play', m.play ?? 'inview'], ['data-loop', String(m.loop)], ['role', 'img']]
    if (m.alt) attrs.push(['aria-label', m.alt])
    return [el('canvas', attrs)]
  }
  if (m.kind === 'embed') {
    const poster = m.poster ? [el('img', [['class', 'mx-media'], ['src', m.poster], ['alt', m.alt], ...size, ['loading', 'lazy'], ['decoding', 'async']])] : []
    return [...poster, el('button', [['type', 'button'], ['class', 'mx-play'], ['data-embed', m.player ?? ''], ['aria-label', m.alt ? `Play video: ${m.alt}` : 'Play video']])]
  }
  return [el('img', [['class', 'mx-media'], ['src', m.src], ['alt', m.alt], ...size, ['loading', 'lazy'], ['decoding', 'async']])]
}
