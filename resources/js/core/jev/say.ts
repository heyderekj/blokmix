// Say it: type what you want ("roomier", "make pricing dark", "FAQ above pricing") and
// Blokmix does it. Jev never runs anything: it picks one intent from an allow-list and
// fills its arguments from closed sets built from the page itself (its real sections,
// the dials, the skins). Code turns that into one ordinary command, shown before it runs.
// Everything is asked in one request: the intent (in both option orders) and every
// argument question at once, so it answers as fast as you type.

import { SECTION_TYPES, type SectionType } from '../types'
import { TYPE_LABEL } from '../content'
import { DIAL_NAMES, type DialName } from '../dials'
import { SECTION_WIDTHS, SURFACES, type SectionWidth, type Surface } from '../surface'
import { choice, at } from './ask'
import { clip } from './state'
import { merged, shuffled } from './shuffle'
import { choiceOf, ranked } from './read'
import { SECTION_CRITERIA } from './vocab'
import type { Criterion, JevRequest, JevResponse } from './types'

export const SAY_THRESHOLDS = {
  /** Show it as the thing Enter does: the intent this likely (both orders agreeing), each argument at `arg`. */
  act: 0.7,
  arg: 0.6,
  /** Below `act`, intents at least this likely are offered as "Did you mean". */
  offer: 0.2,
  /** How far one press of "roomier" moves a dial (0–100). */
  step: 15,
}

type Arg = 'section' | 'other' | 'above_below' | 'dial' | 'more_less' | 'tone' | 'surface' | 'section_width' | 'section_type' | 'skin'

interface Intent {
  criterion: Exclude<Criterion, string | null>
  args: Arg[]
}

/** What Say it understands. Every one becomes an existing command or opens one of Jev's other tools. */
export const INTENTS = {
  dial: {
    criterion: { what: 'Change the whole page’s feel: more or less space, bigger or smaller text, rounder or sharper corners, bolder or lighter type, wider or narrower columns', not_for: 'Changing one section only', examples: ['roomier', 'tighter', 'bigger text', 'rounder corners', 'bolder', 'more breathing room'] },
    args: ['dial', 'more_less'],
  },
  tone: { criterion: { what: 'Make the whole page dark or light', not_for: 'One section’s band', examples: ['dark mode', 'make it dark', 'go light'] }, args: ['tone'] },
  surface: {
    criterion: { what: 'Change the band color behind one section: dark, soft, the brand color, or plain again', not_for: 'The whole page dark or light', examples: ['make pricing dark', 'put the FAQ on a soft band', 'brand color behind the CTA'] },
    args: ['section', 'surface'],
  },
  width: { criterion: { what: 'Make one section’s content narrower, wider or edge to edge', examples: ['make the gallery full width', 'narrow the quote'] }, args: ['section', 'section_width'] },
  move: {
    criterion: { what: 'Move a section above or below another, or to the top or bottom of the page', examples: ['FAQ above pricing', 'move testimonials up top', 'put the team after features'] },
    args: ['section', 'other', 'above_below'],
  },
  add: { criterion: { what: 'Add a new section of some kind', not_for: 'Moving or changing one that’s already there', examples: ['add a FAQ', 'I need a team section', 'add pricing'] }, args: ['section_type'] },
  remove: { criterion: { what: 'Remove or delete a section', examples: ['remove the testimonials', 'get rid of the stats', 'delete the FAQ'] }, args: ['section'] },
  swap: {
    criterion: { what: 'Try a different layout for a section, keeping its words', not_for: 'Changing its colors or band', examples: ['another hero', 'try a different features layout', 'show the pricing as a table'] },
    args: ['section'],
  },
  skin: { criterion: { what: 'Put a whole different look (skin) on the page by name or mood', examples: ['make it look like riso print', 'go editorial', 'something more playful', 'more premium'] }, args: ['skin'] },
  surprise: { criterion: { what: 'Surprise me: shuffle the look into something new', examples: ['surprise me', 'shuffle the style', 'something different'] }, args: [] },
  colors: {
    criterion: { what: 'Change the colors to a feel or mood, or match a brand color or a logo', not_for: 'Dark or light only', examples: ['warmer colors', 'cozy bakery colors', 'colors like the ocean', 'match my logo'] },
    args: [],
  },
  dress: {
    criterion: { what: 'Make a section or the page more striking: a background, texture, glow, glass or other effect', examples: ['make the hero pop', 'add some texture', 'a gradient behind the CTA'] },
    args: ['section'],
  },
  pour: { criterion: { what: 'Put my own words or text into the page', examples: ['here’s my copy', 'use my about text', 'fill it with my words'] }, args: [] },
  page: { criterion: { what: 'Make a whole new page out of text I paste', examples: ['make a page from this', 'turn my notes into a page'] }, args: [] },
  links: { criterion: { what: 'Make the buttons and links go somewhere', examples: ['fix the links', 'buttons go nowhere', 'hook up the buttons'] }, args: [] },
  check: { criterion: { what: 'Check whether the page is clear to a visitor', examples: ['is it clear?', 'five-second test', 'would people get it?'] }, args: [] },
  show: { criterion: { what: 'Go to or show a section', not_for: 'Changing it', examples: ['show me pricing', 'go to the footer', 'where’s the FAQ'] }, args: ['section'] },
  none: { criterion: { what: 'Something else, or not a request to change this page' }, args: [] },
} satisfies Record<string, Intent>

