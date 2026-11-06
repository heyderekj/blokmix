import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { library, slotClip } from '@/data/library'
import { contentFor, RECIPES, startCandidates } from '@/core/start'
import { fieldOwner, ownership, pageOwnership } from '@/core/ownWords'
import { placeSection, readDescribe, sectionsFor, textMode, describeRequest } from '@/core/jev/describe'
import { allSlots, pageView } from '@/core/site'
import { showWords } from '@/core/words'
import { hearStart, wordsCandidates, startsFromText } from '@/lib/startFromText'
import { mixFromStart, startedWords } from '@/lib/start'
import { planPage, wordsPage } from '@/state/jevPage'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'
import { setTray, trayLines } from '@/state/jevPour'
import { fakeJev, realJev } from './helpers/fakeJev'

const MENU = `Mill Bakery
Bread worth getting up for.

What we bake
Sourdough
$9
Rye
$8
Croissant
$4

Questions
Q: Do you deliver?
A: Within 5 miles, before 10.
Q: Is anything gluten free?
A: The almond cake.

Come say hi
hello@millbakery.com`

const TYPE: Record<string, string> = { '0': 'hero', '1': 'pricing', '2': 'faq', '3': 'contact' }
const ROLE: Record<string, string> = {
  'Mill Bakery': 'eyebrow',
  'Bread worth getting up for.': 'headline',
  'What we bake': 'heading',
  Sourdough: 'title',
  Rye: 'title',
  Croissant: 'title',
  Questions: 'heading',
  'Come say hi': 'heading',
}

const jevOnMenu = () =>
  fakeJev((name, q) => {
    if (name.startsWith('kind')) return { option: 'local', p: 0.9 }
    if (name.startsWith('type_')) return { option: TYPE[name.match(/^type_(\d+)/)![1]], p: 0.88 }
    if (name.startsWith('list_')) return 0.9
    if (name.startsWith('role_')) return { option: ROLE[(q.instructions as { line: string }).line] ?? 'other', p: 0.9 }
    return undefined
  })

/** Jev on "a bakery…": a local business that wants a menu with prices and its hours, no team, in the Friendly look. */
const jevOnBakery = () =>
  fakeJev((name) => {
    if (name.startsWith('kind')) return { option: 'local', p: 0.85 }
    if (name === 'need_pricing') return 0.9
    if (name === 'need_contact') return 0.95
    if (name === 'need_testimonials') return 0.05
    if (name.startsWith('need_')) return 0.4
    if (name.startsWith('look')) return { option: 'friendly', p: 0.7 }
    return undefined
  })

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
  setTray(() => [])
})
afterEach(() => realJev())

describe('whose words are on the page', () => {
  it('counts the guided start’s filler as not yours, and your name, email and one line as yours', () => {
    const content = contentFor({ kind: 'local', name: 'Mill Bakery', oneLiner: 'Bread worth getting up for' })
    expect(content.mine).toEqual(expect.arrayContaining(['nav.brand', 'contact.email', 'footer.legal', 'hero.headline']))
    // A filler headline that happens to name the site is still filler.
    expect(contentFor({ kind: 'product', name: 'Fern' }).mine).not.toContain('hero.headline')
    const [start] = startCandidates({ kind: 'local', name: 'Mill Bakery', oneLiner: 'Bread worth getting up for' }, library)
    const hero = allSlots(start.site).find((s) => s.type === 'hero')!
    const clip = slotClip(hero)
    expect(fieldOwner(hero, clip, start.content, 'headline')).toBe('yours')
    expect(fieldOwner(hero, clip, start.content, 'subhead')).toBe('filler')
  })

  it('makes a field yours once you type into it, and counts a page', () => {
    const [start] = startCandidates({ kind: 'local', name: 'Mill Bakery' }, library)
    const slots = pageView(start.site, start.site.pages[0].id)
    const before = pageOwnership(slots, slotClip, start.content)
    expect(before.total).toBeGreaterThan(10)
    expect(before.yours).toBeLessThan(before.total)
    const hero = slots.find((s) => s.type === 'hero')!
    const typed = showWords(hero, slotClip(hero), start.content, 'subhead', 'Order by 8, pick up by 10.')
    const after = pageOwnership(slots.map((s) => (s.id === hero.id ? typed : s)), slotClip, start.content)
    expect(after.yours).toBe(before.yours + 1)
    expect(after.total).toBe(before.total)
  })

  it('leaves hidden blocks out of the count', () => {
    const [start] = startCandidates({ kind: 'local', name: 'Mill Bakery' }, library)
    const hero = allSlots(start.site).find((s) => s.type === 'hero')!
    const clip = slotClip(hero)
    const all = ownership(hero, clip, start.content)
    const eyebrow = clip.blocks.find((b) => b.field === 'eyebrow')
    expect(eyebrow).toBeTruthy()
    const hidden = { ...hero, edits: { [hero.clipId]: { [eyebrow!.id]: { hidden: true } } } }
    expect(ownership(hidden, clip, start.content)).toHaveLength(all.length - 1)
  })
})

