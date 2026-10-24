// Put a captured section on Blokmix's layout primitives (CLAUDE.md, "Layout primitives"): the same
// role names the built-in layouts use (.container, .head, .actions, .btn, .grid, .split, .band,
// .card, .media), and repeating units laid out as a real grid. The section keeps its own look; what
// changes is that it reads, edits and exports like every other section in the library.

import type { SectionType } from '@/core/types'
import { allEls, contains, els, leavesOf, px, type WEl } from './tree'
import { hasVisibleBox, isSolid, ownBg } from './roles'

const LEAD = new Set(['subhead', 'intro', 'lead'])
const META = /^(note|meta|p\d+Meta|q\d+Role|m\d+Role)$/
const BODY = /^(f\d+Body|faq\d+A|t\d+Desc|p\d+Excerpt|stat\d+Label|q\d+Quote)$/

const centered = (el: WEl, within: WEl) => {
  const left = el.rect[0] - within.rect[0]
  const right = within.rect[0] + within.rect[2] - (el.rect[0] + el.rect[2])
  return Math.abs(left - right) < 6
}
const heavy = (el: WEl) => allEls(el).some((e) => e !== el && (e.block === 'list' || e.block === 'item' || e.block === 'card' || e.block === 'image'))

export function normalize(root: WEl, type: SectionType): { notes: string[] } {
  const W = root.rect[2]
  const leaves = leavesOf(root)
  const roles: string[] = []
  const give = (el: WEl, role: string) => {
    if (el === root || el.role) return
    el.role = role
    roles.push(role.split(' ')[0])
  }

  // Blocks that already say what they are.
  for (const el of allEls(root)) {
    if (el.block === 'button') give(el, isSolid(el) ? 'btn primary' : 'btn secondary')
    else if (el.block === 'heading' && (el.field === 'headline' || (type === 'hero' && el.field === 'heading'))) give(el, 'heading display')
    else if (el.field && LEAD.has(el.field)) give(el, 'lead')
    else if (el.field && BODY.test(el.field)) give(el, 'body')
    else if (el.field && META.test(el.field)) give(el, 'meta')
  }

  // The content column: a centered box narrower than the section, holding most of its copy.
  for (let el: WEl | undefined = root; el; ) {
    const kids = els(el)
    const main = kids.find((k) => k.rect[2] < W - 40 && k.rect[2] > 240 && centered(k, root) && leavesOf(k).length >= leaves.length * 0.6)
    if (main) {
      give(main, main.rect[2] <= 800 ? 'container narrow' : 'container')
      break
    }
    el = kids.length === 1 ? kids[0] : undefined
  }

  // The header group: the widest box around the section heading that holds copy and buttons only.
  const heading = leaves.find((l) => l.block === 'heading' && (l.field === 'heading' || l.field === 'headline'))
  if (heading) {
    let head: WEl = heading
    for (let p = heading.parent; p && p !== root && !p.role?.startsWith('container') && !heavy(p); p = p.parent) head = p
    if (head !== heading && leavesOf(head).filter((l) => l.field).length >= 2) give(head, /center/.test(head.s['text-align'] ?? '') || centered(heading, head) ? 'head center' : 'head')
  }

  // Button rows.
  for (const el of allEls(root)) {
    const kids = els(el)
    if (kids.length >= 2 && kids.every((k) => k.block === 'button' || k.block === 'link') && kids.some((k) => k.block === 'button')) give(el, 'actions')
  }

  // Repeating units: a list whose items sit in columns is a grid, and a flex row of equal items becomes one,
  // so an added or duplicated item wraps into place.
  let grids = 0
  for (const list of allEls(root).filter((e) => e.block === 'list')) {
    const items = els(list).filter((i) => i.block === 'item')
    if (items.length < 2) continue
    for (const it of items) give(it, hasVisibleBox(it) ? 'card' : 'item')
    const firstRow = items.filter((i) => Math.abs(i.rect[1] - items[0].rect[1]) < 8)
    const cols = firstRow.length
    if (cols < 2) continue
    give(list, 'grid')
    const equal = items.every((i) => Math.abs(i.rect[2] - items[0].rect[2]) < 4)
    if (/flex/.test(list.s.display ?? '') && equal && list.text === undefined) {
      const colGap = cols > 1 ? Math.max(0, firstRow[1].rect[0] - (firstRow[0].rect[0] + firstRow[0].rect[2])) : 0
      const second = items.find((i) => i.rect[1] > items[0].rect[1] + 8)
      const rowGap = second ? Math.max(0, second.rect[1] - (items[0].rect[1] + items[0].rect[3])) : colGap
      list.s.display = 'grid'
      list.s['grid-template-columns'] = Array(cols).fill(`${Math.round(items[0].rect[2])}px`).join(' ')
      list.s['column-gap'] = `${colGap}px`
      list.s['row-gap'] = `${rowGap}px`
      for (const it of items) {
        it.s['flex-grow'] = '0'
        it.s['flex-shrink'] = '1'
        it.s['flex-basis'] = 'auto'
      }
      grids++
    }
  }
  for (const el of allEls(root)) if (el.block === 'card') give(el, hasVisibleBox(el) && !ownBg(el) ? 'card' : 'card soft')
  for (const el of allEls(root)) if (el.block === 'image' || el.synthetic === 'art') give(el, 'media')

  // Copy beside a picture.
  for (const el of allEls(root)) {
    const kids = els(el).filter((k) => (k.s.position ?? 'static') === 'static')
    if (kids.length !== 2) continue
    const [a, b] = kids
    const side = Math.abs(a.rect[1] - b.rect[1]) < 60 && b.rect[0] >= a.rect[0] + a.rect[2] - 4 && a.rect[2] > el.rect[2] * 0.28 && b.rect[2] > el.rect[2] * 0.28
    const pic = (k: WEl) => k.block === 'image' || allEls(k).some((e) => e.block === 'image')
    if (side && (pic(a) !== pic(b)) && (heading ? contains(a, heading) || contains(b, heading) : true)) give(el, 'split')
  }

  // An inset panel in its own color, holding the section's header.
  for (const el of allEls(root)) {
    if (el.role || !heading || !contains(el, heading) || el.rect[2] < W * 0.6 || el.rect[2] > W - 8) continue
    if (ownBg(el) && px(el.s['padding-top']) >= 24) give(el, 'band')
  }

  const named = [...new Set(roles)].filter((r) => /^(container|head|actions|grid|split|band|card)$/.test(r))
  const notes: string[] = []
  if (named.length) notes.push(`Laid out on Blokmix’s primitives (${named.map((r) => `.${r}`).join(', ')})${grids ? `; ${grids} repeating row${grids > 1 ? 's' : ''} became a grid, so new items wrap into place` : ''}`)
  return { notes }
}