export type IntentId = keyof typeof INTENTS

/** What Say it knows about the page: its sections in order (the shared nav and footer too), and the looks on offer. */
export interface SayContext {
  sections: { id: string; type: SectionType; position: number; heading?: string; locked?: boolean; originalStyle?: boolean; surface: Surface; width: SectionWidth }[]
  pageId: string
  dials: Record<DialName, number>
  tone: 'light' | 'dark'
  opposingBands: number
  originalView: boolean
  skins: { id: string; name: string; words: string }[]
}

const DIAL_CRITERIA: Record<DialName, Criterion> = {
  spacing: { what: 'Space between and around things', examples: ['roomier', 'tighter', 'airy', 'cramped', 'breathing room'] },
  type: { what: 'How big the text is', examples: ['bigger text', 'smaller headings', 'larger type'] },
  roundness: { what: 'How round the corners are', examples: ['rounder', 'sharper corners', 'square', 'pill buttons'] },
  weight: { what: 'How heavy the type and lines are', examples: ['bolder', 'lighter', 'thicker lines', 'heavier'] },
  width: { what: 'How wide the content and reading columns run', examples: ['wider', 'narrower columns', 'more compact'] },
}

const sectionKey = (id: string) => `s_${id}`

function sectionCriteria(ctx: SayContext): Record<string, Criterion> {
  const out: Record<string, Criterion> = {}
  for (const s of ctx.sections) out[sectionKey(s.id)] = { what: `${TYPE_LABEL[s.type]} (section ${s.position})${s.heading ? `: “${clip(s.heading, 60)}”` : ''}` }
  return out
}

/** The one request: the intent (both orders) and every argument, against this page. */
export function sayRequest(text: string, ctx: SayContext): JevRequest {
  const said = at('request')
  const sections = sectionCriteria(ctx)
  return {
    state: { request: clip(text, 200), page: { sections: ctx.sections.map((s) => `${s.position}. ${TYPE_LABEL[s.type]}${s.heading ? `: ${clip(s.heading, 60)}` : ''}`) } },
    questions: {
      ...shuffled('intent', choice(`What does ${said} ask Blokmix to do to this page?`, Object.fromEntries(Object.entries(INTENTS).map(([k, v]) => [k, v.criterion])))),
      section: choice(`Which section is ${said} mainly about (the one to change, move, remove or show)?`, { ...sections, none: { what: 'No particular section, or the whole page' } }),
      other: choice(`If ${said} moves a section next to another one, which is that other one?`, { ...sections, top_of_page: { what: 'The top of the page' }, bottom_of_page: { what: 'The bottom of the page' }, none: { what: 'Not a move' } }),
      above_below: choice(`Does ${said} want the section to go above (before) or below (after) the other one?`, { above: { what: 'Above, before, up, higher' }, below: { what: 'Below, after, down, lower' } }),
      dial: choice(`Which part of the page’s feel does ${said} change?`, DIAL_CRITERIA),
      more_less: choice(`Does ${said} want more of it or less?`, { more: { what: 'More: roomier, bigger, rounder, bolder, wider' }, less: { what: 'Less: tighter, smaller, sharper, lighter, narrower' } }),
      tone: choice(`Does ${said} want the page dark or light?`, { dark: { what: 'Dark: light text on a dark page' }, light: { what: 'Light: dark text on a light page' } }),
      surface: choice(`What background band does ${said} want behind the section?`, {
        dark: { what: 'Dark background', examples: ['make it dark', 'black background'] },
        light: { what: 'Light background', examples: ['lighten the section', 'white background'] },
        inverse: { what: 'Flipped, inverted, contrasting with the page' },
        brand: { what: 'The brand color', examples: ['in our color', 'pink band', 'colored'] },
        soft: { what: 'A soft, slightly tinted band', examples: ['subtle background', 'grey band', 'softer'] },
        page: { what: 'Plain again, like the rest of the page', examples: ['no background', 'reset it', 'plain'] },
      }),
      section_width: choice(`How wide does ${said} want the section’s content to run?`, {
        narrow: { what: 'Narrow, pulled in' },
        standard: { what: 'The usual width' },
        wide: { what: 'Wider' },
        full: { what: 'Full width, edge to edge' },
      }),
      section_type: choice(`What kind of section does ${said} want?`, SECTION_CRITERIA),
      skin: choice(`Which look fits ${said} best?`, Object.fromEntries(ctx.skins.slice(0, 40).map((s) => [s.id, { what: `${s.name}: ${s.words}` }]))),
    },
  }
}

