// Fields, lists and blocks: which copy is the heading, which children repeat,
// what each item's pieces are called (f1Title, t2F3…), and the data-mx-block
// marks people select and restyle in Blokmix.

import type { SectionType } from '@/core/types'
import { FIELD_SCHEMA } from '@/core/content'
import { allEls, clean, closest, contains, els, hint, isEl, leavesOf, setParents, synth, textOf, type WEl } from './tree'
import { fontSize, HEADING_TAGS, hasVisibleBox, isButtonish, isPressable, isSolid, loudness } from './roles'

export interface Annotated {
  notes: string[]
  /** Copy that no field in the schema could hold (left as static text). */
  unfielded: string[]
}

type Role = 'title' | 'body' | 'button' | 'price' | 'price2' | 'value' | 'quote' | 'name' | 'role' | 'meta' | 'any'

interface ItemSpec {
  list: string
  label: string
  max: number
  roles: [Role, (i: number) => string][]
  nested?: { list: string; label: string; max: number; field: (i: number, j: number) => string }
}

const f = (s: string) => (i: number) => s.replace('#', String(i))

const ITEMS: Partial<Record<SectionType, ItemSpec>> = {
  features: { list: 'features', label: 'Feature', max: 6, roles: [['title', f('f#Title')], ['body', f('f#Body')]] },
  pricing: {
    list: 'plans',
    label: 'Plan',
    max: 3,
    roles: [['button', f('t#Cta')], ['price', f('t#Price')], ['price2', f('t#PriceYearly')], ['title', f('t#Name')], ['body', f('t#Desc')]],
    nested: { list: 'features', label: 'Feature', max: 4, field: (i, j) => `t${i}F${j}` },
  },
  team: { list: 'members', label: 'Member', max: 6, roles: [['name', f('m#Name')], ['role', f('m#Role')]] },
  blog: { list: 'posts', label: 'Post', max: 4, roles: [['title', f('p#Title')], ['body', f('p#Excerpt')], ['meta', f('p#Meta')]] },
  faq: { list: 'questions', label: 'Question', max: 6, roles: [['title', f('faq#Q')], ['body', f('faq#A')]] },
  stats: { list: 'stats', label: 'Stat', max: 4, roles: [['value', f('stat#Value')], ['body', f('stat#Label')]] },
  logos: { list: 'logos', label: 'Logo', max: 8, roles: [['any', f('logo#')]] },
  nav: { list: 'links', label: 'Link', max: 4, roles: [['any', f('link#')]] },
  footer: { list: 'columns', label: 'Column', max: 3, roles: [['title', f('col#Title')]], nested: { list: 'links', label: 'Link', max: 4, field: (i, j) => `col${i}L${j}` } },
}

const QUOTES: ItemSpec = { list: 'quotes', label: 'Quote', max: 3, roles: [['quote', f('q#Quote')], ['name', f('q#Name')], ['role', f('q#Role')]] }
const QUOTE_LOGOS: ItemSpec = { list: 'logos', label: 'Logo', max: 6, roles: [['any', f('logo#')]] }
const QUOTE_STATS: ItemSpec = { list: 'stats', label: 'Stat', max: 3, roles: [['value', f('stat#Value')], ['body', f('stat#Label')]] }

const PRICE = /([$€£¥₹]\s?\d)|(\d\s?(\/|per)\s?(mo|month|yr|year|user|seat))|^(free|custom|contact us)$/i
const HAS_DIGIT = /\d/

// ---------- repeating children ----------

const classes = (el: WEl) => new Set((hint(el, 'class') ?? '').split(/\s+/).filter((c) => c && !/^(is-|has-|active|selected|current|first|last|featured|popular|highlight)/.test(c)))

function bag(el: WEl): Map<string, number> {
  const m = new Map<string, number>()
  const visit = (e: WEl, depth: number) => {
    for (const k of els(e)) {
      const key = `${k.tag}${k.text !== undefined ? '·t' : ''}${k.block === 'image' ? '·img' : ''}`
      m.set(key, (m.get(key) ?? 0) + 1)
      if (depth < 4) visit(k, depth + 1)
    }
  }
  visit(el, 0)
  return m
}

