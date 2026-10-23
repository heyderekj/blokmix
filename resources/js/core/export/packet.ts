import type { BlockEdit, Note } from '../types'
import { MARK_GUIDANCE, workPackets, type WorkItem } from '../notes'
import { describeBlockMotion, describeSectionMotion } from '../motion'
import type { BuildTarget, GuideState, Library, ResolvedGuide, Status } from '../types'
import type { ComposedPage } from '../compose'
import { GROUP_LABEL, TOKEN_LABEL, toDtcg } from '../tokens'
import { openGroups } from '../guide'
import { TYPE_LABEL } from '../content'
import { astroFiles } from './astro'
import { nextFiles } from './next'
import { referenceHtml } from './reference-html'
import { keepSummary, tokensCss, type FileMap } from './shared'

export const PACKET_SCHEMA = 'mixtape.packet/v1'

export interface PacketInput {
  page: ComposedPage
  guide: ResolvedGuide
  guideState: GuideState
  library: Library
  tapeName: string
  version?: { id: string; letter: string; title: string; status: Status; parentLetter?: string } | null
  targets: BuildTarget[]
  notes?: string[]
  /** Feedback marks on this tape (or version). */
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
]

function sourceLabel(lib: Library, candidateId: string): string {
  const clipId = candidateId.split('#')[0]
  const clip = lib.clips[clipId]
  if (!clip) return candidateId
  return `${lib.sources[clip.sourceId]?.name ?? clip.sourceId} (${clip.id})`
}

function provenanceLabel(lib: Library, p: string): string {
  if (p === 'base') return 'Mixtape default'
  if (p === 'custom') return 'custom'
  return sourceLabel(lib, p)
}

export function packetJson(i: PacketInput) {
  const { page, guide, library } = i
  return {
    schema: PACKET_SCHEMA,
    generatedAt: i.generatedAt ?? new Date().toISOString(),
    tape: {
      name: i.tapeName,
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
      media: s.media.map((m) => ({ block: m.label, source: m.source, src: m.src, alt: m.alt, credit: m.credit })),
      blocks: s.blocks.map((b) => ({ id: b.id, label: b.label, kind: b.kind, variant: b.edit.variant ?? null, style: b.edit.style ?? null, hidden: !!b.edit.hidden })),
      notes: s.notes,
      html: s.clip.html,
      css: s.clip.css,
      motionCss: s.clip.motionCss,
    })),
    rules: AGENT_RULES,
    integrations: { revisemy: null, koati: null },
  }
}

export function linerNotes(i: PacketInput): string {
  const { page, guide, library } = i
  const v = i.version
  const lines: string[] = []
  lines.push(`# ${i.tapeName}${v ? ` · Version ${v.letter}` : ' · Working mix'}`)
  lines.push('')
  lines.push('> Liner notes for an agent. Build this page in ' + i.targets.map((t) => (t === 'astro' ? 'Astro' : 'Next.js')).join(' or ') + ' from the reference build in this packet.')
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
    if (s.clip.origin === 'layout') lines.push('- **From:** a Mixtape layout. It’s structural, not a captured site: restyle it freely with the style guide.')
    else lines.push(`- **Clipped from:** ${src?.name ?? s.clip.sourceId}, ${s.clip.capture.url} (\`${s.clip.capture.selector}\`, ${s.clip.capture.viewport.width}px)`)
    lines.push(`- **Pattern:** ${s.clip.layoutPattern}: ${s.clip.title}`)
    lines.push(`- **Layout:** ${s.keep.layout ? 'reproduce the structure faithfully' : 'reference only; choose a structure that fits neighboring sections'}`)
    lines.push(`- **Style:** ${s.keep.style ? 'keeps its own captured tokens (scoped to the section)' : 'use the style guide tokens'}`)
    lines.push(`- **Copy:** ${s.keep.content ? 'source copy kept (replace before launch)' : 'your copy'}${s.retained.length ? `; still source copy: ${s.retained.join(', ')}` : ''}`)
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
      const what = m.source === 'placeholder' ? 'placeholder from the palette (replace with a real image before launch)' : m.source === 'upload' ? 'uploaded image' : 'stock photo'
      lines.push(`- **${m.label}** (${m.section}): ${what}, \`${m.src}\`${m.alt ? `, alt “${m.alt}”` : ', no alt text yet (add one unless it’s decorative)'}`)
      if (m.credit) lines.push(`  - Credit: ${m.credit}. Keep the hotlinked URL and show this credit, as Unsplash requires.`)
    }
    lines.push('')
    lines.push('Optimise the files in `public/media/` before shipping. With Dinky’s CLI (dinkyfiles.com): `dinky compress-image public/media/*.webp -f webp -w 1600 --strip-metadata --json -o public/media`, keeping file names so references still match.')
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
  lines.push('- `mixtape.json`: machine-readable packet (tokens, sections, provenance, conflicts)')
  lines.push('- `tokens.css` / `tokens.json`: the style guide as CSS variables and W3C design tokens')
  lines.push('- `reference.html`: the composed page as one static file')
  if (i.targets.includes('astro')) lines.push('- `astro/`: runnable Astro project (`npm i && npm run dev`)')
  if (i.targets.includes('next')) lines.push('- `next/`: runnable Next.js App Router project (`npm i && npm run dev`)')
  lines.push('')
  return lines.join('\n')
}