/** One ordinary command, ready to run, and how it reads on its chip. */
export interface SayAction {
  intent: IntentId
  /** A command to run, or a tool to open (`open`). */
  command?: string
  input?: Record<string, unknown>
  open?: 'pour' | 'page' | 'colors' | 'dress' | 'restyle'
  words: string
  /** The section it acts on, to reveal while you type. */
  slotId?: string
  /** How sure: the intent's probability times its arguments'. */
  sure: number
}

export interface Understood {
  action: SayAction | null
  options: SayAction[]
  message?: string
}

type Resolution = SayAction | { message: string; sure: number }

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 }

/** "section 3", "the third section", "the 2nd one": code reads numbers, which Jev isn't for. */
export function sectionByNumber(text: string, ctx: SayContext): string | null {
  const t = text.toLowerCase()
  const n = Number(t.match(/\bsection\s+(\d+)\b/)?.[1] ?? t.match(/\b(\d+)(?:st|nd|rd|th)\b/)?.[1] ?? ORDINALS[t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/)?.[1] ?? ''] ?? NaN)
  if (/\blast\s+section\b/.test(t)) return ctx.sections.filter((s) => s.type !== 'footer').at(-1)?.id ?? null
  return Number.isFinite(n) ? (ctx.sections.find((s) => s.position === n)?.id ?? null) : null
}

export const saySectionName = (ctx: SayContext, id: string) => {
  const s = ctx.sections.find((x) => x.id === id)
  if (!s) return ''
  const twins = ctx.sections.filter((x) => x.type === s.type)
  return twins.length > 1 ? `${TYPE_LABEL[s.type]} (${twins.indexOf(s) + 1})` : TYPE_LABEL[s.type]
}

