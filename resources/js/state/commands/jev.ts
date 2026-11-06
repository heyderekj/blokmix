// Jev's commands: each asks first (async prepare), then lands as one undo step (apply).

import type { CommandInput } from '@/core/commands/schema'
import type { MediaFill } from '@/core/types'
import { allSlots, pageView } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import type { LinkGuess } from '@/core/jev/links'
import { firstScreenWords, fiveSecondRequest, readFiveSecond, type FiveSecondRead, type FirstScreen } from '@/core/jev/fiveSecond'
import { linkWords } from '@/core/links'
import { scorePage, SCREENS, type PageMeasure, type PageScore } from '@/core/score'
import { slotClip } from '@/data/library'
import { measureFirstScreen } from '@/lib/measure'
import { askJev, JEV_OFF, jevOn, setJevAllowed } from '@/lib/jev'
import { useStore } from '../store'
import { deadLinks, guessLinks } from '../jevLinks'
import { findFocus } from '../jevPhotos'
import { hear, type Heard } from '../jevSay'
import { CommandError, findBlock, findPage, findSection, placeOf, wordsFor } from './refs'
import type { AsyncCommand } from './index'

// This device's switch decides whether Jev may help ("Let Jev help" in the menu).
setJevAllowed(() => useStore.getState().ui.jev !== false)

async function needJev() {
  if (!(await jevOn())) throw new CommandError(JEV_OFF)
}

/** The open page's sections (or another page's), the shared nav and footer included. */
function pageSlots(page?: string) {
  const { site } = useStore.getState()
  return pageView(site, findPage(page).id)
}

const describeGuess = (g: LinkGuess) => {
  const slot = useStore.getState().site && findSection(g.slotId)
  return { section: placeOf(slot), block: findBlock(slot, g.blockId).label, words: g.words, goes_to: g.label, sure: Math.round(g.p * 100) / 100 }
}

/** The first screen at a laptop and a phone, and the laptop's words sorted for a visitor. */
async function firstScreen(pageId: string): Promise<{ byWidth: Record<number, PageMeasure>; words: FirstScreen }> {
  const st = useStore.getState()
  const data = { site: st.site, guide: st.guide, content: st.content }
  const laptop = await measureFirstScreen(data, SCREENS.laptop.width, SCREENS.laptop.height, pageId)
  const phone = await measureFirstScreen(data, SCREENS.phone.width, SCREENS.phone.height, pageId)
  const slots = new Map(allSlots(st.site).map((s) => [s.id, s]))
  const shown = (laptop.shown ?? []).flatMap(({ slot, block }) => {
    const s = slots.get(slot)
    const clip = s && slotClip(s)
    const b = clip?.blocks.find((x) => x.id === block)
    return s && clip && b ? [{ block: b, words: linkWords(b, clip.blocks, wordsFor(s)), sectionType: s.type }] : []
  })
  return { byWidth: { [laptop.width]: laptop, [phone.width]: phone }, words: firstScreenWords(shown) }
}

export interface FiveSecond {
  read: FiveSecondRead | null
  score: PageScore
  words: FirstScreen
}

/** The five-second test for a page: Jev's read of its first screen, joined with the measured checks. */
export async function fiveSecondTest(page?: string): Promise<FiveSecond> {
  await needJev()
  const p = findPage(page)
  const { byWidth, words } = await firstScreen(p.id)
  const res = await askJev(fiveSecondRequest(words))
  const read = readFiveSecond(res, words, useStore.getState().content.kind)
  return { read, score: scorePage(byWidth, read?.checks ?? []), words }
}

export const later = {
  place_links: {
    prepare: async (i: CommandInput<'place_links'>) => {
      await needJev()
      const slots = i.section !== undefined ? [findSection(i.section, i.page)] : pageSlots(i.page)
      return guessLinks(deadLinks(slots))
    },
    apply: (i: CommandInput<'place_links'>, guesses: LinkGuess[]) => {
      const st = useStore.getState()
      const set = guesses.filter((g) => g.target && (g.route === 'act' || (!i.sure_only && g.route === 'offer')))
      for (const g of set) st.editBlock(g.slotId, g.blockId, { link: g.target! })
      const rest = guesses.filter((g) => !set.includes(g) && g.route !== 'none')
      return {
        set: set.map(describeGuess),
        suggestions: rest.map(describeGuess),
        message: set.length
          ? `Pointed ${set.length} link${set.length === 1 ? '' : 's'} where ${set.length === 1 ? 'its' : 'their'} words lead.`
          : guesses.length
            ? 'Jev has ideas but isn’t sure enough to set them; see suggestions.'
            : `Every link here already leads somewhere${i.section !== undefined ? ` in ${TYPE_LABEL[findSection(i.section, i.page).type]}` : ''}.`,
      }
    },
  } satisfies AsyncCommand<LinkGuess[]>,
  five_second_test: {
    prepare: (i: CommandInput<'five_second_test'>) => fiveSecondTest(i.page),
    apply: (_i: CommandInput<'five_second_test'>, r: FiveSecond) => ({
      visitor: r.read?.words ?? 'Jev didn’t answer; try again.',
      guess: r.read?.kind ?? null,
      torn_between: r.read?.torn ?? null,
      sure: r.read ? Math.round(r.read.p * 100) / 100 : null,
      first_screen: r.words,
      score: r.score.score,
      checks: r.score.checks.map((c) => `${c.ok ? '✓' : c.weight ? '✗' : '·'} ${c.words}`),
    }),
  } satisfies AsyncCommand<FiveSecond>,
  understand: {
    prepare: async (i: CommandInput<'understand'>) => {
      await needJev()
      return hear(i.text)
    },
    apply: (_i: CommandInput<'understand'>, h: Heard | null) => {
      const show = (a: NonNullable<Heard['action']>) => ({ does: a.words, command: a.command ?? null, input: a.input ?? null, opens: a.open ?? null, sure: Math.round(a.sure * 100) / 100 })
      return { action: h?.action ? show(h.action) : null, options: (h?.options ?? []).map(show), contract: h?.kept ?? null }
    },
  },
  find_subject: {
    prepare: async (i: CommandInput<'find_subject'>) => {
      await needJev()
      const slot = findSection(i.section)
      const b = findBlock(slot, i.block)
      if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block`)
      const fill = slot.edits?.[slot.clipId]?.[b.id]?.media
      if (!fill || (fill.source !== 'upload' && fill.source !== 'stock')) throw new CommandError(`${b.label} shows no photo; set_image or an upload first`)
      return { slotId: slot.id, blockId: b.id, label: b.label, fill, focus: await findFocus(fill) }
    },
    apply: (_i: CommandInput<'find_subject'>, r: { slotId: string; blockId: string; label: string; fill: MediaFill; focus: Awaited<ReturnType<typeof findFocus>> }) => {
      if (!r.focus) return { block: r.label, focus: null, message: 'No single subject to keep in frame (or Jev wasn’t sure); the crop stays centered.' }
      useStore.getState().editBlock(r.slotId, r.blockId, { media: { ...r.fill, focus: { x: r.focus.x, y: r.focus.y } } })
      return { block: r.label, focus: { x: r.focus.x, y: r.focus.y }, subject: r.focus.kind }
    },
  },
}
