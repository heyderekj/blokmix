import type { Capture, Clip, Library, Rhythm, SectionType, Source, TokenSet } from './types'
import { SECTION_TYPES } from './types'
import { extractFields, parseHtml } from './html/parse'
import { lintClip } from './lint'
import { hash } from './hash'
import { indexBlocks } from './blocks'
import { DEFAULT_ICON_SET, identifyIconSet } from './icons'

export interface RawClip {
  type: SectionType
  folder: string // '<source>-<variant>'
  html: string
  css: string
  motionCss: string | null
  meta: {
    title: string
    layoutPattern: string
    rhythm?: Rhythm
    motionNotes?: string
    capture: Omit<Capture, 'url'> & { path?: string }
    tokens?: Partial<TokenSet>
  }
}

/** Turn raw sample files into a validated Library. Pure, so tests and scripts can use it. */
export function buildLibrary(sources: Source[], raws: RawClip[]): Library {
  const lib: Library = {
    sources: Object.fromEntries(sources.map((s) => [s.id, s])),
    clips: {},
    byType: Object.fromEntries(SECTION_TYPES.map((t) => [t, []])) as unknown as Library['byType'],
    layoutsByType: Object.fromEntries(SECTION_TYPES.map((t) => [t, []])) as unknown as Library['layoutsByType'],
    warnings: [],
  }

  for (const raw of raws.sort((a, b) => a.folder.localeCompare(b.folder))) {
    const sourceId = raw.folder.split('-')[0]
    const source = lib.sources[sourceId]
    const id = `${raw.type}.${raw.folder}`
    if (!source) {
      lib.warnings.push({ clipId: id, level: 'error', message: `Unknown source "${sourceId}"` })
      continue
    }
    const rootClass = `mx-${raw.type}-${raw.folder}`
    const tokens = { ...source.tokens, ...(raw.meta.tokens ?? {}) } as TokenSet
    const issues = lintClip({ id, type: raw.type, rootClass, html: raw.html, css: raw.css, motionCss: raw.motionCss })
    lib.warnings.push(...issues)

    const clip: Clip = {
      id,
      type: raw.type,
      sourceId,
      title: raw.meta.title,
      layoutPattern: raw.meta.layoutPattern,
      rhythm: raw.meta.rhythm,
      origin: source.kind === 'layout' ? 'layout' : 'clip',
      rootClass,
      html: raw.html.trim(),
      css: raw.css.trim(),
      motionCss: raw.motionCss?.trim() || null,
      motionNotes: raw.meta.motionNotes,
      tokens,
      fonts: source.fonts,
      fields: extractFields(parseHtml(raw.html)),
      blocks: indexBlocks(parseHtml(raw.html), raw.type),
      capture: {
        url: new URL(raw.meta.capture.path ?? '/', source.url).toString(),
        selector: raw.meta.capture.selector,
        viewport: raw.meta.capture.viewport,
        capturedAt: raw.meta.capture.capturedAt,
      },
      hash: hash(raw.html + raw.css + (raw.motionCss ?? '') + JSON.stringify(tokens)),
    }
    lib.clips[id] = clip
    if (clip.origin === 'layout') lib.layoutsByType[raw.type].push(id)
  }
  // Your clips first, then layouts, so sliding through a section reaches real clips before built-ins.
  for (const t of SECTION_TYPES) {
    const ids = Object.values(lib.clips).filter((c) => c.type === t)
    lib.byType[t] = [...ids.filter((c) => c.origin === 'clip'), ...ids.filter((c) => c.origin === 'layout')].map((c) => c.id)
  }
  identifySourceIcons(lib)
  return lib
}

/**
 * A source's icon set, identified from the named icons in its clips (unless the
 * source says). It becomes part of the source's look, so "Use look" brings it.
 */