function jaccard(a: Map<string, number>, b: Map<string, number>): number {
  if (!a.size && !b.size) return 1
  let inter = 0
  let union = 0
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    inter += Math.min(a.get(k) ?? 0, b.get(k) ?? 0)
    union += Math.max(a.get(k) ?? 0, b.get(k) ?? 0)
  }
  return union ? inter / union : 0
}

function similar(a: WEl, b: WEl): boolean {
  if (a.tag !== b.tag) return false
  const [ca, cb] = [classes(a), classes(b)]
  if (ca.size && [...ca].some((c) => cb.has(c))) return jaccard(bag(a), bag(b)) >= 0.35
  return jaccard(bag(a), bag(b)) >= 0.6
}

const hasContent = (el: WEl) => el.text !== undefined || leavesOf(el).length > 0 || el.block === 'image' || allEls(el).some((e) => e.block === 'image')

export interface Group {
  parent: WEl
  items: WEl[]
}

/** Groups of look-alike siblings anywhere under `root`. */
export function repeatGroups(root: WEl, skip: (el: WEl) => boolean = () => false): Group[] {
  const out: Group[] = []
  const visit = (el: WEl) => {
    if (skip(el)) return
    const kids = els(el).filter((k) => !skip(k) && hasContent(k))
    const used = new Set<WEl>()
    for (const k of kids) {
      if (used.has(k)) continue
      const g = kids.filter((o) => !used.has(o) && (o === k || similar(k, o)))
      if (g.length >= 2) {
        g.forEach((o) => used.add(o))
        out.push({ parent: el, items: g })
      }
    }
    for (const k of els(el)) visit(k)
  }
  visit(root)
  return out
}

// ---------- the main pass ----------

