import type { Note } from '../types'
import { MARK_GUIDANCE, workPackets, type WorkItem } from '../notes'
import { describeSectionMotion } from '../motion'
import { describeEdit } from './describe'
import { PACK_CREDIT, iconSet } from '../icons'
import type { BuildTarget, GuideState, Library, ResolvedGuide, Status } from '../types'
import type { ComposedPage } from '../compose'
import { GROUP_LABEL, TOKEN_LABEL, toDtcg } from '../tokens'
import { openGroups } from '../guide'
import { TYPE_LABEL } from '../content'
import { astroFiles } from './astro'
import { nextFiles } from './next'
import { referenceHtml } from './reference-html'
import { keepSummary, tokensCss, type FileMap } from './shared'

export const PACKET_SCHEMA = 'blokmix.packet/v1'

export interface PacketInput {
  page: ComposedPage
  guide: ResolvedGuide
  guideState: GuideState
  library: Library
  mixName: string
  version?: { id: string; letter: string; title: string; status: Status; parentLetter?: string } | null
  targets: BuildTarget[]
  notes?: string[]
  /** Feedback marks on this mix (or version). */
  marks?: Note[]
  generatedAt?: string
}

export const AGENT_RULES = [
  'Use only the tokens in tokens.css. Never introduce new colors, font families, radii, shadows or easings.',
  'Keep each section as its own component, in this order.',
  'Start from the astro/ or next/ reference build and refine it; don’t regenerate from scratch.',
  'Where a section says “your copy”, the copy is already swapped in. Replace any fields listed as retained source copy with copy that fits the project.',
  'Treat source sites as references: rewrite markup and copy rather than copying them, replace any logos or images, and substitute licensed fonts with the ones in tokens.css.',
  'Layout marked “reference only” may be restructured to fit neighboring sections.',
  'Respect prefers-reduced-motion: motion lives in each section’s motion block and must stay optional.',
  'Keep source URLs as references in comments; don’t remove them.',
  'Words live in content files (src/content/<section>.json in Astro, content/<section>.json in Next.js), and components read them. Change words in those files, not in markup, and keep each element’s data-mx-src so words trace back to their file.',
]

/** The review loop with ReviseMy (revisemy.com), once a build has a preview. */
export const REVIEW_WIDTHS = [1440, 390] as const
export const REVISEMY = {
  after: 'preview',
  widths: [...REVIEW_WIDTHS],
  import: 'import_review_marks',
  loop: [
    'blokmix prepare_build: write the packet and open the build on the canvas',
    'build it and run the dev server',
    'blokmix report_build with preview_url (and preview_height at 1440 and 390)',
    'revisemy create_review: screenshots at 1440 and 390 for a localhost preview, capture_url for a deployed one',
    'revisemy wait_for_review until the person decides',
    'blokmix import_review_marks with the review and its marks (work_packets.pins)',
    'fix the marks: must-fix first, never a keep',
    'revisemy resolve_marks (and reply_to_marks) for each fix, and blokmix update_note to match',
  ],
}

function sourceLabel(lib: Library, candidateId: string): string {
  const clipId = candidateId.split('#')[0]
  const clip = lib.clips[clipId]
  if (!clip) return candidateId
  return `${lib.sources[clip.sourceId]?.name ?? clip.sourceId} (${clip.id})`
}

function provenanceLabel(lib: Library, p: string): string {
  if (p === 'base') return 'Blokmix default'
  if (p === 'custom') return 'custom'
  return sourceLabel(lib, p)
}

