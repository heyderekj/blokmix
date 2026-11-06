import type { LinkTarget, Site, BlockEdit, MediaFill, MediaPlay, SectionMotion, Clip, CssVars, FontSource, GuideState, Keep, Library, ProjectContent, ResolvedGuide, SectionType, Slot, TokenSet, ListBinding } from './types'
import { applyBindings, findList, sortedEntries, type BindContext, type Collection } from './collections'
import { bandTokens, sectionTokens, widthTokens } from './surface'
import { blockTextStyle } from './textStyles'
import { applyFields, attr, mapTree, parseHtml, walk, type HEl, type HNode } from './html/parse'
import { blockCss, defaultFor, effectiveEdit, sectionSpacingCss, slug } from './blocks/style'
import { pictureFor, withSectionDefaults } from './sectionDefaults'
import { LAYER_ORDER } from './export/base-css'
import { motionCss as presetMotionCss } from './motion'
import { swapIcons } from './icons'
import { dataUrlBytes, placeholderSvg, renderMedia, shaderFor, sizeForRatio, stockCredit, type MediaRender, type UploadData } from './media'
import { BACKDROP_POSTER, shaderElement, standInPoster } from './export/shaders'
import { resolveFields } from './content'
import { sectionClip } from './lists'
import { applyLinks, pageScope, sectionAnchors, sectionLinks, siteScope, type LinkScope } from './links'
import { allSlots, pageView } from './site'
import { BANNER_CSS, BANNER_MOTION, bannerMoves } from './banner'
import { contentJson, outline, type ContentValue, type OutlineNode } from './outline'
import { BASE_FONTS, expandTokens, fontsForTokens, varsToCss } from './tokens'
import { allFonts } from './library'
import { MOCK_BASE_CSS, backdropCss, backdropInfo, backdropShaderId, describeParams, effectsVars, isBackdropId, backdropParams, readBackdrop, type ShaderSpec, type TreatmentValue } from './treatments'

export interface ComposedSection {
  slotId: string
  position: number
  type: SectionType
  component: string
  clip: Clip
  keep: Keep
  /** Hands off: Shuffle and agents leave it alone. */
  locked?: boolean
  tree: HNode[]
  /** The same markup before the words go in (data-mx-* kept), for components that read a content file. */
  source: HNode[]
  /** Its anchor on the page (#pricing). */
  anchor: string
  /** Where its links and buttons lead (href "#" = nowhere yet). */
  links: { id: string; label: string; href: string; newTab: boolean; auto: boolean; to: LinkTarget['to'] }[]
  /** Its words as content: fields and lists in page order… */
  outline: OutlineNode[]
  /** …and as the content file's JSON (src/content/<contentName>.json). */
  content: Record<string, ContentValue>
  /** Lists that show a collection, by their key in the content file: the export fills them from its entries. */
  bound?: ({ key: string } & ListBinding)[]
  /** On a collection's template page: content keys (fields) that show the page's entry, and from which entry field. */
  entryBound?: Record<string, string>
  contentName: string
  /** Other ways to say a field that you kept (not retired), by field: what you're still choosing between. */
  options: Record<string, string[]>
  /** Section CSS including local token overrides when the section keeps its own style. */
  css: string
  motionCss: string | null
  localVars: CssVars | null
  /** Block looks you changed: variant and style per block, for the packet. */
  blocks: { id: string; label: string; kind: string; edit: BlockEdit }[]
  /** The section's motion choice (absent = as clipped). */
  motion?: SectionMotion
  /** What's behind the section, in words (absent = as clipped). */
  backdrop?: { value: TreatmentValue; label: string; description: string; live?: boolean; poster?: string }
  /** Pictures in its image blocks. */
  media: ComposedMedia[]
  retained: string[]
  notes: string[]
  /** The real site this section's layout was matched from (the section's own, else its clip's). */
  inspiredBy?: { site: string; url: string }
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
  /** Mockups: their markup and CSS (they're HTML, not a file). */
  html: string | null
  css: string | null
  mock: string | null
  /** Live shaders: what /mx-shaders.js runs (src is its poster). */
  shader: ShaderSpec | null
}