export function annotate(root: WEl, type: SectionType, ctx: { siteName: string }): Annotated {
  const notes: string[] = []
  const used = new Set<string>()
  const allowed = new Set(FIELD_SCHEMA[type])
  const mirrors = markMirrors(root)
  const inMirror = (el: WEl) => mirrors.has(el) || !!closest(el, (p) => mirrors.has(p))

  const give = (leaf: WEl, field: string): boolean => {
    if (!allowed.has(field) || used.has(field) || leaf.field || leaf.text === undefined) return false
    leaf.field = field
    used.add(field)
    return true
  }

  // Lists first: their copy is numbered by item.
  const lists: WEl[] = []
  const items: WEl[] = []
  const pick = (spec: ItemSpec, accept: (g: Group) => number, within: WEl = root) => {
    // Inside an item only that item's own lists are fair game.
    const groups = repeatGroups(within, (e) => inMirror(e) || lists.some((l) => contains(l, e) && !contains(l, within)) || items.some((it) => contains(it, e) && !contains(it, within)))
    let best: { g: Group; score: number } | null = null
    for (const g of groups) {
      const score = accept(g)
      if (score > 0 && (!best || score > best.score)) best = { g, score }
    }
    if (!best) return null
    return makeList(best.g, spec)
  }

  const makeList = (g: Group, spec: ItemSpec): WEl[] => {
    let group = g.items
    if (group.length > spec.max) {
      notes.push(`Kept the first ${spec.max} of ${group.length} ${spec.label.toLowerCase()}s (the most a ${type} section’s fields hold)`)
      const drop = new Set(group.slice(spec.max))
      g.parent.kids = g.parent.kids.filter((k) => !isEl(k) || !drop.has(k))
      group = group.slice(0, spec.max)
    }
    // The list holds only its items: content beside them (a heading, a brand column) stays
    // outside, and the items move into a wrapper that doesn't affect layout.
    let list = g.parent
    const kids = list.kids.filter(isEl)
    const first = kids.indexOf(group[0])
    const contiguous = group.every((it, i) => kids[first + i] === it)
    if (contiguous && kids.some((k) => !group.includes(k) && hasContent(k))) {
      const wrap = synth('div', list, 'contents', group)
      group.forEach((it) => (it.parent = wrap))
      list.kids = [...kids.slice(0, first), wrap, ...kids.slice(first + group.length)]
      list = wrap
    }
    list.block = 'list'
    list.list = spec.list
    lists.push(list)
    // An item that is itself a link keeps its link block inside a wrapper that doesn't affect layout.
    const out = group.map((it) => {
      if (it.text === undefined || !isPressable(it) || spec.list === 'logos') {
        it.block = 'item'
        it.label = spec.label
        return it
      }
      const wrap = synth('span', list, 'contents', [it])
      wrap.block = 'item'
      wrap.label = spec.label
      list.kids = list.kids.map((k) => (k === it ? wrap : k))
      it.parent = wrap
      return wrap
    })
    items.push(...out)
    return out
  }

  const leafCount = (g: Group) => g.items.reduce((n, it) => n + leavesOf(it).length, 0)
  const itemSpec = ITEMS[type]

  if (type === 'testimonials') {
    const quotes = pick(QUOTES, (g) => (g.items.every((it) => leavesOf(it).some((l) => (l.text ?? '').length >= 40)) ? leafCount(g) : 0))
    quotes?.forEach((it, i) => fillItem(it, i + 1, QUOTES, give))
    const stats = pick(QUOTE_STATS, (g) => (g.items.every((it) => leavesOf(it).length <= 3 && leavesOf(it).some((l) => HAS_DIGIT.test(l.text ?? '') && (l.text ?? '').length <= 8)) ? leafCount(g) : 0))
    stats?.forEach((it, i) => fillItem(it, i + 1, QUOTE_STATS, give))
    const logos = pick(QUOTE_LOGOS, (g) => (g.items.length >= 3 && g.items.every((it) => leavesOf(it).length <= 1) ? g.items.length : 0))
    logos?.forEach((it, i) => fillLogo(it, i + 1, give))
    if (!quotes) {
      // One big quote: the longest copy is the quote, then who said it.
      const ls = leavesOf(root).filter((l) => !inMirror(l))
      const q = [...ls].sort((a, b) => (b.text ?? '').length - (a.text ?? '').length)[0]
      if (q && (q.text ?? '').length >= 40 && give(q, 'q1Quote')) {
        q.block = 'text'
        const after = ls.slice(ls.indexOf(q) + 1).filter((l) => (l.text ?? '').length <= 60)
        const name = [...after].sort((a, b) => loudness(b) - loudness(a))[0]
        if (name && give(name, 'q1Name')) name.block = 'text'
        const role = after.find((l) => l !== name)
        if (role && give(role, 'q1Role')) role.block = 'text'
      }
    }
  } else if (itemSpec) {
    const items = pick(itemSpec, (g) => scoreGroup(g, type))
    if (items) {
      items.forEach((it, i) => {
        if (type === 'logos') fillLogo(it, i + 1, give)
        else if (type === 'nav') fillLink(it, i + 1, give)
        else fillItem(it, i + 1, itemSpec, give)
        if (itemSpec.nested) {
          const nested = itemSpec.nested
          const sub = pick({ ...nested, roles: [] }, (g) => (contains(it, g.parent) && g.items.every((x) => leavesOf(x).length === 1) ? g.items.length : 0), it)
          sub?.forEach((x, j) => {
            const leaf = x.text !== undefined ? x : leavesOf(x)[0]
            if (leaf && give(leaf, nested.field(i + 1, j + 1))) leaf.block = isPressable(leaf) || closest(leaf, isPressable) ? 'link' : 'text'
            if (leaf?.block === 'link' && !isPressable(leaf)) {
              leaf.block = undefined
              const a = closest(leaf, isPressable)
              if (a) a.block = 'link'
            }
          })
        }
      })
    }
  }
  setParents(root)

  // Section-level copy.
  const rest = () => leavesOf(root).filter((l) => !l.field && !inMirror(l) && !items.some((it) => contains(it, l)))
  if (type === 'nav') navCopy(root, rest(), give, ctx)
  else if (type === 'footer') footerCopy(root, rest(), give, ctx)
  else {
    // Copy after the list (a pricing footnote) reads as the section's note.
    const order = leavesOf(root)
    const lastItemLeaf = Math.max(-1, ...order.map((l, i) => (items.some((it) => contains(it, l)) ? i : -1)))
    sectionCopy(type, rest(), give, (l) => lastItemLeaf >= 0 && order.indexOf(l) > lastItemLeaf)
  }

  // Mirrors (the hidden half of a marquee) follow their originals' fields.
  for (const [copy, original] of mirrors) {
    const a = leavesOf(original)
    const b = leavesOf(copy)
    b.forEach((l, i) => {
      if (a[i]?.field) l.mirror = a[i].field
    })
  }

  markBlocks(root, lists)

  const unfielded = leavesOf(root)
    .filter((l) => !l.field && !l.mirror && clean(l.text ?? '').length > 0)
    .map((l) => clean(l.text ?? ''))
  const brand = ctx.siteName.toLowerCase()
  const brandy = brand.length > 2 ? unfielded.filter((t) => t.toLowerCase().includes(brand)) : []
  if (unfielded.length)
    notes.push(`${unfielded.length} piece${unfielded.length > 1 ? 's' : ''} of copy had no field in the ${type} schema and stay as static text: ${unfielded.slice(0, 4).map((t) => `“${t.slice(0, 40)}”`).join(', ')}${unfielded.length > 4 ? '…' : ''}`)
  if (brandy.length) notes.push(`Static text mentions the source brand (rule 8); edit or remove: ${brandy.map((t) => `“${t.slice(0, 40)}”`).join(', ')}`)
  return { notes, unfielded }
}

