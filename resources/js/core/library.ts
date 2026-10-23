import type { Capture, Clip, Library, SectionType, Source, TokenSet } from './types'
import { SECTION_TYPES } from './types'
import { extractFields, parseHtml } from './html/parse'
import { lintClip } from './lint'
import { hash } from './hash'

export interface RawClip {
  type: SectionType
  folder: string // '<source>-<variant>'
  html: string
  css: string
  motionCss: string | null
  meta: {
    title: string
    layoutPattern: string
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
      rootClass,
      html: raw.html.trim(),
      css: raw.css.trim(),
      motionCss: raw.motionCss?.trim() || null,
      motionNotes: raw.meta.motionNotes,
      tokens,
      fonts: source.fonts,
      fields: extractFields(parseHtml(raw.html)),
      capture: {
        url: new URL(raw.meta.capture.path ?? '/', source.url).toString(),
        selector: raw.meta.capture.selector,
        viewport: raw.meta.capture.viewport,
        capturedAt: raw.meta.capture.capturedAt,
      },
      hash: hash(raw.html + raw.css + (raw.motionCss ?? '') + JSON.stringify(tokens)),
    }
    lib.clips[id] = clip
    lib.byType[raw.type].push(id)
  }
  return lib
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
