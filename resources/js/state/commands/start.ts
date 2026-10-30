import { type CommandInput } from '@/core/commands/schema'
import type { StartInput } from '@/core/start'
import { scoredStarts, type ScoredStart } from '@/lib/start'
import { allSlots } from '@/core/site'
import { useStore } from '../store'
import { CommandError } from './refs'
import type { AsyncCommand } from './index'

type Answers = CommandInput<'suggest_starts'>
const answers = (i: Answers): StartInput => ({ kind: i.kind, name: i.name, oneLiner: i.one_liner, vibe: i.vibe, brand: i.brand, mode: i.mode, seed: i.seed })

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
    prepare: (i: Answers) => scoredStarts(answers(i)),
    apply: (_i: Answers, starts: ScoredStart[]) => starts.map(describe),
  } satisfies AsyncCommand<ScoredStart[]>,
  apply_start: {
    prepare: (i: CommandInput<'apply_start'>) => scoredStarts(answers(i)),
    apply: (i: CommandInput<'apply_start'>, starts: ScoredStart[]) => {
      const pick = starts[i.start - 1]
      if (!pick) throw new CommandError(`There are only ${starts.length} starts for those answers`)
      useStore.getState().applyStart(pick)
      return describe(pick, i.start - 1)
    },
  } satisfies AsyncCommand<ScoredStart[]>,
}