function scoreGroup(g: Group, type: SectionType): number {
  const per = g.items.map((it) => leavesOf(it).length)
  const total = per.reduce((a, b) => a + b, 0)
  const min = Math.min(...per)
  switch (type) {
    case 'nav':
      // Links, not the call to action.
      if (g.items.some((it) => (it.text !== undefined ? isButtonish(it) : leavesOf(it).some((l) => closest(l, isButtonish))))) return 0
      return min === 1 && Math.max(...per) === 1 ? g.items.length : 0
    case 'logos':
      return g.items.every((it) => (leavesOf(it).length <= 1)) ? g.items.length * 2 : 0
    case 'footer':
      return g.items.filter((it) => repeatGroups(it).some((sub) => sub.items.length >= 2)).length >= 2 ? total : 0
    case 'pricing':
      return min >= 2 && g.items.some((it) => leavesOf(it).some((l) => PRICE.test(l.text ?? ''))) ? total : 0
    case 'stats':
      return min >= 1 && g.items.every((it) => leavesOf(it).some((l) => HAS_DIGIT.test(l.text ?? ''))) ? total : 0
    default:
      // Buttons side by side aren't a list of features.
      if (g.items.every((it) => isPressable(it) && isButtonish(it))) return 0
      return min >= 1 ? total + g.items.length : 0
  }
}

type Give = (leaf: WEl, field: string) => boolean