/** Turn one intent and the answers into an action, or null when an argument it needs isn't there. */
function buildAction(intent: IntentId, arg: (name: Arg) => { option: string; p: number } | null, ctx: SayContext, pIntent: number): Resolution | null {
  const nameOf = (id: string) => saySectionName(ctx, id)
  const sectionArg = () => {
    const a = arg('section')
    const slot = a && ctx.sections.find((s) => sectionKey(s.id) === a.option)
    return slot && a ? { ...slot, p: a.p } : null
  }
  const confidence = (ps: number[]) => ps.reduce((x, y) => x * y, pIntent)
  const done = (a: Omit<SayAction, 'intent' | 'sure'>, ...ps: number[]): SayAction => ({ intent, sure: confidence(ps), ...a })
  const info = (message: string, ...ps: number[]): Resolution => ({ message, sure: confidence(ps) })
  const locked = (s: NonNullable<ReturnType<typeof sectionArg>>, ...ps: number[]) => info(`Unlock ${nameOf(s.id)} to change it here.`, s.p, ...ps)

  switch (intent) {
    case 'dial': {
      const d = arg('dial')
      const m = arg('more_less')
      if (!d || !m || !['more', 'less'].includes(m.option) || !(DIAL_NAMES as readonly string[]).includes(d.option)) return null
      const name = d.option as DialName
      const now = ctx.dials[name] ?? 50
      const value = Math.max(0, Math.min(100, now + (m.option === 'more' ? 1 : -1) * SAY_THRESHOLDS.step))
      const word = { spacing: ['Roomier', 'Tighter'], type: ['Bigger text', 'Smaller text'], roundness: ['Rounder corners', 'Sharper corners'], weight: ['Bolder', 'Lighter'], width: ['Wider columns', 'Narrower columns'] }[name][m.option === 'more' ? 0 : 1]
      return value === now ? info('That setting is already at its limit.', d.p, m.p) : done({ command: 'set_dial', input: { dial: name, value }, words: word }, d.p, m.p)
    }
    case 'tone': {
      const t = arg('tone')
      if (!t || (t.option !== 'light' && t.option !== 'dark')) return null
      if (t.option === ctx.tone && !ctx.opposingBands && !ctx.originalView) {
        return info(`The page palette is already ${t.option}. Sections with their own backgrounds can be changed individually.`, t.p)
      }
      return done({ command: 'set_tone', input: { tone: t.option, page: ctx.pageId }, words: t.option === 'dark' ? 'Dark page' : 'Light page' }, t.p)
    }
    case 'surface': {
      const s = sectionArg()
      const f = arg('surface')
      if (!s || !f) return null
      const tone = f.option === 'light' || f.option === 'dark' ? f.option : null
      const surface: Surface | null = tone ? (tone === ctx.tone ? 'page' : 'inverse') : SURFACES.find((s) => s === f.option) ?? null
      if (!surface) return null
      if (s.locked) return locked(s, f.p)
      const name = nameOf(s.id)
      if (s.originalStyle) return info(`${name} is using its original style. Switch it to Your style to change its background.`, s.p, f.p)
      const band = tone ? `${tone} band` : { inverse: ctx.tone === 'dark' ? 'light band' : 'dark band', brand: 'brand-color band', soft: 'soft band', page: 'page background' }[surface]
      if (s.surface === surface && !ctx.originalView) return info(`${name} already uses this background.`, s.p, f.p)
      return done({ command: 'set_section_surface', input: { section: s.id, surface }, words: `${name} → ${band}`, slotId: s.id }, s.p, f.p)
    }
    case 'width': {
      const s = sectionArg()
      const w = arg('section_width')
      if (!s || !w || !(SECTION_WIDTHS as readonly string[]).includes(w.option)) return null
      if (s.locked) return locked(s, w.p)
      if (s.width === w.option && !ctx.originalView) return info(`${nameOf(s.id)} is already at this width.`, s.p, w.p)
      return done({ command: 'set_section_width', input: { section: s.id, width: w.option }, words: `${nameOf(s.id)} → ${w.option === 'full' ? 'full width' : w.option}`, slotId: s.id }, s.p, w.p)
    }
    case 'move': {
      const s = sectionArg()
      const o = arg('other')
      const ab = arg('above_below')
      if (!s || !o || o.option === 'none') return null
      const ps = [s.p, o.p, o.option.startsWith('s_') ? (ab?.p ?? 0) : 1]
      if (s.locked) return locked(s, ...ps.slice(1))
      const order = ctx.sections.filter((x) => x.type !== 'nav' && x.type !== 'footer')
      if (!order.some((x) => x.id === s.id)) return info(`${nameOf(s.id)} has a fixed position on the page.`, ...ps)
      const firstPos = order[0]?.position ?? 1
      const lastPos = order.at(-1)?.position ?? firstPos
      let to: number
      let words: string
      if (o.option === 'top_of_page') {
        to = firstPos
        words = `Move ${nameOf(s.id)} to the top`
      } else if (o.option === 'bottom_of_page') {
        to = lastPos
        words = `Move ${nameOf(s.id)} to the bottom`
      } else {
        const target = order.find((x) => sectionKey(x.id) === o.option)
        if (!target || !ab || !['above', 'below'].includes(ab.option)) return null
        if (target.id === s.id) return info('Choose two different sections to move one next to the other.', ...ps)
        // Positions count the nav; moving down frees the spot it leaves.
        const above = ab.option === 'above'
        to = above ? (target.position > s.position ? target.position - 1 : target.position) : target.position > s.position ? target.position : target.position + 1
        words = `Move ${nameOf(s.id)} ${ab.option} ${nameOf(target.id)}`
      }
      if (to === s.position) return info(`${nameOf(s.id)} is already in that position.`, ...ps)
      return done({ command: 'move_section', input: { section: s.id, to }, words, slotId: s.id }, ...ps)
    }
    case 'add': {
      const t = arg('section_type')
      if (!t || !(SECTION_TYPES as readonly string[]).includes(t.option)) return null
      if ((t.option === 'nav' || t.option === 'footer') && ctx.sections.some((s) => s.type === t.option)) return info(`This page already has a ${TYPE_LABEL[t.option]}.`, t.p)
      return done({ command: 'add_section', input: { type: t.option, page: ctx.pageId }, words: `Add ${TYPE_LABEL[t.option as SectionType]} section` }, t.p)
    }
    case 'remove': {
      const s = sectionArg()
      if (!s) return null
      if (s.locked) return locked(s)
      return done({ command: 'remove_section', input: { section: s.id }, words: `Remove ${nameOf(s.id)}`, slotId: s.id }, s.p)
    }
    case 'swap': {
      const s = sectionArg()
      if (!s) return null
      if (s.locked) return locked(s)
      // The layout itself is picked when it runs (the next one that suits that spot), so the chip stays quick.
      return done({ command: 'swap_section', input: { section: s.id }, words: `Another ${nameOf(s.id)} layout`, slotId: s.id }, s.p)
    }
    case 'skin': {
      const k = arg('skin')
      const skin = k && ctx.skins.find((x) => x.id === k.option)
      if (!k || !skin) return done({ open: 'restyle', words: 'Preview theme changes' })
      return done({ command: 'apply_skin', input: { skin: skin.id }, words: `Use the ${skin.name} theme` }, k.p)
    }
    case 'surprise':
      return done({ command: 'surprise_me', input: {}, words: 'Surprise me' })
    case 'show': {
      const s = sectionArg()
      if (!s) return null
      return done({ command: 'show', input: { section: s.id }, words: `Go to ${nameOf(s.id)}`, slotId: s.id }, s.p)
    }
    case 'links':
      return done({ command: 'place_links', input: {}, words: 'Point buttons where their words lead' })
    case 'check':
      return done({ command: 'five_second_test', input: {}, words: 'Show the first screen to a visitor' })
    case 'colors':
      return done({ open: 'colors', words: 'Find colors' })
    case 'dress': {
      const s = sectionArg()
      return done({ open: 'dress', words: s ? `Background ideas for ${nameOf(s.id)}` : 'Background ideas', slotId: s?.id }, s?.p ?? 1)
    }
    case 'pour':
      return done({ open: 'pour', words: 'Add your text to this page' })
    case 'page':
      return done({ open: 'page', words: 'Make a page from your text' })
    case 'none':
      return null
  }
}

