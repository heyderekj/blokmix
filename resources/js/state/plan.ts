import { create } from 'zustand'
import { library } from '@/data/library'

/**
 * Whether the open mix can use what Plus opens (core/plan.ts): its owner bought one, or there's no Laravel.
 * `library.paid` is what core reads (pickable, matching, starters); the board subscribes through `useAccount`.
 */
export const paid = () => library.paid !== false

/** The buy sheet, open when something needs Plus. `what` names it ("That layout"). */
export const useBuySheet = create<{ open: boolean; what: string | null }>()(() => ({ open: false, what: null }))

/** A command asked for something the open mix's plan doesn't have. */
export class PlusRefusal extends Error {}

let strict = 0
/** Run commands for an agent: what needs Plus throws (and the agent hears why) instead of opening the sheet. */
export function strictly<T>(run: () => T): T {
  strict++
  try {
    return run()
  } finally {
    strict--
  }
}

/** True (stop) when the open mix's owner is on Free: the buy sheet opens, or, for an agent, a PlusRefusal is thrown. */
export function needsPlus(what: string): boolean {
  if (paid()) return false
  if (strict) throw new PlusRefusal(`${what} needs Plus, and this mix’s owner is on Free. Free has the core layouts, the Feel dials, Light/Dark, brand colors and fonts.`)
  useBuySheet.setState({ open: true, what })
  return true
}