function fillItem(it: WEl, i: number, spec: ItemSpec, give: Give) {
  const nestedLists = allEls(it).filter((e) => e !== it && e.block === 'list')
  const leaves = (it.text !== undefined ? [it] : leavesOf(it)).filter((l) => !nestedLists.some((n) => contains(n, l)))
  const free = new Set(leaves)
  const take = (role: Role): WEl | undefined => {
    const fl = [...free]
    const by = (score: (l: WEl) => number) => fl.sort((a, b) => score(b) - score(a))[0]
    const len = (l: WEl) => (l.text ?? '').length
    const pressed = (l: WEl) => !!closest(l, (p) => isButtonish(p) && contains(it, p))
    switch (role) {
      case 'button':
        return fl.find(pressed)
      case 'price':
        return fl.filter((l) => PRICE.test(l.text ?? '') && !pressed(l)).sort((a, b) => loudness(b) - loudness(a))[0]
      case 'price2':
        return fl.find((l) => PRICE.test(l.text ?? '') && !pressed(l))
      case 'value':
        return fl.filter((l) => HAS_DIGIT.test(l.text ?? '')).sort((a, b) => loudness(b) - loudness(a))[0]
      case 'quote':
        return by(len)
      case 'title': {
        const q = fl.find((l) => closest(l, (p) => p.tag === 'summary' || p.tag === 'dt' || (p.tag === 'button' && contains(it, p))))
        return q ?? fl.filter((l) => !pressed(l)).find((l) => HEADING_TAGS.has(l.tag)) ?? fl.filter((l) => !pressed(l)).sort((a, b) => loudness(b) - loudness(a) || leaves.indexOf(a) - leaves.indexOf(b))[0]
      }
      case 'name':
        return fl.filter((l) => len(l) <= 48 && !pressed(l)).sort((a, b) => loudness(b) - loudness(a) || leaves.indexOf(a) - leaves.indexOf(b))[0]
      case 'role':
        return fl.filter((l) => len(l) <= 80 && !pressed(l)).sort((a, b) => leaves.indexOf(a) - leaves.indexOf(b))[0]
      case 'body':
        return fl.filter((l) => !pressed(l)).sort((a, b) => len(b) - len(a))[0]
      case 'meta':
        return fl.filter((l) => !pressed(l)).sort((a, b) => fontSize(a) - fontSize(b))[0]
      case 'any':
        return leaves.find((l) => free.has(l))
    }
  }
  const BLOCK: Record<Role, 'heading' | 'text' | 'button'> = { title: 'heading', name: 'heading', price: 'heading', value: 'heading', price2: 'text', body: 'text', quote: 'text', role: 'text', meta: 'text', button: 'button', any: 'text' }
  for (const [role, name] of spec.roles) {
    const leaf = take(role)
    if (!leaf || !give(leaf, name(i))) continue
    free.delete(leaf)
    if (role === 'button') blockPressable(leaf, it)
    else leaf.block = BLOCK[role]
  }
}

function fillLogo(it: WEl, i: number, give: Give) {
  // A logo picture becomes a wordmark: the item holds the logo's name as its copy.
  const art = it.block === 'image' ? it : allEls(it).find((e) => e.block === 'image')
  const leaf = it.text !== undefined ? it : leavesOf(it)[0]
  if (!leaf && art) {
    art.text = clean(art.media?.alt ?? '') || `Logo ${i}`
    art.block = undefined
    art.synthetic = 'wordmark'
    art.kids = []
    if (art.parent && art !== it && els(it).length === 1) {
      // The item is just the logo: put the copy on the item itself.
      it.text = art.text
      it.synthetic = it.synthetic ?? undefined
      it.kids = []
      it.extra = { ...it.extra, ...wordmarkCss() }
      give(it, `logo${i}`)
      return
    }
    art.extra = { ...art.extra, ...wordmarkCss() }
    give(art, `logo${i}`)
    return
  }
  if (leaf) give(leaf, `logo${i}`)
}

function fillLink(it: WEl, i: number, give: Give) {
  const leaf = leavesOf(it)[0] ?? (it.text !== undefined ? it : undefined)
  if (!leaf || !give(leaf, `link${i}`)) return
  blockPressable(leaf, it, 'link')
}

/** The pressable a leaf sits in gets the block; the leaf itself keeps the field. */
function blockPressable(leaf: WEl, within: WEl, kind: 'button' | 'link' = 'button') {
  const p = closest(leaf, (e) => isPressable(e) && (contains(within, e) || e === within)) ?? leaf
  p.block = kind === 'link' && isButtonish(p) ? 'button' : kind
  if (p !== leaf) leaf.block = undefined
}

export const wordmarkCss = () => ({
  'font-family': 'var(--mx-font-display)',
  'font-weight': '700',
  'font-size': 'var(--mx-text-lg)',
  'letter-spacing': '-0.01em',
  'white-space': 'nowrap',
})