describe('the start box', () => {
  it('tells a description from words to place', () => {
    expect(textMode('A bakery on Elm Street that takes pre-orders')).toBe('describe')
    expect(textMode('A bakery\non Elm Street')).toBe('describe')
    expect(textMode(MENU)).toBe('paste')
    expect(textMode('x'.repeat(300))).toBe('paste')
  })

  it('adds what a description asks for where it belongs, and drops what it clearly doesn’t want', () => {
    const s = sectionsFor('local', { pricing: 0.9, testimonials: 0.05, faq: 0.5 })
    expect(s).toContain('pricing')
    expect(s).not.toContain('testimonials')
    expect(s).toContain('faq')
    expect(s.indexOf('pricing')).toBeLessThan(s.indexOf('faq'))
    expect(s[0]).toBe('nav')
    expect(s.at(-1)).toBe('footer')
    expect(placeSection(['nav', 'hero', 'footer'], 'contact')).toEqual(['nav', 'hero', 'contact', 'footer'])
  })

  it('builds starts from your own list of sections, without starter mixes that bring theirs', () => {
    const sections = ['nav', 'hero', 'pricing', 'contact', 'footer'] as const
    const starts = startCandidates({ kind: 'local', name: 'Mill', sections: [...sections] }, library)
    expect(starts.length).toBeGreaterThan(0)
    for (const c of starts) {
      expect(c.from).toBe('library')
      expect(allSlots(c.site).map((s) => s.type)).toEqual([...sections])
    }
    // Unchanged from the kind's page, starters still come first.
    const usual = startCandidates({ kind: 'local', name: 'Mill', sections: [...RECIPES.local.home] }, library)
    expect(usual.map((c) => c.from)).toEqual(startCandidates({ kind: 'local', name: 'Mill' }, library).map((c) => c.from))
  })

  it('asks every question with the description in it, and reads the kind, sections and look', async () => {
    const fake = jevOnBakery()
    const heard = await hearStart('A bakery on Elm Street that takes pre-orders, with our menu and hours')
    expect(heard).toBeTruthy()
    expect(heard!.mode).toBe('describe')
    expect(heard!.kind).toBe('local')
    expect(heard!.sections).toContain('pricing')
    expect(heard!.sections).not.toContain('testimonials')
    expect(heard!.looks[0]).toBe('friendly')
    const req = fake.requests[0]
    for (const q of Object.values(req.questions)) expect(JSON.stringify(q.instructions)).toContain('Elm Street')
    expect(readDescribe(null)).toBeNull()
    expect(Object.keys(describeRequest('a bakery', []).questions)).not.toContain('look')
  })

  it('places pasted words in three arrangements, each with a nav and footer, and keeps what’s left over', async () => {
    jevOnMenu()
    const heard = await hearStart(MENU)
    expect(heard!.mode).toBe('paste')
    expect(heard!.kind).toBe('local')
    expect(heard!.sections).toEqual(['hero', 'pricing', 'faq', 'contact'])
    const starts = wordsCandidates({ kind: 'local', name: 'Mill Bakery' }, heard!.plan!)
    expect(starts.length).toBeGreaterThan(1)
    const ids = new Set<string>()
    for (const c of starts) {
      expect(c.from).toBe('words')
      expect(c.site.shared.nav).toBeTruthy()
      expect(c.site.shared.footer).toBeTruthy()
      const hero = c.site.pages[0].slots.find((s) => s.type === 'hero')!
      expect(hero.words?.headline).toBe('Bread worth getting up for.')
      for (const s of allSlots(c.site)) {
        expect(ids.has(s.id)).toBe(false)
        ids.add(s.id)
      }
    }
    expect(new Set(starts.map((c) => c.site.pages[0].slots.map((s) => s.clipId).join())).size).toBe(starts.length)
    // Off the board: nothing changed on it.
    expect(useStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('builds the same page off the board as on it', async () => {
    jevOnMenu()
    const plan = (await planPage(MENU))!
    const off = wordsPage(plan, 1, useStore.getState().content, (i) => `x${i}`)
    const out = (await runCommand('page_from_words', { text: MENU }, 'you')) as { page: string }
    const on = pageView(useStore.getState().site, out.page).filter((s) => s.type !== 'nav' && s.type !== 'footer')
    expect(on.map((s) => s.clipId)).toEqual(off.slots.map((s) => s.clipId))
    expect(on.map((s) => s.words)).toEqual(off.slots.map((s) => s.words))
  })

  it('puts a start on the board with its tray, saved with the mix’s words', async () => {
    jevOnMenu()
    const extra = `${MENU}\n\nWe also cater weddings on weekends if you ask nicely and early.`
    const heard = (await hearStart(extra))!
    const starts = await startsFromText({ kind: 'local', name: 'Mill Bakery' }, heard)
    const mix = mixFromStart({ name: 'Mill Bakery' }, starts, starts[0].id)
    useStore.getState().openMixData(mix)
    expect(trayLines(useStore.getState()).length).toBe(starts[0].content.tray?.length ?? 0)
    expect(Object.keys(mix.versions)).toHaveLength(starts.length)
    expect(startedWords('Mill Bakery', mix)).toMatch(/^Started Mill Bakery\./)
  })

  it('answers suggest_starts from text, saying what Jev heard', async () => {
    jevOnBakery()
    const out = (await runCommand('suggest_starts', { text: 'A bakery on Elm Street with our menu and hours', name: 'Mill' }, 'agent')) as {
      heard: { kind: string; sections: string[]; looks: string[] }
      starts: { pages: { sections: string[] }[] }[]
    }
    expect(out.heard.kind).toBe('local')
    expect(out.heard.sections).toContain('pricing')
    expect(out.starts.length).toBeGreaterThan(0)
    await expect(runCommand('suggest_starts', { name: 'Mill' }, 'agent')).rejects.toThrow(/kind/)
  })
})