/** A live shader on the page: its poster's path in public/ (a stand-in until the browser bakes it) and what to bake. */
export interface ComposedShader {
  path: string
  spec: ShaderSpec
  w: number
  h: number
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
  /** A section is a slider: ship /mx-slider.js. */
  sliding?: boolean
  /** Live shaders (backdrops and image blocks): ship /mx-shaders.js, and bake their posters. */
  shaders: ComposedShader[]
  /** Other pages that links lead to but the site doesn't have yet (/careers): for the agent to build. */
  pages: string[]
  /** A site of pages: the shared nav and footer, composed once, and each page's own sections. `sections` lists them all. */
  site?: ComposedSite
  /** The collections its sections show (exports write them as content collections). */
  collections?: Collection[]
}

export interface ComposedSite {
  shared: { nav?: ComposedSection; footer?: ComposedSection }
  pages: { id: string; path: string; title: string; show: { nav: boolean; footer: boolean }; sections: ComposedSection[]; template?: { collection: string } }[]
}

export interface ComposeInput {
  slots: Slot[]
  guide: ResolvedGuide
  content: ProjectContent
  library: Library
  slotNotes?: Record<string, string[]>
  title?: string
  /** Extra brand colors, page-wide block looks and effects from the style guide. */
  page?: Pick<GuideState, 'swatches' | 'components' | 'effects' | 'textStyles' | 'sections' | 'picture'>
  /** Uploaded images by asset id (data URLs), from the browser's asset store. */
  uploads?: (id: string) => UploadData | undefined
  /** Keep each block's data-mx-b in the markup, so the page can be measured block by block (lib/measure.ts). */
  keepBlockIds?: boolean
  /** Class and media prefix, unique per page of a site so pages share one stylesheet safely (default "s": mx-s1-…). */
  key?: string
  /** Component names already taken (by other pages of the site). */
  used?: Map<string, number>
  /** Where links can lead and their hrefs from this page (default: this page's own sections). */
  link?: LinkScope
  /** Section anchors, when the page's view includes sections composed elsewhere (the shared nav). */
  anchors?: Record<string, string>
  /** Your collections, for sections bound to them (`core/collections.ts`). */
  bind?: BindContext
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

/** A slider's choices, as attributes on its section root: the clip's CSS answers to them. */
export function sliderAttrs(c: Slot['slider']): [string, string][] {
  return [...(c?.slide ? [['data-slide', c.slide]] : []), ...(c?.show ? [['data-show', String(c.show)]] : []), ...(c?.intro ? [['data-intro', c.intro]] : [])] as [string, string][]
}

/** Everything the exporters, the packet and the reference build share. */
export function composePage(input: ComposeInput): ComposedPage {
  const catalog = [...allFonts(input.library), ...BASE_FONTS]
  const fonts = new Map<string, FontSource>()
  const addFonts = (t: TokenSet) => fontsForTokens(t, catalog).forEach((f) => fonts.set(f.family, f))
  addFonts(input.guide.tokens)

  const used = input.used ?? new Map<string, number>()
  const key = input.key ?? 's'
  const scope = input.link ?? pageScope(input.slots)
  const mediaFiles: Record<string, string | Uint8Array> = {}
  const sections: ComposedSection[] = []
  const shaders: ComposedShader[] = []
  /** A shader's poster: a stand-in now, the real frame once the browser bakes it. */
  const posterFor = (path: string, spec: ShaderSpec, w: number, h: number) => {
    mediaFiles[path] = standInPoster(spec, w, h)
    shaders.push({ path, spec, w, h })
    return `/${path}`
  }

  const anchors = input.anchors ?? sectionAnchors(input.slots)
  input.slots.forEach((own, position) => {
    const libraryClip = input.library.clips[own.clipId]
    if (!libraryClip) return
    // A section bound to a collection shows its entries (derived; the section keeps its own words).
    const bound = input.bind && own.bind ? applyBindings(own, libraryClip, input.bind) : own
    // Its type's defaults from the style guide sit underneath what the section chose.
    const slot = withSectionDefaults(bound, libraryClip.type, input.page?.sections, !!libraryClip.motionCss)
    // The clip as this section shows it: its lists in your order, blocks stamped with stable ids.
    const clip = sectionClip(libraryClip, slot.lists, { banner: slot.banner })
    let component = componentName(clip)
    const n = (used.get(component) ?? 0) + 1
    used.set(component, n)
    if (n > 1) component += n

    const { fields, retained } = resolveFields(clip.type, clip.fields, input.content, slot.keep.content, slot.words)

    // Blocks with a changed look get a class (unique to this section) that the block CSS targets,
    // including blocks changed only on phones (their rules sit in the block CSS's @media).
    const edits = slot.edits?.[clip.id]
    // A block whose text style you edited in the guide is changed too, with no edit of its own.
    const changed = clip.blocks
      .map((b) => {
        const edit = effectiveEdit(edits?.[b.id], defaultFor(input.page?.components, b))
        const picture = pictureFor(edit?.media, b, input.page?.picture, clip.origin, slot.keep.style, { type: clip.type, logo: input.content.logo })
        return { b, edit: picture && !edit?.media ? { ...edit, media: picture } : edit ?? (blockTextStyle(b, clip.blocks, undefined, input.page) ? {} : undefined) }
      })
      .filter((x): x is { b: (typeof x)['b']; edit: BlockEdit } => !!x.edit)
    const blockClass = (id: string) => `mx-${key}${position + 1}-${id.replace(/\./g, '-')}`
    const preset = slot.motion?.mode === 'preset' ? slot.motion : undefined
    // Staggered sections animate their top-level blocks, so those need a class too.
    const staggered = preset?.stagger ? clip.blocks.filter((b) => !b.parent || clip.blocks.find((x) => x.id === b.parent)?.kind === 'list').map((b) => b.id) : []
    const changedIds = new Set([...changed.map((x) => x.b.id), ...staggered])
    let order = 0
    // Section spacing, on desktop or only on phones (spacing.mobile), a backdrop, and a band or width of its own need the root class too.
    const chosenBackdrop = slot.backdrop && isBackdropId(slot.backdrop.id) ? slot.backdrop : undefined
    // Over a backdrop, a section's colors answer to what's behind its words; one nothing can read over softens.
    const reading = chosenBackdrop && !slot.keep.style ? readBackdrop(chosenBackdrop, bandTokens(input.guide.tokens, slot)) : null
    const backdrop = reading?.value ?? chosenBackdrop
    const banded = (slot.surface && slot.surface !== 'page') || !!slot.width || !!reading
    const spaced = !!sectionSpacingCss(slot.spacing, 'x') || !!preset || !!backdrop || banded
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
      const base = `media/${key}${position + 1}-${b.id.replace(/\./g, '-')}`
      let src = r.src
      let poster = r.poster
      if (r.shader) {
        const [w, h] = sizeForRatio(b.ratio, 1200)
        src = posterFor(`${base}.png`, r.shader, w, h)
      } else if (fill.source === 'placeholder') {
        src = `/${base}.svg`
        mediaFiles[`${base}.svg`] = placeholderSvg(fill.style ?? 'mesh', fill.seed ?? 1, input.guide.tokens, b.ratio, fill.params)
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
        // A shader's poster goes inline from mediaFiles when the reference is written (it may be baked by then).
        inline: r.shader ? src : r.src,
        poster: poster ?? null,
        inlinePoster: r.poster ?? null,
        player: r.player ?? null,
        play: r.play ?? null,
        loop: r.loop ?? false,
        lightbox: !!r.lightbox,
        alt: r.alt,
        credit: fill.source === 'stock' && fill.stock ? stockCredit(fill.stock) : null,
        html: r.html ?? null,
        css: r.css ?? null,
        mock: fill.source === 'mock' ? (fill.mock ?? null) : null,
        shader: r.shader ?? null,
      })
    }
    const mediaFor = new Map(media.map((m) => [m.blockId, m]))
    // A live backdrop runs in its own layer, the root's last child, over a poster.
    const liveId = backdropShaderId(backdrop)
    // Backdrops draw in the section's surface colors (core/surface.ts).
    const backdropTokens = slot.keep.style ? clip.tokens : bandTokens(input.guide.tokens, slot)
    const live = liveId
      ? (() => {
          const spec = shaderFor(liveId, backdrop!.params, backdrop!.seed ?? 1, backdropTokens, '16/9')
          const [w, h] = BACKDROP_POSTER
          const path = `media/${key}${position + 1}-backdrop.png`
          return { spec, path, el: shaderElement(spec, { as: 'backdrop', poster: posterFor(path, spec, w, h), w, h }) }
        })()
      : null
    // Named icons redrawn in the style guide's set (unless the section keeps its own look).
    const iconOverrides = Object.fromEntries(changed.flatMap(({ b, edit }) => (b.kind === 'icon' && edit.icon ? [[b.id, edit.icon]] : [])))
    const swapped = slot.keep.style
      ? swapIcons(parseHtml(clip.html), input.library.sources[clip.sourceId]?.tokens['icon.set'] ?? input.guide.tokens['icon.set'], iconOverrides, true)
      : swapIcons(parseHtml(clip.html), input.guide.tokens['icon.set'], iconOverrides)
    // Which icon each named icon shows, in a plain attribute that outlives the data-mx-* strip, so a clip can style
    // by it (a comparison cell's check in a filled circle, its dash quiet).
    const source = mapTree(swapped, (el) => (el.tag === 'svg' && attr(el, 'data-mx-icon') ? { ...el, attrs: [...el.attrs.filter(([k]) => k !== 'data-icon'), ['data-icon', attr(el, 'data-mx-icon')!]] } : el))
    // One radio group (and one set of label targets) per section, so two copies of a layout on a page switch on their own.
    const scoped = scopeIds(source, `${key}${position + 1}`)
    const marked = mapTree(scoped, (el) => {
      if (attr(el, 'data-mx-section') !== undefined) {
        // Every section has an anchor, so links can lead to it (#pricing), and is a size container (base CSS).
        const root = addClass(spaced ? addClass(el, `mx-${key}${position + 1}`) : el, 'mx-section')
        return { ...root, attrs: [...root.attrs.filter(([k]) => k !== 'id'), ['id', anchors[slot.id]], ...sliderAttrs(slot.slider)], kids: live ? [...root.kids, live.el] : root.kids }
      }
      if (attr(el, 'data-mx-block') === undefined) return el
      const id = attr(el, 'data-mx-b') ?? `b${order}`
      order++
      if (!changedIds.has(id)) return el
      const withClass = addClass(el, blockClass(id))
      const m = mediaFor.get(id)
      if (!m) return withClass
      const [w, h] = sizeForRatio(clip.blocks.find((x) => x.id === id)?.ratio, 1600)
      const block = m.lightbox ? { ...withClass, attrs: [...withClass.attrs, ['data-lightbox', ''] as [string, string]] } : withClass
      // A filled picture says what it shows: the placeholder's aria-hidden goes with the placeholder.
      return { ...block, attrs: block.attrs.filter(([k]) => k !== 'aria-hidden'), kids: [...block.kids, ...mediaElements(m, w, h)] }
    })
    // Where its links lead: what you set, else what their words name.
    const links = sectionLinks(clip.blocks, edits, fields, scope, slot.id)
    const linked = applyLinks(marked, links)
    // Blocks you hid (a banner you don't want) leave the markup and the content file altogether.
    // Hidden only on phones stays: it's still on the page at desktop widths, and CSS hides it below.
    const hidden = new Set(changed.filter((x) => x.edit.hidden).map((x) => x.b.id))
    const shown = hidden.size ? dropBlocks(linked, hidden) : linked
    const filled = applyFields(shown, fields, !input.keepBlockIds)
    const tree = input.keepBlockIds ? mapTree(filled, (el) => ({ ...el, attrs: el.attrs.filter(([k]) => k === 'data-mx-b' || !k.startsWith('data-mx-')) })) : filled
    const words = outline(shown)
    const blocksCss = blockCss({
      blocks: clip.blocks,
      edits,
      components: input.page?.components,
      textStyles: input.page?.textStyles,
      select: (b) => `.${clip.rootClass}.${blockClass(b.id)}, .${clip.rootClass} .${blockClass(b.id)}`,
    }) + (spaced ? `\n${sectionSpacingCss(slot.spacing, `.${clip.rootClass}.mx-${key}${position + 1}`)}` : '')
    const mocks = media.filter((m) => m.kind === 'mock' && m.css)
    const mockCss = mocks.length ? `@layer blocks {\n${indent([MOCK_BASE_CSS.trim(), ...new Set(mocks.map((m) => m.css!))].join('\n'))}\n}` : ''
    const mediaCss = media
      .map((m) => {
        const sel = `.${clip.rootClass} .${blockClass(m.blockId)}`
        const fit = changed.find((x) => x.b.id === m.blockId)?.edit.media?.fit === 'contain' ? 'contain' : 'cover'
        // position: relative sits in the clip layer under :where(), so a clip that positions the block keeps winning.
        return `@layer clip { :where(${sel}) { position: relative; } }\n@layer blocks {\n${sel} { overflow: hidden; }\n${sel} > :not(.mx-media, .mx-play) { visibility: hidden; }\n${sel} > .mx-media { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: ${fit}; display: block; border: 0; border-radius: inherit; }\n}`
      })
      .join('\n')
    const rootSel = `.${clip.rootClass}.mx-${key}${position + 1}`
    const behind = backdrop ? backdropCss(backdrop, backdropTokens, rootSel, !!reading?.ink) : ''
    const generated = presetMotionCss({
      blocks: clip.blocks,
      edits: (b) => effectiveEdit(edits?.[b.id], defaultFor(input.page?.components, b)),
      section: slot.motion,
      select: (b) => `.${clip.rootClass} .${blockClass(b.id)}`,
      root: rootSel,
      prefix: `mx-${key}${position + 1}-m`,
    })

    let localVars: CssVars | null = null
    let css = clip.css
    if (slot.keep.style) {
      const { ['--mx-vh']: _vh, ...rest } = expandTokens(widthTokens(clip.tokens, slot.width))
      localVars = rest
      css = `${varsToCss(rest, `.${clip.rootClass}`)}\n\n${css}`
      addFonts(clip.tokens)
    } else if (banded) {
      // A band in the guide's own colors, or its own width: the section's tokens, re-mixed, on this section only.
      const { ['--mx-vh']: _vh, ...rest } = expandTokens(sectionTokens(input.guide.tokens, slot))
      localVars = rest
      css = `${varsToCss(rest, rootSel)}\n\n${css}`
    }

    // The clip's own motion, unless a preset (or None) replaces it; then any presets you chose.
    const captured =
      slot.keep.motion && clip.motionCss && (!slot.motion || slot.motion.mode === 'captured')
        ? `@layer motion {\n  @media (prefers-reduced-motion: no-preference) {\n${indent(clip.motionCss, '    ')}\n  }\n}`
        : null
    const bannerMotion = clip.extras?.banner && bannerMoves(slot) ? `/* The banner's scroll */\n${BANNER_MOTION}` : null
    const motionCss = [captured, generated && `/* Motion presets */\n${generated}`, bannerMotion].filter(Boolean).join('\n\n') || null
    // Layers keep the cascade simple: a block's look always beats the clip's own CSS.
    // The order is repeated in each file so it holds whichever stylesheet a bundler loads first.
    css = `${LAYER_ORDER}\n\n@layer clip {\n${indent(css)}\n}${behind ? `\n\n/* Backdrop */\n${behind}` : ''}${blocksCss ? `\n\n/* Blocks you restyled */\n${blocksCss}` : ''}${mediaCss ? `\n\n/* Pictures */\n${mediaCss}` : ''}${mockCss ? `\n\n/* Mockups */\n${mockCss}` : ''}`
    // An added banner brings its own CSS, in tokens; it scrolls unless the section's motion is off.
    if (clip.extras?.banner) css += `\n\n/* Banner you added */\n${BANNER_CSS}`

    sections.push({
      slotId: slot.id,
      position,
      type: clip.type,
      component,
      clip,
      keep: slot.keep,
      ...(slot.locked ? { locked: true } : {}),
      ...(own.inspiredBy ?? libraryClip.inspiredBy ? { inspiredBy: own.inspiredBy ?? libraryClip.inspiredBy } : {}),
      tree,
      source: shown,
      anchor: anchors[slot.id],
      links: clip.blocks.flatMap((b) => {
        const l = links[b.id]
        return l && !hidden.has(b.id) ? [{ id: b.id, label: b.label, href: l.href, newTab: l.newTab, auto: l.auto, to: l.target?.to ?? 'none' }] : []
      }),
      outline: words,
      content: contentJson(words, fields),
      bound: own.bind?.lists
        ? Object.entries(own.bind.lists).flatMap(([listKey, b]) => {
            const list = findList(words, listKey)
            return list && input.bind?.collections[b.collection] ? [{ key: list.key, ...b }] : []
          })
        : undefined,
      entryBound: own.bind?.entry?.fields && Object.keys(own.bind.entry.fields).length ? { ...own.bind.entry.fields } : undefined,
      contentName: kebab(component),
      options: Object.fromEntries(
        Object.entries(slot.options ?? {}).flatMap(([f, os]) => {
          const live = os.filter((o) => !o.retiredAt && o.text !== fields[f]).map((o) => o.text)
          return live.length ? [[f, live]] : []
        }),
      ),
      css,
      motionCss,
      localVars,
      blocks: changed.map(({ b, edit }) => ({ id: b.id, label: b.label, kind: b.kind, edit })),
      motion: slot.motion,
      backdrop: backdrop
        ? {
            value: backdrop,
            label: backdropInfo(backdrop.id as Parameters<typeof backdropInfo>[0]).label,
            description: describeParams(backdropParams(backdrop.id as Parameters<typeof backdropParams>[0]), backdrop.params),
            ...(live ? { live: true, poster: `/${live.path}` } : {}),
          }
        : undefined,
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
      // Effects after the tokens: the shadow effect is the card shadow.
      ...effectsVars(input.page?.effects, input.guide.tokens),
    },
    fonts: [...fonts.values()],
    sections,
    mediaFiles,
    moving: sections.some((x) => x.media.some((m) => (m.kind !== 'image' && m.kind !== 'mock' && m.kind !== 'shader') || m.lightbox)),
    sliding: sections.some((x) => x.clip.html.includes('data-slider')),
    shaders,
    pages: [...new Set(sections.flatMap((x) => x.links.filter((l) => l.to === 'page').map((l) => l.href)))].sort(),
  }
}

/**
 * A whole site: the shared nav and footer composed once, then each page's own
 * sections, with class prefixes and component names unique across the site and
 * links that know other pages. `sections` lists everything, nav first.
 */
export function composeSite(input: Omit<ComposeInput, 'slots' | 'key' | 'used' | 'link' | 'anchors'> & { site: Site }): ComposedPage {
  const { site, ...base } = input
  const used = new Map<string, number>()
  const one = (slots: Site['pages'][number]['slots'], key: string, here: string | null, viewOf?: string) =>
    composePage({ ...base, slots, key, used, link: siteScope(site, here), anchors: viewOf ? sectionAnchors(pageView(site, viewOf)) : undefined })
  const nav = site.shared.nav ? one([site.shared.nav], 'nav', null) : null
  // A collection's template page is composed with its first entry (exports make one page per entry from it).
  const withEntry = (p: Site['pages'][number]) => {
    const c = p.template && base.bind?.collections[p.template.collection]
    const entry = c ? sortedEntries(c).find((e) => !e.draft) : undefined
    return c && entry ? { ...base, bind: { ...base.bind!, entry: { collection: c.slug, entry } } } : base
  }
  const pages = site.pages.map((p, i) => ({ page: p, composed: composePage({ ...withEntry(p), slots: p.slots, key: i === 0 ? 's' : `p${i + 1}s`, used, link: siteScope(site, p.id), anchors: sectionAnchors(pageView(site, p.id)) }) }))
  const footer = site.shared.footer ? one([site.shared.footer], 'ft', null) : null
  const all = [nav, ...pages.map((x) => x.composed), footer].filter((x): x is ComposedPage => !!x)
  const fonts = new Map(all.flatMap((c) => c.fonts.map((f) => [f.family, f] as const)))
  const paths = new Set(site.pages.map((p) => p.path))
  const first = all[0] ?? composePage({ ...base, slots: [] })
  const shown = new Set(allSlots(site).flatMap((s) => Object.values(s.bind?.lists ?? {}).map((b) => b.collection)))
  for (const p of site.pages) if (p.template) shown.add(p.template.collection)
  // Pictures in entries become files under public/media/collections (stock photos keep their address).
  const collectionMedia: Record<string, string | Uint8Array> = {}
  const collections = [...shown]
    .map((slug) => input.bind?.collections[slug])
    .filter((c): c is Collection => !!c)
    .map((c) => ({
      ...c,
      entries: c.entries.map((e) => ({
        ...e,
        data: Object.fromEntries(
          Object.entries(e.data).map(([k, v]) => {
            if (!v || typeof v !== 'object' || Array.isArray(v)) return [k, v]
            if (v.source === 'stock' && v.stock?.url) return [k, v.stock.url]
            const up = v.source === 'upload' && v.asset ? input.uploads?.(v.asset) : undefined
            if (!up?.bytes) return [k, null]
            const path = `media/collections/${c.slug}/${e.slug}-${k}.${up.mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'webp'}`
            collectionMedia[path] = new Uint8Array(up.bytes)
            return [k, `/${path}`]
          }),
        ),
      })),
    }))
  return {
    ...first,
    collections: collections.length ? collections : undefined,
    title: input.title ?? input.content.brand,
    fonts: [...fonts.values()],
    sections: all.flatMap((c) => c.sections),
    mediaFiles: Object.assign({}, ...all.map((c) => c.mediaFiles), collectionMedia),
    moving: all.some((c) => c.moving),
    sliding: all.some((c) => c.sliding),
    shaders: all.flatMap((c) => c.shaders),
    pages: [...new Set(all.flatMap((c) => c.pages))].filter((p) => !paths.has(p)).sort(),
    site: {
      shared: { nav: nav?.sections[0], footer: footer?.sections[0] },
      pages: pages.map(({ page, composed }) => ({ id: page.id, path: page.path, title: page.title, show: page.show, sections: composed.sections, ...(page.template ? { template: page.template } : {}) })),
    },
  }
}

function dropBlocks(nodes: HNode[], ids: Set<string>): HNode[] {
  return nodes.flatMap((n): HNode[] => {
    if (n.t !== 'el') return [n]
    const id = attr(n, 'data-mx-b')
    // A hidden list takes its marquee copy with it.
    if ((id && ids.has(id)) || ids.has(attr(n, 'data-mx-set') ?? '')) return []
    return [{ ...n, kids: dropBlocks(n.kids, ids) }]
  })
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

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

/**
 * Radio names and the ids labels point at, suffixed with the section's key: a clip writes them once, but a page
 * (or a preview of several) can show the same layout twice. Other ids (an SVG gradient's) stay as they are.
 */
export function scopeIds(tree: HNode[], suffix: string): HNode[] {
  const targets = new Set<string>()
  walk(tree, (n) => {
    const f = n.t === 'el' && n.tag === 'label' ? attr(n, 'for') : undefined
    if (f) targets.add(f)
  })
  return mapTree(tree, (e) => {
    const radio = e.tag === 'input' && attr(e, 'type') === 'radio'
    if (!radio && !targets.size) return e
    return {
      ...e,
      attrs: e.attrs.map(([k, v]): [string, string] =>
        (k === 'name' && radio) || (k === 'for' && e.tag === 'label') || (k === 'id' && targets.has(v)) ? [k, `${v}-${suffix}`] : [k, v],
      ),
    }
  })
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
  if (m.kind === 'mock' && m.html) return parseHtml(m.html).filter((n): n is HEl => n.t === 'el')
  if (m.kind === 'shader' && m.shader) return [shaderElement(m.shader, { as: 'media', poster: m.src, w, h, alt: m.alt })]
  return [el('img', [['class', 'mx-media'], ['src', m.src], ['alt', m.alt], ...size, ['loading', 'lazy'], ['decoding', 'async']])]
}
