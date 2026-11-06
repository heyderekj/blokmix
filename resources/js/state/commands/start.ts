import { type CommandInput } from '@/core/commands/schema'
import type { StartInput } from '@/core/start'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { hearStart, startsFromText, type Heard } from '@/lib/startFromText'
import { jevOn } from '@/lib/jev'
import type { Kind } from '@/core/types'
import { allSlots } from '@/core/site'
import { skinById, skinList, skinOpen } from '@/core/skins'
import { library } from '@/data/library'
import { useStore } from '../store'
import { CommandError } from './refs'
import type { AsyncCommand } from './index'

type Answers = CommandInput<'suggest_starts'>
const answers = (i: Answers, kind: Kind): StartInput => ({ kind, name: i.name, oneLiner: i.one_liner, skin: i.skin, brand: i.brand, mode: i.mode, seed: i.seed, sections: i.sections })

interface Prepared {
  starts: ScoredStart[]
  heard: Heard | null
}

/** From the answers, or from the box's text through Jev. */
async function prepare(i: Answers): Promise<Prepared> {
  if (!i.text?.trim()) {
    if (!i.kind) throw new CommandError('Say what kind of site it is (kind), or give the words they typed (text)')
    return { starts: await scoredStarts(answers(i, i.kind)), heard: null }
  }
  if (!(await jevOn())) throw new CommandError('Starting from text needs Jev: turn on “Let Jev help” in Blokmix’s menu (the server needs a TypeSafe key)')
  const heard = await hearStart(i.text, i.kind)
  if (!heard) throw new CommandError('Jev didn’t answer. Try again, or give a kind instead of text.')
  const kind = i.kind ?? heard.kind ?? heard.kinds[0] ?? 'studio'
  return { starts: await startsFromText(answers(i, kind), heard), heard }
}

const heardOf = (h: Heard | null) =>
  h && { mode: h.mode === 'paste' ? 'your words, placed as written' : 'a description', kind: h.kind, sections: h.sections, looks: h.looks, ...(h.mode === 'paste' ? { lines: h.lines, placed: h.placed, waiting: h.waiting } : {}) }

/** A start as an agent reads it: where it came from, its pages' sections, and how it measured up. */
const describe = (s: ScoredStart, i: number) => ({
  start: i + 1,
  label: s.label,
  starter: s.starterId,
  pages: s.site.pages.map((p) => ({ path: p.path, sections: [p.show.nav ? s.site.shared.nav : undefined, ...p.slots, p.show.footer ? s.site.shared.footer : undefined].filter(Boolean).map((x) => x!.clipId) })),
  sections: allSlots(s.site).length,
  shelves: s.shelves,
  score: s.score.score,
  checks: s.score.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.words}`),
  phone_screens: s.score.phoneScreens,
})

/** The guided start: suggest three measured starts, and put one on the board. Both measure first, so both are async. */
export const later = {
  suggest_starts: {
    prepare,
    apply: (_i: Answers, p: Prepared) => (p.heard ? { heard: heardOf(p.heard), starts: p.starts.map(describe) } : p.starts.map(describe)),
  } satisfies AsyncCommand<Prepared>,
  apply_start: {
    prepare: (i: CommandInput<'apply_start'>) => prepare(i),
    apply: (i: CommandInput<'apply_start'>, { starts }: Prepared) => {
      const pick = starts[i.start - 1]
      const skin = i.skin ? skinById(i.skin) : null
      if (i.skin && !skin) throw new CommandError(`No skin called "${i.skin}". Skins: ${skinList().map((s) => s.id).join(', ')}`)
      if (skin && !skinOpen(library, skin)) throw new CommandError(`The ${skin.name} skin needs a mix pack`)
      if (!pick) throw new CommandError(`There are only ${starts.length} starts for those answers`)
      useStore.getState().applyStart(pick)
      return describe(pick, i.start - 1)
    },
  } satisfies AsyncCommand<Prepared>,
}