function sectionCopy(type: SectionType, leaves: WEl[], give: Give, afterList: (l: WEl) => boolean) {
  const schema = new Set(FIELD_SCHEMA[type])
  const pressed = (l: WEl) => closest(l, isButtonish)
  const linked = (l: WEl) => closest(l, isPressable)
  const free = (l: WEl) => !l.field

  // Pieces only some sections have.
  if (type === 'content') {
    const q = leaves.find((l) => closest(l, (p) => p.tag === 'blockquote' || p.tag === 'q'))
    if (q && give(q, 'quote')) q.block = 'text'
    const c = leaves.find((l) => closest(l, (p) => p.tag === 'figcaption'))
    if (c && give(c, 'caption')) c.block = 'text'
  }
  if (type === 'contact') {
    for (const l of leaves) {
      const t = l.text ?? ''
      if (/\S+@\S+\.\S+/.test(t) && give(l, 'email')) l.block = linked(l) ? undefined : 'text'
      else if (/(\+?\d[\d\s().-]{6,}\d)/.test(t) && t.replace(/\D/g, '').length >= 7 && t.length < 30 && give(l, 'phone')) l.block = linked(l) ? undefined : 'text'
      else if (closest(l, (p) => p.tag === 'address') && give(l, 'address')) l.block = 'text'
      const a = linked(l)
      if (l.field && a && !pressed(l)) a.block = 'link'
    }
    const labels = leaves.filter((l) => free(l) && closest(l, (p) => p.tag === 'label'))
    for (const l of labels) {
      const lab = closest(l, (p) => p.tag === 'label')!
      const input = allEls(lab).find((e) => /^(input|textarea|select)$/.test(e.tag)) ?? nextInput(lab)
      const kind = input?.tag === 'textarea' ? 'messageLabel' : /email/.test(hint(input ?? lab, 'type') ?? hint(input ?? lab, 'name') ?? '') ? 'emailLabel' : 'nameLabel'
      if (give(l, kind)) l.block = 'text'
    }
  }

  const rest = () => leaves.filter(free)
  const heading = rest()
    .filter((l) => !pressed(l))
    .sort((a, b) => loudness(b) - loudness(a) || leaves.indexOf(a) - leaves.indexOf(b))[0]
  const headingName = type === 'hero' ? 'headline' : 'heading'
  // A small label on its own (“Trusted by teams at”) is an eyebrow, not a heading.
  const small = heading && (fontSize(heading) <= 14 || heading.s['text-transform'] === 'uppercase')
  const hasHeading = heading && !(small && !HEADING_TAGS.has(heading.tag)) && (HEADING_TAGS.has(heading.tag) || fontSize(heading) >= 20 || loudness(heading) >= loudness(leaves[leaves.length - 1]) * 1.15)
  if (hasHeading && give(heading, headingName)) heading.block = 'heading'
  else if (heading && small && schema.has('eyebrow') && give(heading, 'eyebrow')) heading.block = 'badge'

  const hIndex = hasHeading ? leaves.indexOf(heading) : -1
  const before = hIndex > 0 ? leaves.slice(0, hIndex).filter((l) => free(l) && !pressed(l) && (l.text ?? '').length <= 60) : []
  const eyebrow = before[before.length - 1]
  if (eyebrow && schema.has('eyebrow') && give(eyebrow, 'eyebrow')) eyebrow.block = 'badge'

  const buttonNames = { hero: ['ctaPrimary', 'ctaSecondary'], cta: ['ctaPrimary', 'ctaSecondary'], header: ['ctaPrimary'], blog: ['cta'], faq: ['contactCta'], contact: ['submit'] }[type as string] ?? []
  const buttons = rest().filter((l) => pressed(l))
  // The solid one is the primary action.
  buttons.sort((a, b) => Number(isSolid(pressed(b)!)) - Number(isSolid(pressed(a)!)) || leaves.indexOf(a) - leaves.indexOf(b))
  const links = rest().filter((l) => !pressed(l) && linked(l) && (l.text ?? '').length <= 40)
  const actions = [...buttons, ...links]
  for (const name of buttonNames) {
    const l = actions.shift()
    if (l && give(l, name)) blockPressable(l, l.parent ?? l, pressed(l) ? 'button' : 'link')
  }
  const lastAction = Math.max(-1, ...leaves.filter((l) => l.field && buttonNames.includes(l.field)).map((l) => leaves.indexOf(l)))

  const textNames = { hero: ['subhead'], cta: ['body'], content: ['lead', 'body1', 'body2', 'body3'] }[type as string] ?? (schema.has('intro') ? ['intro'] : [])
  const noteName = { hero: 'note', cta: 'note', contact: 'note', pricing: 'footnote', faq: 'contactText' }[type as string]
  const texts = rest().filter((l) => !pressed(l) && !linked(l) && leaves.indexOf(l) > hIndex)
  for (const l of texts) {
    const afterActions = (lastAction >= 0 && leaves.indexOf(l) > lastAction) || afterList(l)
    if (afterActions && noteName) {
      if (give(l, noteName)) l.block = 'text'
      continue
    }
    const name = textNames.find((n) => schema.has(n) && !leaves.some((x) => x.field === n))
    if (name && give(l, name)) l.block = 'text'
    else if (noteName && give(l, noteName)) l.block = 'text'
  }
}

