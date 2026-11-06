// Jev's commands: each asks first (async prepare), then lands as one undo step (apply).

import type { CommandInput } from '@/core/commands/schema'
import type { MediaFill } from '@/core/types'
import { allSlots, pageView } from '@/core/site'
import { TYPE_LABEL } from '@/core/content'
import type { LinkGuess } from '@/core/jev/links'
import { firstScreenWords, fiveSecondRequest, readFiveSecond, type FiveSecondRead, type FirstScreen } from '@/core/jev/fiveSecond'
import { linkWords } from '@/core/links'
import { scorePage, SCREENS, type PageMeasure, type PageScore } from '@/core/score'
import { library, slotClip } from '@/data/library'
import { fitsFor, layoutTitle, readsAs } from '../wordsFit'
import { retypeSection } from '../retype'
import { measureFirstScreen } from '@/lib/measure'
import { askJev, jevOffMessage, jevOn, setJevAllowed } from '@/lib/jev'
import { useStore } from '../store'
import { deadLinks, guessLinks } from '../jevLinks'
import { findFocus } from '../jevPhotos'
import { hear, type Heard } from '../jevSay'
import { applyPour, planPour, setTray, trayFrom, type Poured } from '../jevPour'
import { buildPage, planPage, type PagePlan } from '../jevPage'
import { suggestPalettes } from '../jevColors'
import { dressPage, dressSection, type DressIdea } from '../jevDress'
import { noteWants } from '@/lib/jevWants'
import type { Ranked } from '@/core/jev/palettes'
import { jevPhotoUrl } from '@/core/jev/photos'
import { assetUrl } from '@/lib/assets'
import type { TokenKey } from '@/core/types'
import { CommandError, findBlock, findPage, findSection, placeOf, wordsFor } from './refs'
import type { AsyncCommand } from './index'

// This device's switch decides whether Jev may help ("Let Jev help" in the menu).
setJevAllowed(() => useStore.getState().ui.jev !== false)