function identifySourceIcons(lib: Library) {
  for (const source of Object.values(lib.sources)) {
    const clips = Object.values(lib.clips).filter((c) => c.sourceId === source.id)
    const svgs = clips.flatMap((c) => [...c.html.matchAll(/<svg\b[^>]*data-mx-icon[^>]*>[\s\S]*?<\/svg>/g)].map((m) => m[0]))
    const found = source.tokens['icon.set'] ? null : identifyIconSet(svgs)
    const set = source.tokens['icon.set'] || found?.set || DEFAULT_ICON_SET
    source.tokens = { ...source.tokens, 'icon.set': set }
    if (found) source.iconReason = found.reason
    for (const c of clips) if (!c.tokens['icon.set']) c.tokens = { ...c.tokens, 'icon.set': set }
  }
}

/** Parse `/samples/clips/<type>/<folder>/<file>` glob results into RawClips. */
export function rawClipsFromFiles(files: Record<string, string>): RawClip[] {
  const groups = new Map<string, { type: string; folder: string; files: Record<string, string> }>()
  for (const [path, text] of Object.entries(files)) {
    const m = path.match(/clips\/([a-z]+)\/([\w-]+)\/(clip\.html|clip\.css|motion\.css|clip\.json)$/)
    if (!m) continue
    const [, type, folder, file] = m
    const key = `${type}/${folder}`
    const g = groups.get(key) ?? { type, folder, files: {} }
    g.files[file] = text
    groups.set(key, g)
  }
  const out: RawClip[] = []
  for (const g of groups.values()) {
    const f = g.files
    if (!f['clip.html'] || !f['clip.json']) continue
    out.push({
      type: g.type as SectionType,
      folder: g.folder,
      html: f['clip.html'],
      css: f['clip.css'] ?? '',
      motionCss: f['motion.css'] ?? null,
      meta: JSON.parse(f['clip.json']),
    })
  }
  return out
}

export function allFonts(lib: Library) {
  const seen = new Map<string, Source['fonts'][number]>()
  for (const s of Object.values(lib.sources)) for (const f of s.fonts) seen.set(f.family, f)
  return [...seen.values()]
}

/**
 * Add clips to a library that's already in use (an account's captured clips, loaded
 * after the built-in samples). Its own clips come before the layouts, as in
 * buildLibrary. Returns the ids added; clips already there are left alone.
 */
export function extendLibrary(lib: Library, sources: Source[], raws: RawClip[]): string[] {
  const fresh = sources.filter((s) => !lib.sources[s.id])
  const extra = buildLibrary([...Object.values(lib.sources), ...fresh], raws)
  for (const s of fresh) lib.sources[s.id] = s
  const added = Object.keys(extra.clips).filter((id) => !lib.clips[id])
  for (const id of added) {
    const clip = extra.clips[id]
    lib.clips[id] = clip
    const layouts = lib.layoutsByType[clip.type]
    const isLayout = extra.layoutsByType[clip.type].includes(id)
    if (isLayout) layouts.push(id)
    const yours = lib.byType[clip.type].filter((x) => !layouts.includes(x))
    lib.byType[clip.type] = [...(isLayout ? yours : [...yours, id]).sort(), ...layouts]
  }
  lib.warnings.push(...extra.warnings.filter((w) => added.includes(w.clipId)))
  return added
}

/**
 * Blokmix's sample sites: made-up brands (`*.example`) that seed the demo mix. Mixes that use them
 * still draw them, but they aren't offered as alternatives: the built-in layouts are.
 */
export const isSample = (lib: Library, id: string): boolean => {
  const clip = lib.clips[id]
  return !!clip && clip.origin === 'clip' && /\.example(\/|$)/.test(new URL(lib.sources[clip.sourceId]?.url ?? 'https://x/').host + '/')
}

/** The clips you can pick for a section: your clips, then the layouts. */
export const pickable = (lib: Library, type: SectionType): string[] => lib.byType[type].filter((id) => !isSample(lib, id))