function nextInput(label: WEl): WEl | undefined {
  const sibs = label.parent ? els(label.parent) : []
  return sibs.slice(sibs.indexOf(label) + 1).find((e) => /^(input|textarea|select)$/.test(e.tag))
}

function brandFrom(leaves: WEl[], root: WEl, give: Give, siteName: string): WEl | undefined {
  // The first thing in a nav or footer is the brand: its words, or its logo turned into a wordmark.
  const firstLeaf = leaves[0]
  const logo = allEls(root).find((e) => (e.block === 'image' || (e.svgNode && !e.icon && e.rect[2] > 40)) && !closest(e, (p) => p.block === 'list'))
  const order = new Map(allEls(root).map((e, i) => [e, i]))
  const before = (a: WEl, b: WEl | undefined) => !b || order.get(a)! < order.get(b)!
  if (logo && before(logo, firstLeaf) && (!firstLeaf || !closest(firstLeaf, isPressable) || closest(firstLeaf, isPressable) !== closest(logo, isPressable))) {
    const host = closest(logo, isPressable) ?? logo
    const name = clean(logo.media?.alt ?? hint(host, 'aria-label') ?? hint(logo, 'aria-label') ?? '') || siteName || 'Brand'
    logo.svgNode = undefined
    logo.svg = undefined
    logo.media = undefined
    logo.block = undefined
    logo.text = name.replace(/\s*(home|logo)$/i, '') || name
    logo.kids = []
    logo.synthetic = 'wordmark'
    logo.extra = { ...wordmarkCss(), width: 'auto', height: 'auto', 'aspect-ratio': 'auto', background: 'none' }
    if (give(logo, 'brand')) {
      host.block = 'image'
      host.mediaName = 'logo'
      host.ratio = '4/1'
      if (host !== logo) logo.block = undefined
      return logo
    }
  }
  if (firstLeaf && !closest(firstLeaf, isButtonish) && give(firstLeaf, 'brand')) {
    const a = closest(firstLeaf, isPressable)
    if (a && a !== firstLeaf) a.block = 'link'
    else firstLeaf.block = a ? 'link' : 'text'
    return firstLeaf
  }
  return undefined
}

function navCopy(root: WEl, leaves: WEl[], give: Give, ctx: { siteName: string }) {
  brandFrom(leaves, root, give, ctx.siteName)
  const rest = leaves.filter((l) => !l.field)
  const cta = [...rest].reverse().find((l) => closest(l, isButtonish))
  if (cta && give(cta, 'cta')) blockPressable(cta, root)
  // Links outside a list still get link fields.
  let n = 1
  for (const l of rest) {
    if (l.field || !closest(l, isPressable)) continue
    while (n <= 4 && leavesOf(root).some((x) => x.field === `link${n}`)) n++
    if (n > 4) break
    if (give(l, `link${n}`)) blockPressable(l, root, 'link')
  }
}