async function needJev() {
  if (!(await jevOn())) throw new CommandError(await jevOffMessage())
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

/** A whole palette at once, as one undo step (the Feel tile's way: colors are free, like the dials). */
export const write = {
  set_palette: (i: CommandInput<'set_palette'>) => {
    useStore.getState().chooseTokens(i.colors as Partial<Record<TokenKey, string>>)
    return { colors: i.colors }
  },
  retype_section: (i: CommandInput<'retype_section'>) => {
    const slot = findSection(i.section)
    if (slot.locked) throw new CommandError(`${TYPE_LABEL[slot.type]} is locked`)
    if (i.layout && library.clips[i.layout]?.type !== i.type) throw new CommandError(`"${i.layout}" isn’t a ${TYPE_LABEL[i.type]} layout`)
    const out = retypeSection(slot.id, i.type, i.layout)
    if (!out) throw new CommandError(`Couldn’t turn ${TYPE_LABEL[slot.type]} into ${TYPE_LABEL[i.type]}`)
    return { section: slot.id, type: i.type, ...out, message: `${TYPE_LABEL[slot.type]} is now ${TYPE_LABEL[i.type]}: ${out.placed} lines placed${out.waiting ? `, ${out.waiting} waiting to be placed` : ''}.` }
  },
}

type LayoutsRead = { view: ReturnType<typeof pageSlots>; reads: Awaited<ReturnType<typeof readsAs>> }

export const later = {
  suggest_layouts_for_words: {
    prepare: async (i: CommandInput<'suggest_layouts_for_words'>): Promise<LayoutsRead> => {
      const view = pageSlots(i.page)
      return { view, reads: i.read && (await jevOn()) ? await readsAs(view) : null }
    },
    apply: (i: CommandInput<'suggest_layouts_for_words'>, { view, reads }: LayoutsRead) => {
      const only = i.section !== undefined ? findSection(i.section, i.page).id : undefined
      return fitsFor(view, only).map(({ slot, items, fits }) => ({
        section: slot.id,
        type: slot.type,
        layout: slot.clipId,
        items,
        fits: fits.map((f) => ({ layout: f.clipId, title: layoutTitle(f.clipId), holds: Number.isFinite(f.holds) ? f.holds : null, current: f.current, built_in: f.builtIn })),
        ...(reads?.[slot.id] ? { reads_as: { type: reads[slot.id].type, sure: Math.round(reads[slot.id].p * 100) / 100, layout: reads[slot.id].clipId } } : {}),
      }))
    },
  } satisfies AsyncCommand<LayoutsRead>,
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
            ? 'There are ideas, but none sure enough to set; see suggestions.'
            : `Every link here already leads somewhere${i.section !== undefined ? ` in ${TYPE_LABEL[findSection(i.section, i.page).type]}` : ''}.`,
      }
    },
  } satisfies AsyncCommand<LinkGuess[]>,
  five_second_test: {
    prepare: (i: CommandInput<'five_second_test'>) => fiveSecondTest(i.page),
    apply: (_i: CommandInput<'five_second_test'>, r: FiveSecond) => ({
      visitor: r.read?.words ?? 'No answer that time; try again.',
      guess: r.read?.kind ?? null,
      torn_between: r.read?.torn ?? null,
      sure: r.read ? Math.round(r.read.p * 100) / 100 : null,
      first_screen: r.words,
      score: r.score.score,
      checks: r.score.checks.map((c) => `${c.ok ? '✓' : c.weight ? '✗' : '·'} ${c.words}`),
    }),
  } satisfies AsyncCommand<FiveSecond>,
  pour_words: {
    prepare: async (i: CommandInput<'pour_words'>) => {
      await needJev()
      const p = await planPour(i.text, pageSlots(i.page))
      if (!p) throw new CommandError('No answer that time; nothing was placed. Try again.')
      return p
    },
    apply: (_i: CommandInput<'pour_words'>, p: Poured) => {
      const done = applyPour(p.plan)
      const tray = trayFrom(p.plan)
      setTray((lines) => [...lines, ...tray])
      // Lines with nowhere to go on this page: count what they wanted (a menu, opening hours…), never the words.
      void noteWants(tray.filter((t) => !t.homes.length).map((t) => t.text), 'pour', undefined, useStore.getState().content.kind)
      return {
        placed: done.placed,
        sections: done.sections,
        waiting: tray.map((t) => ({ text: t.text, could_go: t.homes.map((h) => h.label) })),
        message: `Placed ${done.placed} line${done.placed === 1 ? '' : 's'} in ${done.sections} section${done.sections === 1 ? '' : 's'}.${tray.length ? ` ${tray.length} ${tray.length === 1 ? 'isn’t' : 'aren’t'} placed yet.` : ''}`,
      }
    },
  } satisfies AsyncCommand<Poured>,
  page_from_words: {
    prepare: async (i: CommandInput<'page_from_words'>) => {
      await needJev()
      const p = await planPage(i.text)
      if (!p) throw new CommandError('No answer that time, or there was no text to use. Try again.')
      return p
    },
    apply: (i: CommandInput<'page_from_words'>, p: PagePlan) => {
      const b = buildPage(p, i.arrangement, i.into, i.page)
      return {
        page: b.pageId,
        sections: b.sections,
        placed: b.placed,
        waiting: b.waiting,
        kind: b.kind,
        message: `Made a page of ${b.sections.join(', ')} from your text.${b.waiting ? ` ${b.waiting} line${b.waiting === 1 ? ' isn’t' : 's aren’t'} placed yet.` : ''}`,
      }
    },
  } satisfies AsyncCommand<PagePlan>,
  suggest_palettes: {
    prepare: async (i: CommandInput<'suggest_palettes'>) => {
      await needJev()
      let picture: string | undefined
      if (i.picture) {
        const slot = findSection(i.picture.section)
        const b = findBlock(slot, i.picture.block)
        const fill = slot.edits?.[slot.clipId]?.[b.id]?.media
        picture = fill?.source === 'upload' && fill.asset ? assetUrl(fill.asset) : fill?.source === 'stock' && fill.stock ? jevPhotoUrl(fill.stock) : undefined
        if (!picture) throw new CommandError(`${b.label} shows no photo or upload to match`)
      }
      const r = await suggestPalettes({ feel: i.feel, brand: i.brand, picture, mode: i.mode })
      if (!r) throw new CommandError('No answer that time; try again.')
      return r
    },
    apply: (_i: CommandInput<'suggest_palettes'>, r: Ranked[]) => r.map((p, n) => ({ pick: n + 1, colors: p.palette, words: p.words, from: p.from, fit: p.score })),
  } satisfies AsyncCommand<Ranked[]>,
  suggest_treatments: {
    prepare: async (i: CommandInput<'suggest_treatments'>): Promise<DressIdea[]> => {
      await needJev()
      if (i.section === undefined) {
        const look = await dressPage(i.feel)
        return look ? [look] : []
      }
      const r = await dressSection(findSection(i.section).id, i.feel)
      if (!r) throw new CommandError('No answer that time; try again.')
      return r.ideas
    },
    apply: (_i: CommandInput<'suggest_treatments'>, ideas: DressIdea[]) => ideas.map((d) => ({ does: d.label, command: d.command, input: d.input, needs_pack: d.locked, fit: Math.round(d.fit * 100) / 100 })),
  } satisfies AsyncCommand<DressIdea[]>,
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
      if (!r.focus) return { block: r.label, focus: null, message: 'No single subject to keep in frame (or it wasn’t clear); the crop stays centered.' }
      useStore.getState().editBlock(r.slotId, r.blockId, { media: { ...r.fill, focus: { x: r.focus.x, y: r.focus.y } } })
      return { block: r.label, focus: { x: r.focus.x, y: r.focus.y }, subject: r.focus.kind }
    },
  },
}