export function agentPrompt(i: PacketInput, target: BuildTarget): string {
  const t = target === 'astro' ? 'Astro' : 'Next.js (App Router)'
  const dir = target === 'astro' ? 'astro/' : 'next/'
  return `Build the "${i.tapeName}" landing page in ${t} from this Mixtape packet${i.version ? ` (version ${i.version.letter})` : ''}.

1. Read MIXTAPE.md (liner notes) and mixtape.json.
2. Start from the reference build in ${dir}; it already composes ${i.page.sections.length} section components with the resolved style guide in tokens.css.
3. Follow the per-section instructions (layout, style, copy, motion) and the rules at the end of MIXTAPE.md, especially: use only the tokens in tokens.css.
4. Replace any copy listed as retained source copy, and any logos or imagery, with project-appropriate content.
5. Run the dev server, compare against reference.html, and fix any visual drift at 1440px and 390px.

When you're done, report the preview URL so it can be attached to the version on the Mixtape canvas.
`
}

export function packetFiles(i: PacketInput): FileMap {
  const files: FileMap = {
    'mixtape.json': JSON.stringify(packetJson(i), null, 2) + '\n',
    'MIXTAPE.md': linerNotes(i),
    'tokens.css': tokensCss(i.page),
    'tokens.json': JSON.stringify(toDtcg(i.guide.tokens), null, 2) + '\n',
    'reference.html': referenceHtml(i.page),
  }
  for (const t of i.targets) files[`PROMPT.${t}.md`] = agentPrompt(i, t)
  if (i.targets.includes('astro')) Object.assign(files, astroFiles(i.page))
  if (i.targets.includes('next')) Object.assign(files, nextFiles(i.page))
  return files
}

function describeEdit(e: BlockEdit): string {
  if (e.hidden) return 'hidden; leave it out'
  const parts: string[] = []
  if (e.variant) parts.push(`${e.variant} look`)
  const m = describeBlockMotion(e.motion)
  if (m) parts.push(m)
  for (const [k, v] of Object.entries(e.style ?? {}) as [string, string | undefined][]) if (v) parts.push(`${k} ${v.replace('x:', 'brand colour ')}`)
  return `${parts.join(', ')} (the section CSS has it in @layer blocks)`
}

function packetsOf(i: PacketInput) {
  return workPackets(
    i.marks ?? [],
    i.page.sections.map((s) => ({ slotId: s.slotId, position: s.position + 1, type: s.type, component: s.component, label: TYPE_LABEL[s.type] })),
  )
}