/** Explicit picks from the sentence builder or the built-in text commands. */
export function pickedSay(intent: IntentId, picks: Record<string, string>, ctx: SayContext): Understood {
  const result = buildAction(intent, (name) => picks[name] ? { option: picks[name], p: 1 } : null, ctx, 1)
  if (result && 'message' in result) return { action: null, options: [], message: result.message }
  return { action: result, options: [] }
}

/** What Enter would do, and what else you might have meant. */
export function understand(res: JevResponse | null, text: string, ctx: SayContext): Understood {
  const m = merged(res, 'intent')
  if (!res || !m) return { action: null, options: [] }
  const T = SAY_THRESHOLDS
  const namedSkin = ctx.skins.find((s) => text.toLowerCase().includes(s.name.toLowerCase()))
  const arg = (name: Arg) => {
    if (name === 'skin') return namedSkin ? { option: namedSkin.id, p: 1 } : null
    const answer = choiceOf(res, name)
    return answer ? ranked(answer)[0] ?? null : null
  }
  const intents = ranked(m).filter((x): x is { option: IntentId; p: number } => Object.hasOwn(INTENTS, x.option) && x.option !== 'none' && x.p >= T.offer)
  const built = intents.map(({ option, p }) => ({ intent: option, p, result: buildAction(option, arg, ctx, p) }))
  const first = built.find((x) => x.intent === m.choice)
  const options = built.flatMap(({ result }) => result && 'intent' in result ? [result] : [])
  // Each argument at `arg` on average (geometric mean): a move's three answers at 0.85 each read as 0.85, not 0.61.
  if (first?.result && m.agree && first.p >= T.act) {
    const argsSure = (first.result.sure / first.p) ** (1 / Math.max(1, INTENTS[first.intent].args.length))
    if (argsSure >= T.arg) {
      if ('message' in first.result) return { action: null, options: [], message: first.result.message }
      return { action: first.result, options: options.filter((a) => a !== first.result).slice(0, 2) }
    }
  }
  return { action: null, options: options.slice(0, 3) }
}
