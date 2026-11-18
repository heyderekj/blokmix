import { TYPE_LABEL } from '../content'
import type { DialName } from '../dials'
import { SECTION_TYPES, type SectionType } from '../types'
import { pickedSay, sectionByNumber, type IntentId, type SayContext, type Understood } from './say'

const ALIASES: Partial<Record<SectionType, string[]>> = {
  nav: ['navigation', 'navbar', 'menu bar'],
  hero: ['banner'],
  cta: ['cta', 'call-to-action'],
  faq: ['faqs', 'frequently asked questions'],
  testimonials: ['testimonial', 'reviews'],
}
const commonName = (text: string) => text.toLowerCase().trim().replace(/^(?:the|an?) +/, '')
const typeMatches = (type: SectionType, words: string) => type === words || TYPE_LABEL[type].toLowerCase() === words || ALIASES[type]?.includes(words)

const DIAL_WORDS: [DialName, RegExp, RegExp][] = [
  ['spacing', /^(roomier|more (space|spacing|breathing room)|airier)$/, /^(tighter|less (space|spacing)|more compact)$/],
  ['type', /^(bigger|larger) (text|type|headings)$/, /^(smaller) (text|type|headings)$/],
  ['roundness', /^rounder( corners)?$/, /^sharper( corners)?$/],
  ['weight', /^bolder( (text|type))?$/, /^lighter( (text|type))?$/],
  ['width', /^wider( columns)?$/, /^narrower( columns)?$/],
]

/** Common, unambiguous edits can be previewed entirely from the open page. */
export function readLocalSay(text: string, ctx: SayContext): Understood | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').replace(/^please +/, '').replace(/,? +please$/, '')
  const resolve = (intent: IntentId, picks: Record<string, string> = {}) => pickedSay(intent, picks, ctx)
  let sectionProblem: string | undefined
  const section = (words: string) => {
    const name = commonName(words)
    if (/^(?:section \d+|(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) (?:section|one)|last section)$/.test(name)) {
      const id = sectionByNumber(name, ctx)
      if (!id) sectionProblem = `There’s no “${name}” on this page.`
      return id ? `s_${id}` : null
    }
    const numbered = name.match(/^(.*?)\s+\((\d+)\)$/)
    const label = (numbered?.[1] ?? name).replace(/ section$/, '')
    const byType = ctx.sections.filter((s) => typeMatches(s.type, label))
    const byHeading = ctx.sections.filter((s) => s.heading && commonName(s.heading) === name)
    const matches = byType.length || numbered ? byType : byHeading
    const hit = numbered ? matches[Number(numbered[2]) - 1] : matches.length === 1 ? matches[0] : null
    if (matches.length > 1 && !numbered) sectionProblem = `More than one section matches “${name}”. Use its section number to pick one.`
    else if (!hit && (numbered || SECTION_TYPES.some((type) => typeMatches(type, label)))) sectionProblem = `There’s no “${name}” section on this page.`
    return hit ? `s_${hit.id}` : null
  }

  const pageTone = t.match(/^(?:(?:make|turn|set) (?:the |this )?(?:whole )?(?:page|site|background|theme|it) (?:to )?|(?:switch|change) to |go )?(light|dark)(?: mode)?$/)
  if (pageTone) return resolve('tone', { tone: pageTone[1] })

  const feel = t.replace(/^make (?:the page|it) /, '').replace(/^use /, '')
  for (const [dial, more, less] of DIAL_WORDS) {
    if (more.test(feel)) return resolve('dial', { dial, more_less: 'more' })
    if (less.test(feel)) return resolve('dial', { dial, more_less: 'less' })
  }

  const edit = t.match(/^(?:make |set )?(.+?) (?:to )?(full width|edge to edge|standard width|wider|narrower|wide|narrow|darker|lighter|dark|light|plain|soft|softer|the brand color|inverted)$/)
  if (edit) {
    const id = section(edit[1])
    if (id) {
      const width = { 'full width': 'full', 'edge to edge': 'full', 'standard width': 'standard', wider: 'wide', narrower: 'narrow', wide: 'wide', narrow: 'narrow' }[edit[2]]
      const surface = { darker: 'dark', lighter: 'light', plain: 'page', softer: 'soft', 'the brand color': 'brand', inverted: 'inverse' }[edit[2]] ?? edit[2]
      return width ? resolve('width', { section: id, section_width: width }) : resolve('surface', { section: id, surface })
    }
  }

  const relative = t.match(/^(?:(?:move|put) )?(.+?) (above|below|before|after) (.+)$/)
  if (relative) {
    const from = section(relative[1])
    const to = section(relative[3])
    if (from && to) return resolve('move', { section: from, other: to, above_below: /above|before/.test(relative[2]) ? 'above' : 'below' })
  }
  const edge = t.match(/^(?:move|put) (.+?) (?:up top|(?:to |at )(?:the )?(top|bottom|end)(?: of the page)?|(first|last))$/)
  if (edge) {
    const id = section(edge[1])
    if (id) return resolve('move', { section: id, other: /^(bottom|end|last)$/.test(edge[2] ?? edge[3] ?? '') ? 'bottom_of_page' : 'top_of_page' })
  }

  const add = t.match(/^add (.+)$/)
  if (add) {
    const name = commonName(add[1]).replace(/ section$/, '')
    const type = SECTION_TYPES.find((candidate) => typeMatches(candidate, name))
    if (type) return resolve('add', { section_type: type })
  }
  const target = t.match(/^(remove|delete|go to|show(?: me)?|(?:try )?another) (.+)$/)
  if (target) {
    const intent = /^(remove|delete)$/.test(target[1]) ? 'remove' : target[1].endsWith('another') ? 'swap' : 'show'
    const id = section(intent === 'swap' ? target[2].replace(/ layout$/, '') : target[2])
    if (id) return resolve(intent, { section: id })
  }
  const theme = t.match(/^(?:use|apply|switch to) (?:the )?(.+?)(?: theme)?$/)
  if (theme) {
    const skin = ctx.skins.find((s) => s.name.toLowerCase() === theme[1] || s.id === theme[1])
    if (skin) return resolve('skin', { skin: skin.id })
  }
  if (/^(surprise me|shuffle the (look|style))$/.test(t)) return resolve('surprise')
  return sectionProblem ? { action: null, options: [], message: sectionProblem } : null
}