function footerCopy(root: WEl, leaves: WEl[], give: Give, ctx: { siteName: string }) {
  brandFrom(leaves, root, give, ctx.siteName)
  const rest = () => leaves.filter((l) => !l.field)
  const legal = [...rest()].reverse().find((l) => /©|&copy;|\(c\)|all rights|rights reserved|\b(19|20)\d{2}\b/i.test(l.text ?? ''))
  if (legal && give(legal, 'legal')) legal.block = 'text'
  const btn = rest().find((l) => closest(l, isButtonish))
  if (btn && give(btn, 'ctaButton')) blockPressable(btn, root)
  const heading = rest()
    .filter((l) => !closest(l, isPressable) && (HEADING_TAGS.has(l.tag) || fontSize(l) >= 22))
    .sort((a, b) => loudness(b) - loudness(a))[0]
  if (heading && give(heading, 'ctaHeading')) heading.block = 'heading'
  const tagline = rest().find((l) => !closest(l, isPressable) && (l.text ?? '').length >= 12)
  if (tagline && give(tagline, 'tagline')) tagline.block = 'text'
}

/** Hidden duplicates (a marquee's second half): copy → original. */
function markMirrors(root: WEl): Map<WEl, WEl> {
  const out = new Map<WEl, WEl>()
  const visit = (el: WEl) => {
    const kids = els(el)
    for (let i = 1; i < kids.length; i++) {
      const k = kids[i]
      if (hint(k, 'aria-hidden') !== 'true') continue
      const twin = kids.slice(0, i).find((o) => !out.has(o) && clean(textOf(o)) === clean(textOf(k)) && clean(textOf(k)))
      if (twin) out.set(k, twin)
    }
    // A list whose second half repeats its first half: the second half mirrors.
    if (kids.length >= 4 && kids.length % 2 === 0) {
      const h = kids.length / 2
      if (kids.slice(0, h).every((k, i) => clean(textOf(k)) === clean(textOf(kids[i + h])) && clean(textOf(k)))) kids.slice(h).forEach((k, i) => out.set(k, kids[i]))
    }
    for (const k of kids) if (!out.has(k)) visit(k)
  }
  visit(root)
  return out
}

function markBlocks(root: WEl, lists: WEl[]) {
  let images = 0
  let avatars = 0
  const all = allEls(root)
  for (const e of all) {
    if (e === root) continue
    // Icons that stand alone (not inside a button or link).
    if (e.svgNode && e.icon && !closest(e, (p) => isPressable(p) || p.block === 'image')) {
      const p = e.parent!
      const wrapper = p !== root && !p.block && els(p).length === 1 && p.text === undefined && !leavesOf(p).length
      ;(wrapper ? p : e).block = 'icon'
    }
    if (/^(input|textarea|select)$/.test(e.tag)) e.block = 'input'
    if (e.block === 'image' && !e.mediaName) {
      const [, , w, h] = e.rect
      const round = /50%|999/.test(e.s['border-top-left-radius'] ?? '') || (w > 0 && Math.abs(w - h) < 2 && parseFloat(e.s['border-top-left-radius'] ?? '0') >= w / 2 - 1)
      e.mediaName = round && w <= 120 ? `avatar${++avatars}` : `image${++images}`
    }
  }
  // Cards: a filled or outlined group with copy of its own, that isn't an item or list.
  for (const e of all) {
    if (e === root || e.block || lists.some((l) => contains(e, l))) continue
    if (closest(e.parent ?? e, (p) => p.block === 'card' || p.block === 'item') && e.parent) continue
    const fielded = leavesOf(e).filter((l) => l.field)
    if (fielded.length >= 2 && (hasVisibleBox(e) || e.tag === 'form' || e.tag === 'blockquote' || e.tag === 'figure')) {
      e.block = 'card'
      e.label = e.tag === 'form' ? 'Form' : e.tag === 'blockquote' || e.tag === 'figure' ? 'Quote' : 'Panel'
    }
  }
  // Blocks can't nest inside small blocks: a leaf inside a button stays unmarked.
  for (const e of all) {
    if (!e.block || e.block === 'card' || e.block === 'item' || e.block === 'list') continue
    for (const d of allEls(e)) if (d !== e && d.block && d.block !== 'icon') d.block = undefined
    if (e.block !== 'button' && e.block !== 'link') for (const d of allEls(e)) if (d !== e) d.block = undefined
  }
}
