import { type CommandInput } from '@/core/commands/schema'
import { recipeFor, type StartInput } from '@/core/start'
import { kindOf, patchBrief, type Brief } from '@/core/brief'
import { scoredVersions, type ScoredVersion } from '@/lib/start'
import { applyRead, emptyStart, startView } from '@/core/startFlow'
import { keywordRead } from '@/core/reader'
import { textMode } from '@/core/jev/describe'
import { askReader, readerOn } from '@/lib/reader'
import { rankThemes } from '@/core/themeRanking'
import type { ScoredStart } from '@/lib/start'
import { hearStart, startsFromText, type Heard } from '@/lib/startFromText'
import { jevOffMessage, jevOn } from '@/lib/jev'
import type { Kind } from '@/core/types'
import { allSlots } from '@/core/site'
import { skinById, skinList } from '@/core/skins'
import { useStore } from '../store'
import { CommandError } from './refs'
import type { AsyncCommand } from './index'

type Answers = CommandInput<'suggest_starts'>
/** The brief the answers give: theirs, over what was heard. */
const briefOf = (i: Answers, heard: Heard | null): Brief =>
  patchBrief(
    { ...(heard?.format ? { format: heard.format } : {}), ...(heard?.industry ? { industry: heard.industry } : {}), ...(heard?.goals.length ? { goals: heard.goals } : {}), ...(heard?.mode === 'describe' && i.text ? { what: i.text.trim() } : {}) },
    // Only what was given: an answer left out keeps what was heard.
    Object.fromEntries(Object.entries({ format: i.format, industry: i.industry, goals: i.goals, mainAction: i.main_action, mainActionTyped: i.main_action ? true : undefined, who: i.who }).filter(([, x]) => x !== undefined)),
  )
const answers = (i: Answers, kind: Kind, heard: Heard | null = null, read: Partial<StartInput> = {}): StartInput => {
  const brief = patchBrief(patchBrief(read.brief ?? {}, briefOf(i, heard)), { ...(i.feel ? { feel: i.feel } : {}), ...(i.avoid ? { avoid: i.avoid } : {}) })
  // Goals add their sections to a described page (pasted words decide their own).
  const sections = i.sections ?? read.sections ?? (heard?.mode === 'paste' ? undefined : brief.goals?.length || brief.format ? recipeFor(brief, kind, heard?.want) : undefined)
  const pages = i.pages?.map((p) => ({ template: p.template, purpose: p.purpose ?? null })) ?? read.pages
  return { kind, name: i.name, oneLiner: i.one_liner, skin: i.skin, brand: i.brand, mode: i.mode ?? read.mode, seed: i.seed, sections, brief, ...(pages?.length ? { pages } : {}) }
}

/** A start and how it measured up, whichever way it was made. */
type Measured = { start: ScoredStart; why?: string; direction?: string }

interface Prepared {
  starts: Measured[]
  heard: Record<string, unknown> | null
}

const fromVersions = (vs: ScoredVersion[]): Measured[] => vs.map((v) => ({ start: { ...v.start, score: v.score }, why: v.why, direction: v.direction }))