export function packetJson(i: PacketInput) {
  const { page, guide, library } = i
  return {
    schema: PACKET_SCHEMA,
    generatedAt: i.generatedAt ?? new Date().toISOString(),
    mix: {
      name: i.mixName,
      version: i.version ? { id: i.version.id, letter: i.version.letter, title: i.version.title, status: i.version.status, parent: i.version.parentLetter ?? null } : null,
    },
    targets: i.targets,
    tokens: guide.tokens,
    provenance: Object.fromEntries(Object.entries(guide.provenance).map(([k, p]) => [k, provenanceLabel(library, p)])),
    conflicts: guide.conflicts.map((c) => ({
      token: c.key,
      resolved: c.resolved,
      chosen: c.current,
      options: c.options.map((o) => ({ value: o.value, from: o.candidateIds.map((id) => sourceLabel(library, id)) })),
    })),
    fonts: page.fonts,
    notes: i.notes ?? [],
    guidance: MARK_GUIDANCE,
    work_packets: packetsOf(i),
    sections: page.sections.map((s) => ({
      position: s.position + 1,
      type: s.type,
      component: s.component,
      keep: s.keep,
      summary: keepSummary(s),
      clip: {
        id: s.clip.id,
        hash: s.clip.hash,
        title: s.clip.title,
        source: library.sources[s.clip.sourceId]?.name ?? s.clip.sourceId,
        origin: s.clip.origin,
        url: s.clip.capture.url,
        selector: s.clip.capture.selector,
        viewport: s.clip.capture.viewport,
        capturedAt: s.clip.capture.capturedAt,
        layoutPattern: s.clip.layoutPattern,
        motionNotes: s.clip.motionNotes ?? null,
      },
      localTokens: s.keep.style ? s.clip.tokens : null,
      retainedSourceFields: s.retained,
      content: s.outline.length ? s.content : null,
      contentFile: s.outline.length ? `${s.contentName}.json` : null,
      wordOptions: s.options,
      anchor: s.anchor,
      links: s.links.map((l) => ({ block: l.label, href: l.href, newTab: l.newTab, auto: l.auto })),
      media: s.media.map((m) => ({ block: m.label, source: m.source, src: m.src, alt: m.alt, credit: m.credit })),
      blocks: s.blocks.map((b) => ({ id: b.id, label: b.label, kind: b.kind, variant: b.edit.variant ?? null, style: b.edit.style ?? null, hidden: !!b.edit.hidden })),
      notes: s.notes,
      html: s.clip.html,
      css: s.clip.css,
      motionCss: s.clip.motionCss,
    })),
    pages: page.pages,
    rules: AGENT_RULES,
    integrations: { revisemy: REVISEMY, koati: null },
  }
}