/** From the answers; a description read by the reader (else keywords); a long paste of their copy through Jev. */
async function prepare(i: Answers): Promise<Prepared> {
  const opts = { count: i.count ?? 3, vary: i.vary ?? 'layout' } as const
  const text = i.text?.trim()
  if (!text) {
    const kind = i.kind ?? (i.format || i.industry ? kindOf({ format: i.format, industry: i.industry }) : null)
    if (!kind) throw new CommandError('Say what kind of site it is (kind or format), or give the words they typed (text)')
    return { starts: fromVersions(await scoredVersions(answers(i, kind), opts)), heard: null }
  }
  if (textMode(text) === 'paste') {
    if (!(await jevOn())) throw new CommandError(await jevOffMessage())
    const heard = await hearStart(text, i.kind, 'paste')
    if (!heard) throw new CommandError('No answer this time. Try again, or give a kind instead of text.')
    const kind = i.kind ?? (i.format || i.industry ? kindOf({ format: i.format ?? heard.format ?? undefined, industry: i.industry ?? heard.industry ?? undefined }) : (heard.kind ?? heard.kinds[0] ?? 'studio'))
    const starts = await startsFromText(answers(i, kind, heard), heard)
    return { starts: starts.slice(0, opts.count).map((start) => ({ start })), heard: pastedOf(heard) }
  }
  // A description: read it the way the start screen does, then your answers on top.
  const by = (await readerOn()) ? 'the reader' : 'keywords'
  const read = (by === 'the reader' ? await askReader('start', text) : null) ?? keywordRead(text)
  const st = applyRead(emptyStart(), read)
  const v = startView(st)
  const kind = i.kind ?? (i.format || i.industry ? kindOf({ ...v.brief, format: i.format ?? v.brief.format, industry: i.industry ?? v.brief.industry }) : v.kind)
  const input = answers(i, kind, null, { brief: v.brief, sections: v.sections, pages: st.pages, ...(st.tone ? { mode: st.tone } : {}) })
  return {
    starts: fromVersions(await scoredVersions(input, opts)),
    heard: {
      mode: 'a description',
      by,
      kind,
      name: v.name || null,
      format: input.brief?.format ?? null,
      industry: input.brief?.industry ?? null,
      goals: input.brief?.goals ?? [],
      sections: input.sections ?? [],
      pages: (input.pages ?? []).map((p) => p.template),
      feel: input.brief?.feel ?? [],
      avoid: input.brief?.avoid ?? [],
      looks: rankThemes({ brief: input.brief }).map((r) => r.skin.id),
    },
  }
}

const pastedOf = (h: Heard) => ({ mode: 'your words, placed as written', kind: h.kind, format: h.format, industry: h.industry, goals: h.goals, sections: h.sections, looks: h.looks, lines: h.lines, placed: h.placed, waiting: h.waiting })

/** A start as an agent reads it: where it came from, its pages' sections, and how it measured up. */
const describe = ({ start: s, why, direction }: Measured, i: number) => ({
  start: i + 1,
  label: s.label,
  ...(why && why !== s.label ? { why } : {}),
  ...(direction ? { direction } : {}),
  starter: s.starterId,
  pages: s.site.pages.map((p) => ({ path: p.path, sections: [p.show.nav ? s.site.shared.nav : undefined, ...p.slots, p.show.footer ? s.site.shared.footer : undefined].filter(Boolean).map((x) => x!.clipId) })),
  sections: allSlots(s.site).length,
  shelves: s.shelves,
  score: s.score.score,
  checks: s.score.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.words}`),
  phone_screens: s.score.phoneScreens,
})

/** The guided start: suggest measured starts, and put one on the board. Both measure first, so both are async. */
export const later = {
  suggest_starts: {
    prepare,
    apply: (_i: Answers, p: Prepared) => (p.heard ? { heard: p.heard, starts: p.starts.map(describe) } : p.starts.map(describe)),
  } satisfies AsyncCommand<Prepared>,
  apply_start: {
    prepare: (i: CommandInput<'apply_start'>) => prepare(i),
    apply: (i: CommandInput<'apply_start'>, { starts }: Prepared) => {
      const pick = starts[i.start - 1]?.start
      const skin = i.skin ? skinById(i.skin) : null
      if (i.skin && !skin) throw new CommandError(`No skin called "${i.skin}". Skins: ${skinList().map((s) => s.id).join(', ')}`)
      if (!pick) throw new CommandError(`There are only ${starts.length} starts for those answers`)
      useStore.getState().applyStart(pick)
      return describe(starts[i.start - 1], i.start - 1)
    },
  } satisfies AsyncCommand<Prepared>,
}