export function buildNotes(i: PacketInput): string {
  const { page, guide, library } = i
  const v = i.version
  const lines: string[] = []
  lines.push(`# ${i.mixName}${v ? ` · Version ${v.letter}` : ' · Working mix'}`)
  lines.push('')
  lines.push('> Build notes for an agent. Build this page in ' + i.targets.map((t) => (t === 'astro' ? 'Astro' : 'Next.js')).join(' or ') + ' from the reference build in this packet.')
  lines.push('')
  if (v) {
    lines.push(`- **Version:** ${v.letter}: ${v.title}${v.parentLetter ? ` (branched from ${v.parentLetter})` : ''}`)
    lines.push(`- **Status:** ${v.status}`)
  }
  lines.push(`- **Sections:** ${page.sections.length}`)
  const open = openGroups(guide)
  lines.push(`- **Open style decisions:** ${open.length ? open.map((g) => GROUP_LABEL[g]).join(', ') : 'none'}`)
  lines.push('')
  lines.push('## Sections')
  lines.push('')
  page.sections.forEach((s) => {
    const src = library.sources[s.clip.sourceId]
    lines.push(`### ${s.position + 1}. ${TYPE_LABEL[s.type]}: \`${s.component}\``)
    lines.push('')
    if (s.clip.origin === 'layout') lines.push('- **From:** a Blokmix layout. It’s structural, not a captured site: restyle it freely with the style guide.')
    else lines.push(`- **Clipped from:** ${src?.name ?? s.clip.sourceId}, ${s.clip.capture.url} (\`${s.clip.capture.selector}\`, ${s.clip.capture.viewport.width}px)`)
    lines.push(`- **Pattern:** ${s.clip.layoutPattern}: ${s.clip.title}`)
    lines.push(`- **Layout:** ${s.keep.layout ? 'reproduce the structure faithfully' : 'reference only; choose a structure that fits neighboring sections'}`)
    lines.push(`- **Style:** ${s.keep.style ? 'keeps its own captured tokens (scoped to the section)' : 'use the style guide tokens'}`)
    lines.push(`- **Copy:** ${s.keep.content ? 'source copy kept (replace before launch)' : 'your copy'}${s.retained.length ? `; still source copy: ${s.retained.join(', ')}` : ''}`)
    if (s.outline.length) {
      const lists = s.outline.flatMap((n) => (n.t === 'list' ? [`${n.key} ×${n.items.length}`] : []))
      lines.push(`- **Content:** \`${s.contentName}.json\` in the content folder${lists.length ? ` (lists: ${lists.join(', ')})` : ''}`)
    }
    const nowhere = s.links.filter((l) => l.href === '#')
    const going = s.links.filter((l) => l.href !== '#')
    if (going.length) lines.push(`- **Links:** ${going.map((l) => `${l.label.split(' · ').slice(1).join(' · ') || l.label} → \`${l.href}\`${l.newTab ? ' (new tab)' : ''}`).join('; ')}`)
    if (nowhere.length) lines.push(`- **Links with no destination yet** (ask, or point them somewhere sensible): ${nowhere.map((l) => l.label.split(' · ').slice(1).join(' · ') || l.label).join('; ')}`)
    for (const [f, os] of Object.entries(s.options)) lines.push(`- **Other ways to say ${f}** (kept as options; use only if asked): ${os.map((o) => `“${o}”`).join(' · ')}`)
    lines.push(`- **Motion:** ${describeSectionMotion(s.motion) ?? (s.keep.motion ? s.clip.motionNotes ?? 'keep the captured motion' : 'none')}${s.motionCss?.includes('Motion presets') ? ' (presets are in the section’s motion CSS; keep their timing and easing)' : ''}`)
    for (const b of s.blocks) lines.push(`- **Block, ${b.label}:** ${describeEdit(b.edit)}`)
    for (const n of s.notes) lines.push(`- **Note:** ${n}`)
    lines.push('')
  })
  const wp = packetsOf(i)
  const todo = [...wp.must_fix, ...wp.nits, ...wp.questions]
  if (todo.length || wp.keeps.length || wp.awaiting_verification.length) {
    lines.push('## Feedback')
    lines.push('')
    lines.push(`> ${MARK_GUIDANCE}`)
    lines.push('')
    const write = (title: string, items: WorkItem[]) => {
      if (!items.length) return
      lines.push(`### ${title}`)
      lines.push('')
      for (const w of items) {
        lines.push(`- **${w.number}** on ${w.on}${w.status === 'in_progress' ? ' (in progress)' : ''}: ${w.body}`)
        if (w.quote && !w.on.includes('the words “')) lines.push(`  - Currently says: “${w.quote}”`)
        if (w.suggestedCopy) lines.push(w.on.includes('the words “') ? `  - Replace “${w.quote}” with exactly: “${w.suggestedCopy}”` : `  - Use exactly: “${w.suggestedCopy}”`)
        for (const r of w.replies) lines.push(`  - ${r.by}: ${r.text}`)
      }
      lines.push('')
    }
    write('Must fix', wp.must_fix)
    write('Small fixes', wp.nits)
    write('Questions', wp.questions)
    write('Keep as is', wp.keeps)
    write('Resolved, waiting for the person to verify', wp.awaiting_verification)
  }
  const media = page.sections.flatMap((s) => s.media.map((m) => ({ ...m, section: `${s.position + 1}. ${TYPE_LABEL[s.type]}` })))
  if (media.length) {
    lines.push('## Images')
    lines.push('')
    for (const m of media) {
      const playback = m.kind !== 'image' ? `, plays ${m.play === 'inview' ? 'when in view' : m.play === 'scrub' ? 'with the scroll' : m.play === 'hover' ? 'on hover' : m.play === 'autoplay' ? 'automatically (muted)' : 'on click'}${m.loop ? ', loops' : ''}` : ''
      const what =
        m.source === 'placeholder'
          ? 'placeholder from the palette (replace with a real image before launch)'
          : m.source === 'upload'
            ? 'uploaded image'
            : m.source === 'stock'
              ? 'stock photo'
              : m.source === 'embed'
                ? `video embed (${m.player?.includes('vimeo') ? 'Vimeo' : 'YouTube'}; poster first, player loads on click)`
                : `${m.kind === 'lottie' ? 'Lottie animation' : 'video'}${playback}`
      const lb = m.lightbox ? ', opens in a lightbox' : ''
      lines.push(`- **${m.label}** (${m.section}): ${what}${lb}, \`${m.src || m.player}\`${m.alt ? `, alt “${m.alt}”` : ', no alt text yet (add one unless it’s decorative)'}`)
      if (m.credit) lines.push(`  - Credit: ${m.credit}. Keep the hotlinked URL and show this credit, as Unsplash requires.`)
    }
    lines.push('')
    if (page.moving) lines.push('Moving media and lightboxes run on `/mx-media.js` (triggers, reduced motion, lazy embeds, a `<dialog>` lightbox). It loads the dotLottie player from a CDN; swap in the `@lottiefiles/dotlottie-web` package if you prefer bundling it.')
    lines.push('')
    lines.push('Optimise the files in `public/media/` before shipping (videos too: `dinky compress-video`). With Dinky’s CLI (dinkyfiles.com): `dinky compress-image public/media/*.webp -f webp -w 1600 --strip-metadata --json -o public/media`, keeping file names so references still match.')
    lines.push('')
  }
  if (page.sections.some((s) => /data-mx-icon|<svg/.test(s.clip.html))) {
    const set = iconSet(guide.tokens['icon.set'])
    lines.push('## Icons')
    lines.push('')
    lines.push(`Icons are drawn from ${set.label} (${PACK_CREDIT[set.pack]}), inline as SVG in each section. Keep to that one set; if you need an icon that isn’t there, take it from the same pack and weight.`)
    lines.push('')
  }
  if (i.notes?.length) {
    lines.push('## Notes')
    lines.push('')
    for (const n of i.notes) lines.push(`- ${n}`)
    lines.push('')
  }
  lines.push('## Style guide')
  lines.push('')
  lines.push('| Token | Value | From |')
  lines.push('|---|---|---|')
  for (const [k, value] of Object.entries(guide.tokens)) {
    lines.push(`| ${TOKEN_LABEL[k as keyof typeof TOKEN_LABEL]} (\`${k}\`) | \`${value}\` | ${provenanceLabel(library, guide.provenance[k as keyof typeof guide.provenance])} |`)
  }
  lines.push('')
  if (guide.conflicts.length) {
    lines.push('## Resolved contradictions')
    lines.push('')
    for (const c of guide.conflicts) {
      const rejected = c.options.filter((o) => o.value !== c.current).map((o) => `\`${o.value}\` (${o.candidateIds.map((id) => sourceLabel(library, id)).join(', ')})`)
      lines.push(`- **${TOKEN_LABEL[c.key]}**: \`${c.current}\`${c.resolved ? '' : ' *(not yet decided: latest promotion wins)*'}; rejected ${rejected.join(', ') || 'nothing'}`)
    }
    lines.push('')
  }
  lines.push('## Rules for the agent')
  lines.push('')
  AGENT_RULES.forEach((r, n) => lines.push(`${n + 1}. ${r}`))
  lines.push('')
  lines.push('## Files')
  lines.push('')
  lines.push('- `blokmix.json`: machine-readable packet (tokens, sections, provenance, conflicts)')
  lines.push('- `tokens.css` / `tokens.json`: the style guide as CSS variables and W3C design tokens')
  lines.push('- `reference.html`: the composed page as one static file')
  if (i.targets.includes('astro')) lines.push('- `astro/`: runnable Astro project (`npm i && npm run dev`)')
  if (i.targets.includes('next')) lines.push('- `next/`: runnable Next.js App Router project (`npm i && npm run dev`)')
  lines.push('')
  if (page.pages.length) {
    lines.push('## Other pages')
    lines.push('')
    lines.push(`Links on this page lead to ${page.pages.map((p) => `\`${p}\``).join(', ')}. Create those pages with the same layout, tokens and nav, even if only as a simple page for now, so no link is broken. Sections link to each other by their anchors (\`#pricing\`).`)
    lines.push('')
  }
  lines.push('## Content')
  lines.push('')
  lines.push('Each section’s words are a JSON file (`src/content/` in Astro, `content/` in Next.js); the page imports it and passes it to the section as `content`. Lists are arrays: where a list’s items are built alike, the component maps over the array, so adding an entry adds an item; items that differ (their own icons, pictures or looks) are written one by one and read their entry by position.')
  lines.push('')
  lines.push('Every element with words has `data-mx-src="<file>#<path>"` (like Koati’s `data-koati-src`), so a picker or an agent can find where its words live.')
  lines.push('')
  lines.push('Want a visual editor for these files? [Keystatic](https://keystatic.com) reads and writes local JSON: point a singleton at each file. Optional; nothing in the build depends on it.')
  lines.push('')
  return lines.join('\n')
}

/** What a coding agent should do with this packet, ending in the review loop. `run` names the build when Blokmix started one. */
export function agentPrompt(i: PacketInput, target: BuildTarget, run?: { build: string; dir: string }): string {
  const t = target === 'astro' ? 'Astro' : 'Next.js (App Router)'
  const dir = target === 'astro' ? 'astro/' : 'next/'
  const build = run ? `"${run.build}"` : 'the build letter prepare_build returned'
  return `Build the "${i.mixName}" landing page in ${t} from this Blokmix packet${i.version ? ` (version ${i.version.letter})` : ''}.

1. Read BLOKMIX.md (build notes) and blokmix.json.
2. Start from the reference build in ${dir}; it already composes ${i.page.sections.length} section components with the resolved style guide in tokens.css.
3. Follow the per-section instructions (layout, style, copy, motion) and the rules at the end of BLOKMIX.md, especially: use only the tokens in tokens.css.
4. Replace any copy listed as retained source copy, and any logos or imagery, with project-appropriate content. Words live in the content folder's JSON files; edit them there.
5. Run the dev server, compare against reference.html, and fix any visual drift at 1440px and 390px.

## Report back to Blokmix

With the blokmix MCP server connected${run ? '' : ' (start with prepare_build, which writes this packet to disk and opens the build on the canvas)'}:
- As you go, call report_build {build: ${build}, step: "…"} with a few words per step, so the canvas shows progress.
- Once the dev server runs, call report_build with preview_url (e.g. http://localhost:${target === 'astro' ? 4321 : 3000}) and preview_height: the page's full height in CSS px at each width, {"1440": …, "390": …}. The preview shows on the build's frame.
- Call report_build with done: true when it's ready.

## Review loop (ReviseMy)

If the ReviseMy MCP server is connected, have the page reviewed and bring the marks back:
1. create_review: for a localhost preview, send full-page screenshots at ${REVIEW_WIDTHS.join(' and ')}px wide as images; for a deployed preview, use capture_url with page_url.
2. wait_for_review until the person decides (call it again when it returns unchanged).
3. import_review_marks {version: ${build}, review: {id, url, status}, marks}: map each work_packets.pins entry to {id, kind (its severity), status, verified_by_person (only if a person verified it), body, suggested_copy, x, y (fractions of the screenshot: the pin's point, or its area's top-left when it has an area), w, h (the area's size), width (the screenshot's CSS width), section (the id of the section element under the point, e.g. "pricing")}. Running it again updates the same notes.
4. Fix the marks: must-fix first, use suggested copy exactly, never change a keep. Run report_build with a step as you go.
5. For each fix, call ReviseMy resolve_marks {id: review id, marks: [{id: mark id, status: "resolved", note}]} and Blokmix update_note {note, status: "resolved", resolution}. list_notes shows each mark's ReviseMy ids under external. Answer questions with reply_to_marks and reply_note. Only a person verifies.
6. After changes are requested, open the next pass with create_review {parent_id} and repeat.
`
}

export function packetFiles(i: PacketInput): FileMap {
  const files: FileMap = {
    'blokmix.json': JSON.stringify(packetJson(i), null, 2) + '\n',
    'BLOKMIX.md': buildNotes(i),
    'tokens.css': tokensCss(i.page),
    'tokens.json': JSON.stringify(toDtcg(i.guide.tokens), null, 2) + '\n',
    'reference.html': referenceHtml(i.page),
  }
  for (const t of i.targets) files[`PROMPT.${t}.md`] = agentPrompt(i, t)
  if (i.targets.includes('astro')) Object.assign(files, astroFiles(i.page))
  if (i.targets.includes('next')) Object.assign(files, nextFiles(i.page))
  return files
}

function packetsOf(i: PacketInput) {
  return workPackets(
    i.marks ?? [],
    i.page.sections.map((s) => ({ slotId: s.slotId, position: s.position + 1, type: s.type, component: s.component, label: TYPE_LABEL[s.type] })),
  )
}
