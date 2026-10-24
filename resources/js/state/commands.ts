import type { LinkTarget, BlockEdit, BlockInfo, BlockMotion, BlockStyle, Choice, MediaFill, Keep, Note, NoteAnchor, Slot, TokenKey } from '@/core/types'
import { isMark, MARK_GUIDANCE, SOURCE_LABEL, sortMarks } from '@/core/notes'
import { detectLink } from '@/core/media'
import { ICON_NAMES, ICON_SETS, blockIconName } from '@/core/icons'
import { COMMANDS, toolDefinitions, type CommandInput, type CommandName } from '@/core/commands/schema'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { effectiveEdit } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { advise, suggestedVariants } from '@/core/advise'
import { suggestClip, suggestTypes } from '@/core/suggest'
import { resolveGuide, openGroups } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { pressVersionAndFly } from '@/lib/actions'
import { sectionAnchors, sectionLinks } from '@/core/links'
import { PROVIDER_LABEL, PROVIDER_LICENSE, findLibraryFont, fontStack, searchFonts } from '@/core/fonts'
import { editList, listContext, ListError, type ListOp } from '@/core/lists'
import { outline, contentJson, type OutlineList, type OutlineNode } from '@/core/outline'
import { parseHtml } from '@/core/html/parse'
import { keepOption, putBackOption, retireOption, showWords, wordChoices } from '@/core/words'
import { useStore } from './store'

/**
 * Runs the commands in core/commands/schema.ts against the live mix. Every
 * write is validated, goes through the same store actions as the app's own
 * controls, and lands as one undo step, so an agent's change is as easy to
 * take back as yours.
 */
export type Caller = 'you' | 'agent'

export class CommandError extends Error {}

export function runCommand(name: string, raw: unknown, by: Caller = 'agent'): unknown {
  if (!(name in COMMANDS)) throw new CommandError(`Unknown command "${name}". Known: ${Object.keys(COMMANDS).join(', ')}`)
  const cmd = COMMANDS[name as CommandName]
  const parsed = cmd.input.safeParse(raw ?? {})
  if (!parsed.success) throw new CommandError(`Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`)
  const input = parsed.data
  if (!cmd.write) return READ[name as keyof typeof READ](input as never)

  // One undo step for the whole command, however many store updates it makes.
  // (Notes are part of the undoable state, so an agent's marks are one ⌘Z away too.)
  const t = useStore.temporal.getState()
  const s = useStore.getState()
  const before = { slots: s.slots, guide: s.guide, content: s.content, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head }
  t.pause()
  let result: unknown
  try {
    result = WRITE[name as keyof typeof WRITE](input as never)
  } finally {
    t.resume()
  }
  const after = useStore.getState()
  if (after.slots !== before.slots || after.guide !== before.guide || after.content !== before.content || after.versions !== before.versions || after.notes !== before.notes) {
    useStore.temporal.setState((x) => ({ pastStates: [...x.pastStates, before].slice(-100), futureStates: [] }))
    if (by === 'agent') after.showFlash(`Agent: ${summary(name, input)}`, { undo: true })
  }
  return result
}

export const tools = toolDefinitions

/* ---------- references ---------- */

function findSection(ref: string | number): Slot {
  const { slots } = useStore.getState()
  if (typeof ref === 'string' && /^\d+$/.test(ref)) ref = Number(ref)
  const hit =
    typeof ref === 'number'
      ? slots[ref - 1]
      : (slots.find((s) => s.id === ref) ?? slots.find((s) => s.type === ref.toLowerCase()) ?? slots.find((s) => TYPE_LABEL[s.type].toLowerCase() === ref.toLowerCase()))
  if (!hit) throw new CommandError(`No section "${ref}". Sections: ${slots.map((s, i) => `${i + 1} ${s.type} (${s.id})`).join(', ')}`)
  return hit
}

function findBlock(slot: Slot, ref: string): BlockInfo {
  const blocks = slotClip(slot).blocks
  const r = ref.trim().toLowerCase()
  const hit = blocks.find((b) => b.id === ref) ?? blocks.find((b) => b.label.toLowerCase() === r) ?? blocks.find((b) => b.label.toLowerCase().endsWith(r))
  if (!hit) throw new CommandError(`No block "${ref}" in ${TYPE_LABEL[slot.type]}. Blocks: ${blocks.map((b) => `${b.id} ${b.label}`).join('; ')}`)
  return hit
}

function findNote(ref: string | number) {
  const marks = useStore.getState().notes.filter(isMark)
  const n = typeof ref === 'number' ? ref : /^n?\d+$/i.test(ref) ? Number(ref.replace(/^n/i, '')) : null
  const hit = n !== null ? marks.find((m) => m.number === n) : marks.find((m) => m.id === ref)
  if (!hit) throw new CommandError(`No mark "${ref}". Marks: ${marks.map((m) => `N${m.number}`).join(', ') || 'none yet'}`)
  return hit
}

/** A mark as an agent reads it: what it's on in words, never selectors. */
export function describeNote(n: Note) {
  const st = useStore.getState()
  const a = n.anchor
  let on = 'the whole page'
  let section: string | null = null
  if ('slotId' in a) {
    const slot = st.slots.find((s) => s.id === a.slotId)
    section = slot?.id ?? null
    const name = slot ? `${TYPE_LABEL[slot.type]} (section ${st.slots.indexOf(slot) + 1})` : 'a removed section'
    if (a.kind === 'block') on = `${a.label}${slot && slot.clipId !== a.clipId ? ' (on a clip that’s no longer shown)' : ''}`
    else if (a.kind === 'words') on = `the words “${a.quote}” in ${a.label} (field ${a.field})`
    else if (a.kind === 'area') on = `an area of ${name} (${Math.round(a.rect.x * 100)}% across, ${Math.round(a.rect.y * 100)}% down, ${Math.round(a.rect.w * 100)}% × ${Math.round(a.rect.h * 100)}%)`
    else on = name
  }
  return {
    id: n.id,
    number: `N${n.number}`,
    kind: n.kind,
    status: n.status,
    by: n.source ? SOURCE_LABEL[n.source] : 'You',
    on,
    section,
    block: a.kind === 'block' || a.kind === 'words' ? a.blockId : null,
    field: a.kind === 'words' ? a.field : null,
    quote: a.kind === 'block' || a.kind === 'words' ? (a.quote ?? null) : null,
    text: n.text,
    suggestedCopy: n.suggestedCopy ?? null,
    resolution: n.resolution ?? null,
    replies: (n.replies ?? []).map((r) => ({ by: r.author, text: r.text })),
  }
}

function wordsFor(slot: Slot) {
  const clip = slotClip(slot)
  return resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
}

function describeSection(slot: Slot, position: number) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  const words = wordsFor(slot)
  const links = sectionLinks(clip.blocks, slot.edits?.[clip.id], words, st.slots, slot.id, sectionAnchors(st.slots))
  return {
    id: slot.id,
    position,
    type: slot.type,
    label: TYPE_LABEL[slot.type],
    clip: { id: clip.id, title: clip.title, origin: clip.origin, source: library.sources[clip.sourceId]?.name, rhythm: clip.rhythm ?? null },
    keep: { layout: slot.keep.layout, style: slot.keep.style, copy: slot.keep.content, motion: slot.keep.motion, locked: slot.locked },
    spacing: slot.spacing ?? {},
    motion: slot.motion ?? { mode: slot.keep.motion ? 'captured' : 'none' },
    words,
    blocks: clip.blocks.map((b) => {
      const e = effectiveEdit(slot.edits?.[clip.id]?.[b.id], st.guide.components?.[b.kind])
      return {
        id: b.id,
        label: b.label,
        kind: b.kind,
        parent: b.parent,
        field: b.field ?? null,
        words: b.field ? words[b.field] : null,
        look: e?.variant ?? null,
        style: e?.style ?? null,
        motion: e?.motion ?? null,
        image: b.kind === 'image' ? (e?.media ?? null) : undefined,
        link: b.linkable ? links[b.id]?.href : undefined,
        hidden: !!e?.hidden,
      }
    }),
  }
}

function findList(slot: Slot, ref: string): BlockInfo {
  const lists = slotClip(slot).blocks.filter((b) => b.kind === 'list')
  const r = ref.trim().toLowerCase()
  const hit =
    lists.find((b) => b.id === ref) ??
    lists.find((b) => b.label.toLowerCase() === r) ??
    lists.find((b) => b.list?.toLowerCase() === r && b.listKey) ??
    lists.find((b) => b.list?.toLowerCase() === r) ??
    lists.find((b) => b.label.toLowerCase().endsWith(r))
  if (!hit) throw new CommandError(`No list "${ref}" in ${TYPE_LABEL[slot.type]}. Lists: ${lists.map((b) => `${b.id} ${b.label}`).join('; ') || 'none'}`)
  return hit
}

function outlineOf(slot: Slot): OutlineNode[] {
  return outline(parseHtml(slotClip(slot).html))
}

function findOutlineList(nodes: OutlineNode[], id: string): OutlineList | undefined {
  for (const n of nodes) {
    if (n.t !== 'list') continue
    if (n.id === id) return n
    for (const it of n.items) {
      const hit = findOutlineList(it.nodes, id)
      if (hit) return hit
    }
  }
  return undefined
}

/** A section's list change, with the list's own explanation when it can't be done. */
function changeList(slot: Slot, change: ListOp): Slot {
  try {
    return editList(slot, slotClip(slot), useStore.getState().content, change)
  } catch (e) {
    if (e instanceof ListError) throw new CommandError(e.message)
    throw e
  }
}

const putSlot = (next: Slot) => useStore.setState((st) => ({ slots: st.slots.map((x) => (x.id === next.id ? next : x)) }))

const itemsOf = (slot: Slot, listId: string) => slotClip(slot).blocks.filter((b) => b.parent === listId && b.kind === 'item')

const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/* ---------- reads ---------- */

const READ = {
  get_page: (i: CommandInput<'get_page'>) => {
    const st = useStore.getState()
    const guide = resolveGuide(st.guide)
    const sections = i.section !== undefined ? [findSection(i.section)] : st.slots
    return {
      mix: st.mixName,
      mode: st.ui.mode === 'unified' ? 'your style' : 'original',
      sections: sections.map((s) => describeSection(s, st.slots.indexOf(s) + 1)),
      styleGuide: {
        tokens: guide.tokens,
        openDecisions: openGroups(guide),
        brandColours: st.guide.swatches ?? [],
        lookForAll: st.guide.components ?? {},
      },
      focused: st.ui.focusedSlotId,
      selectedBlock: st.ui.selectedBlockId,
    }
  },
  get_content: (i: CommandInput<'get_content'>) => {
    const st = useStore.getState()
    const sections = i.section !== undefined ? [findSection(i.section)] : st.slots
    return sections.map((s) => {
      const clip = slotClip(s)
      const nodes = outlineOf(s)
      const lists: unknown[] = []
      const collect = (ns: OutlineNode[], at: string) => {
        for (const n of ns) {
          if (n.t !== 'list') continue
          const ctx = listContext(clip, s, n.id)
          lists.push({
            id: n.id,
            name: n.key,
            at: `${at}${n.key}`,
            label: clip.blocks.find((b) => b.id === n.id)?.label,
            items: n.items.length,
            editable: !!ctx,
            ...(ctx ? { max: ctx.max } : { why: 'Its items are set by the layout.' }),
          })
          n.items.forEach((it, ix) => collect(it.nodes, `${at}${n.key}/${ix}/`))
        }
      }
      collect(nodes, '')
      const options = Object.fromEntries(
        Object.keys(clip.fields).flatMap((f) => {
          const kept = wordChoices(clip, s, st.content, f).filter((c) => c.kind === 'kept')
          const retired = (s.options?.[f] ?? []).filter((o) => o.retiredAt)
          return kept.length || retired.length ? [[f, { kept: kept.map((c) => ({ text: c.text, by: c.option?.by ?? 'you' })), retired: retired.map((o) => o.text) }]] : []
        }),
      )
      return { section: s.id, position: st.slots.indexOf(s) + 1, type: s.type, content: contentJson(nodes, wordsFor(s)), lists, options }
    })
  },
  list_fonts: (i: CommandInput<'list_fonts'>) => {
    const fonts = searchFonts({ query: i.query, vibe: i.vibe, role: i.role, provider: i.source })
    return {
      count: fonts.length,
      fonts: fonts.map((f) => ({ family: f.family, by: f.maker ?? null, source: PROVIDER_LABEL[f.provider], license: PROVIDER_LICENSE[f.provider], vibes: f.vibes, goodFor: f.role, weights: f.weights })),
      current: Object.fromEntries((['font.display', 'font.body', 'font.mono'] as const).map((k) => [k, resolveGuide(useStore.getState().guide).tokens[k]])),
    }
  },
  get_options: (i: CommandInput<'get_options'>) => {
    const st = useStore.getState()
    if (i.section !== undefined && i.block) {
      const slot = findSection(i.section)
      const b = findBlock(slot, i.block)
      const clip = slotClip(slot)
      const fields = wordsFor(slot)
      const suggested = suggestedVariants(b, { blocks: clip.blocks, fields })
      return {
        block: b.label,
        looks: variantsFor(b.kind).map((v) => ({ id: v.id, label: v.label, when: v.hint, suggested: suggested.includes(v.id) })),
        palette: ['primary', 'accent', 'text', 'muted', 'surface', 'bg', ...(st.guide.swatches ?? []).map((w) => `x:${w.name}`)],
        spacingSteps: { '0': 0, XS: 1, S: 2, M: 4, L: 6, XL: 8 },
        advice: adviceFor(slot).filter((a) => a.blockId === b.id),
        ...(b.kind === 'icon' ? { icons: ICON_NAMES, iconSets: ICON_SETS.map((x) => x.id) } : {}),
      }
    }
    if (i.section !== undefined) {
      const slot = findSection(i.section)
      return { section: slot.id, options: suggestClip(slot.type, st.slots, st.slots.indexOf(slot), library, true).map((o) => ({ ...o, title: library.clips[o.clipId].title, origin: library.clips[o.clipId].origin })) }
    }
    const at = i.at ?? st.slots.length
    return { at, types: suggestTypes(st.slots, at).map((t) => ({ ...t, available: library.byType[t.type].length > 0 })) }
  },
  review: (i: CommandInput<'review'>) => {
    const st = useStore.getState()
    const slots = i.section !== undefined ? [findSection(i.section)] : st.slots
    return slots.flatMap((s) => {
      const blocks = slotClip(s).blocks
      return adviceFor(s).map((a) => ({ section: s.id, block: blocks.find((b) => b.id === a.blockId)?.label, ...a }))
    })
  },
  list_notes: (i: CommandInput<'list_notes'>) => {
    const st = useStore.getState()
    const slotId = i.section !== undefined ? findSection(i.section).id : null
    const marks = sortMarks(st.notes.filter(isMark))
      .filter((m) => !i.status || m.status === i.status)
      .filter((m) => !i.kind || m.kind === i.kind)
      .filter((m) => !slotId || ('slotId' in m.anchor && m.anchor.slotId === slotId))
    return { guidance: MARK_GUIDANCE, marks: marks.map(describeNote) }
  },
  show: (i: CommandInput<'show'>) => {
    const st = useStore.getState()
    const slot = findSection(i.section)
    st.focusSlot(slot.id)
    st.selectBlock(i.block ? findBlock(slot, i.block).id : null)
    return { focused: slot.id }
  },
}

function adviceFor(slot: Slot) {
  const st = useStore.getState()
  const clip = slotClip(slot)
  return advise({
    blocks: clip.blocks,
      sectionType: clip.type,
    edits: slot.edits?.[clip.id],
    components: st.guide.components,
    tokens: resolveGuide(st.guide).tokens,
    swatches: st.guide.swatches,
    fields: wordsFor(slot),
    links: sectionLinks(clip.blocks, slot.edits?.[clip.id], wordsFor(slot), st.slots, slot.id, sectionAnchors(st.slots)),
  })
}

/* ---------- writes ---------- */

/** null in a style input clears that property; undefined leaves it alone. */
function styleFrom(input: Record<string, unknown> | undefined): Partial<BlockStyle> | undefined {
  if (!input) return undefined
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === null ? undefined : v])) as Partial<BlockStyle>
}

const WRITE = {
  add_section: (i: CommandInput<'add_section'>) => {
    const st = useStore.getState()
    if (i.clip_id && library.clips[i.clip_id]?.type !== i.type) throw new CommandError(`${i.clip_id} isn’t a ${i.type} clip`)
    const before = new Set(st.slots.map((s) => s.id))
    st.addSlot(i.type, i.clip_id, i.at)
    const added = useStore.getState().slots.find((s) => !before.has(s.id))
    if (!added) throw new CommandError(`No ${i.type} clips or layouts available`)
    return describeSection(added, useStore.getState().slots.indexOf(added) + 1)
  },
  remove_section: (i: CommandInput<'remove_section'>) => {
    const slot = findSection(i.section)
    useStore.getState().removeSlot(slot.id)
    return { removed: slot.id }
  },
  move_section: (i: CommandInput<'move_section'>) => {
    const slot = findSection(i.section)
    useStore.getState().moveSlot(slot.id, i.to - 1)
    return { moved: slot.id, position: useStore.getState().slots.findIndex((s) => s.id === slot.id) + 1 }
  },
  swap_section: (i: CommandInput<'swap_section'>) => {
    const slot = findSection(i.section)
    const clip = library.clips[i.clip_id]
    if (!clip || clip.type !== slot.type) throw new CommandError(`${i.clip_id} isn’t a ${slot.type} clip. See get_options.`)
    useStore.getState().setClip(slot.id, clip.id)
    return { section: slot.id, clip: clip.id }
  },
  set_keep: (i: CommandInput<'set_keep'>) => {
    const slot = findSection(i.section)
    const want: Partial<Keep> = clean({ layout: i.layout, style: i.style, content: i.copy, motion: i.motion })
    for (const [k, v] of Object.entries(want) as [keyof Keep, boolean][]) if (slot.keep[k] !== v) useStore.getState().toggleKeep(slot.id, k)
    return { keep: findSection(slot.id).keep }
  },
  set_words: (i: CommandInput<'set_words'>) => {
    const slot = findSection(i.section)
    const fields = Object.keys(slotClip(slot).fields)
    for (const [field, text] of Object.entries(i.words)) {
      if (!fields.includes(field)) throw new CommandError(`No field "${field}" in this ${slot.type}. Fields: ${fields.join(', ')}`)
      useStore.getState().setWord(slot.id, field, text === '' ? null : text)
    }
    return { words: wordsFor(findSection(slot.id)) }
  },
  word_options: (i: CommandInput<'word_options'>) => {
    let slot = findSection(i.section)
    const clip = slotClip(slot)
    if (clip.fields[i.field] == null) throw new CommandError(`No field "${i.field}" in this ${slot.type}. Fields: ${Object.keys(clip.fields).join(', ')}`)
    const content = useStore.getState().content
    for (const t of i.keep ?? []) slot = keepOption(slot, i.field, t, 'agent')
    for (const t of i.retire ?? []) slot = retireOption(slot, i.field, t)
    for (const t of i.put_back ?? []) slot = putBackOption(slot, i.field, t)
    if (i.use) {
      if (!wordChoices(clip, slot, content, i.field).some((c) => c.text.trim() === i.use!.trim())) slot = keepOption(slot, i.field, i.use, 'agent')
      slot = showWords(slot, clip, content, i.field, i.use)
    }
    putSlot(slot)
    const live = findSection(slot.id)
    return { field: i.field, showing: wordsFor(live)[i.field], choices: wordChoices(clip, live, content, i.field).map((c) => ({ text: c.text, kind: c.kind, by: c.option?.by })) }
  },
  set_link: (i: CommandInput<'set_link'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (!b.linkable) throw new CommandError(`${b.label} isn’t a link or button. Links here: ${slotClip(slot).blocks.filter((x) => x.linkable).map((x) => x.label).join('; ') || 'none'}`)
    let link: LinkTarget | undefined
    switch (i.to) {
      case 'section':
        link = { to: 'section', slotId: findSection(i.target ?? '').id }
        break
      case 'page':
        if (!i.target) throw new CommandError('Say which page, e.g. "/about".')
        link = { to: 'page', path: i.target.startsWith('/') ? i.target : `/${i.target}` }
        break
      case 'url':
        if (!i.target) throw new CommandError('Say which web address.')
        link = { to: 'url', url: i.target, newTab: i.new_tab ?? true }
        break
      case 'email':
        link = { to: 'email', address: i.target ?? '' }
        break
      case 'phone':
        link = { to: 'phone', number: i.target ?? '' }
        break
      case 'none':
        link = { to: 'none' }
        break
      case 'auto':
        link = undefined
    }
    useStore.getState().editBlock(slot.id, b.id, { link })
    const st = useStore.getState()
    const live = findSection(slot.id)
    const l = sectionLinks(slotClip(live).blocks, live.edits?.[live.clipId], wordsFor(live), st.slots, live.id, sectionAnchors(st.slots))[b.id]
    return { block: b.label, href: l.href, newTab: l.newTab, auto: l.auto }
  },
  set_banner: (i: CommandInput<'set_banner'>) => {
    const slot = findSection(i.section)
    if (slot.type !== 'nav') throw new CommandError('Banners go on navs. Pick the nav section.')
    useStore.getState().setBanner(slot.id, i.on)
    const banner = slotClip(findSection(slot.id)).blocks.find((b) => b.kind === 'banner')
    const hidden = banner ? !!findSection(slot.id).edits?.[slot.clipId]?.[banner.id]?.hidden : true
    return { banner: !hidden && banner ? { block: banner.id, label: banner.label } : null }
  },
  edit_list: (i: CommandInput<'edit_list'>) => {
    const slot = findSection(i.section)
    const list = findList(slot, i.list)
    const items = itemsOf(slot, list.id)
    const item = () => {
      if (i.item == null) throw new CommandError(`Say which item (1–${items.length}).`)
      const hit = items[i.item - 1]
      if (!hit) throw new CommandError(`${list.label} has ${items.length} items.`)
      return hit.id
    }
    const change: ListOp =
      i.op === 'add' || i.op === 'reset'
        ? { op: i.op, listId: list.id }
        : i.op === 'move'
          ? { op: 'move', itemId: item(), to: (i.to ?? 1) - 1 }
          : { op: i.op, itemId: item() }
    putSlot(changeList(slot, change))
    const live = findSection(slot.id)
    return { list: list.label, items: itemsOf(live, list.id).map((b, n) => ({ position: n + 1, block: b.id, label: b.label })), content: contentJson(outlineOf(live), wordsFor(live)) }
  },
  set_list: (i: CommandInput<'set_list'>) => {
    let slot = findSection(i.section)
    const list = findList(slot, i.list)
    if (!list.listKey) throw new CommandError(`${list.label}’s items are set by the layout; set its words with set_words instead.`)
    // Match the number of items first (new ones copy the first item), then write their words.
    while (itemsOf(slot, list.id).length < i.items.length) slot = changeList(slot, { op: 'add', listId: list.id })
    while (itemsOf(slot, list.id).length > i.items.length) {
      const items = itemsOf(slot, list.id)
      slot = changeList(slot, { op: 'remove', itemId: items[items.length - 1].id })
    }
    const node = findOutlineList(outlineOf(slot), list.id)
    if (!node) throw new CommandError(`Couldn’t read ${list.label}.`)
    const words = { ...slot.words }
    i.items.forEach((value, n) => {
      const it = node.items[n]
      const fields = it.nodes.filter((x): x is Extract<OutlineNode, { t: 'field' }> => x.t === 'field')
      if (typeof value === 'string') {
        if (fields.length !== 1) throw new CommandError(`Item ${n + 1} has fields ${fields.map((f) => f.key).join(', ')}: give an object.`)
        words[fields[0].field] = value
      } else
        for (const [k, v] of Object.entries(value)) {
          const f = fields.find((x) => x.key === k)
          if (!f) throw new CommandError(`Item ${n + 1} has no "${k}". Its fields: ${fields.map((x) => x.key).join(', ')}`)
          words[f.field] = v
        }
    })
    slot = { ...slot, words }
    putSlot(slot)
    return { list: list.label, content: contentJson(outlineOf(slot), wordsFor(findSection(slot.id))) }
  },
  set_block: (i: CommandInput<'set_block'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    const st = useStore.getState()
    if (i.reset) st.editBlock(slot.id, b.id, null)
    const patch: Partial<BlockEdit> = {}
    if (i.look !== undefined) {
      if (i.look !== null && !variantsFor(b.kind).some((v) => v.id === i.look))
        throw new CommandError(`No look "${i.look}" for a ${b.kind}. Looks: ${variantsFor(b.kind).map((v) => v.id).join(', ') || 'none'}`)
      patch.variant = i.look ?? undefined
    }
    const style = styleFrom(i.style)
    if (style) patch.style = style
    if (i.motion) patch.motion = Object.fromEntries(Object.entries(i.motion).map(([k, v]) => [k, v === null || v === 'normal' ? undefined : v])) as Partial<BlockMotion>
    if (i.hidden !== undefined) patch.hidden = i.hidden || undefined
    if (Object.keys(patch).length) st.editBlock(slot.id, b.id, patch)
    return describeSection(findSection(slot.id), 0).blocks.find((x) => x.id === b.id)
  },
  use_look_for_all: (i: CommandInput<'use_look_for_all'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (!slot.edits?.[slot.clipId]?.[b.id]) throw new CommandError(`${b.label} has no changes to share yet`)
    useStore.getState().promoteBlock(slot.id, b.id)
    return { kind: b.kind, lookForAll: useStore.getState().guide.components?.[b.kind] }
  },
  set_look_for_all: (i: CommandInput<'set_look_for_all'>) => {
    const st = useStore.getState()
    if (i.clear) {
      st.clearComponent(i.kind)
      return { kind: i.kind, lookForAll: null }
    }
    if (i.look && !variantsFor(i.kind).some((v) => v.id === i.look)) throw new CommandError(`No look "${i.look}" for a ${i.kind}`)
    const cur = st.guide.components?.[i.kind] ?? {}
    const style = { ...cur.style, ...styleFrom(i.style) }
    for (const k of Object.keys(style) as (keyof BlockStyle)[]) if (style[k] === undefined) delete style[k]
    const next = { variant: i.look === undefined ? cur.variant : (i.look ?? undefined), style: Object.keys(style).length ? style : undefined }
    useStore.setState((s) => ({ guide: { ...s.guide, components: { ...s.guide.components, [i.kind]: next } } }))
    return { kind: i.kind, lookForAll: next }
  },
  set_section_spacing: (i: CommandInput<'set_section_spacing'>) => {
    const slot = findSection(i.section)
    useStore.getState().setSectionSpacing(slot.id, clean({ top: i.top, bottom: i.bottom }))
    return { spacing: findSection(slot.id).spacing ?? {} }
  },
  set_image: (i: CommandInput<'set_image'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block. Image blocks: ${slotClip(slot).blocks.filter((x) => x.kind === 'image').map((x) => x.label).join('; ') || 'none'}`)
    const st = useStore.getState()
    if (i.remove) {
      st.editBlock(slot.id, b.id, { media: undefined })
      return { block: b.label, media: null }
    }
    const cur = slot.edits?.[slot.clipId]?.[b.id]?.media
    const next: MediaFill = i.placeholder
      ? { source: 'placeholder', style: i.placeholder, seed: i.seed ?? 1, alt: i.alt ?? cur?.alt, fit: i.fit ?? cur?.fit }
      : cur
        ? { ...cur, ...(i.alt !== undefined ? { alt: i.alt || undefined } : {}), ...(i.fit ? { fit: i.fit } : {}), ...(i.seed !== undefined && cur.source === 'placeholder' ? { seed: i.seed } : {}) }
        : (() => {
            throw new CommandError('Give a placeholder style, or set a picture first')
          })()
    st.editBlock(slot.id, b.id, { media: next })
    return { block: b.label, media: next }
  },
  set_media: (i: CommandInput<'set_media'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block; media goes in image blocks`)
    const cur = slot.edits?.[slot.clipId]?.[b.id]?.media
    let next: MediaFill
    if (i.url) {
      const found = detectLink(i.url)
      if (!found) throw new CommandError('That link isn’t a video file (.mp4, .webm), a Lottie (.lottie, .json), or a YouTube/Vimeo page')
      next = { source: found.source, link: found.link, play: found.source === 'embed' ? 'click' : 'inview', loop: found.source !== 'embed', lightbox: found.source === 'embed', alt: cur?.alt }
    } else if (cur && (cur.source === 'video' || cur.source === 'lottie' || cur.source === 'embed' || i.lightbox !== undefined || i.alt !== undefined)) next = { ...cur }
    else throw new CommandError('Give a url, or put a video or animation in this block first')
    if (i.play) {
      if (i.play === 'scrub' && next.source !== 'lottie') throw new CommandError('Only Lottie animations can follow the scroll')
      if (next.source === 'embed' && i.play !== 'click') throw new CommandError('Embeds play on click (their player loads only when asked)')
      next.play = i.play
    }
    if (i.loop !== undefined) next.loop = i.loop
    if (i.lightbox !== undefined) next.lightbox = i.lightbox
    if (i.alt !== undefined) next.alt = i.alt || undefined
    if (i.thumbnail !== undefined) next.poster = i.thumbnail ?? undefined
    useStore.getState().editBlock(slot.id, b.id, { media: next })
    return { block: b.label, media: next }
  },
  set_icon: (i: CommandInput<'set_icon'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'icon') throw new CommandError(`${b.label} isn’t an icon block`)
    if (i.name && !ICON_NAMES.includes(i.name)) throw new CommandError(`No icon "${i.name}". Icons: ${ICON_NAMES.join(', ')}`)
    useStore.getState().editBlock(slot.id, b.id, { icon: i.name ?? undefined })
    return { block: b.label, icon: i.name ?? blockIconName(slotClip(slot).html, b.id) ?? null, set: resolveGuide(useStore.getState().guide).tokens['icon.set'] }
  },
  set_section_motion: (i: CommandInput<'set_section_motion'>) => {
    const slot = findSection(i.section)
    useStore
      .getState()
      .setSectionMotion(slot.id, i.mode === 'captured' ? null : i.mode === 'none' ? { mode: 'none' } : { mode: 'preset', enter: i.enter ?? 'rise', stagger: i.stagger, onScroll: i.on_scroll, speed: i.speed === 'normal' ? undefined : i.speed })
    return { motion: findSection(slot.id).motion ?? { mode: 'captured' } }
  },
  set_token: (i: CommandInput<'set_token'>) => {
    // A bare family from the library ("Satoshi") becomes a full stack with a fitting fallback.
    let value = i.value
    if (value && i.key.startsWith('font.') && !value.includes(',')) {
      const lib = findLibraryFont(value)
      if (lib) value = fontStack(lib.family, i.key === 'font.mono' ? 'mono' : i.key === 'font.body' ? 'body' : 'display')
    }
    const choice: Choice | null = value === null ? null : { kind: 'custom', value }
    useStore.getState().chooseToken(i.key as TokenKey, choice)
    return { key: i.key, value: resolveGuide(useStore.getState().guide).tokens[i.key as TokenKey] }
  },
  add_brand_colour: (i: CommandInput<'add_brand_colour'>) => {
    useStore.getState().addSwatch(i.name, i.value)
    return { use: `x:${i.name}` }
  },
  add_note: (i: CommandInput<'add_note'>) => {
    const st = useStore.getState()
    let anchor: NoteAnchor = { kind: 'page' }
    if (i.section !== undefined) {
      const slot = findSection(i.section)
      if (i.block) {
        const b = findBlock(slot, i.block)
        anchor = { kind: 'block', slotId: slot.id, clipId: slot.clipId, blockId: b.id, label: b.label, quote: b.field ? wordsFor(slot)[b.field] : undefined }
      } else anchor = { kind: 'area', slotId: slot.id, clipId: slot.clipId, rect: { x: 0, y: 0, w: 1, h: 1 } }
    }
    const id = st.addMark({ anchor, kind: i.kind, text: i.text, suggestedCopy: i.suggested_copy, source: 'agent' })
    return describeNote(useStore.getState().notes.find((n) => n.id === id)!)
  },
  update_note: (i: CommandInput<'update_note'>) => {
    const m = findNote(i.note)
    if (m.kind === 'keep') throw new CommandError(`N${m.number} is marked “Love this”: there’s nothing to change`)
    if (m.status === 'verified') throw new CommandError(`N${m.number} is already verified by a person`)
    useStore.getState().setMarkStatus(m.id, i.status, i.resolution)
    return describeNote(useStore.getState().notes.find((n) => n.id === m.id)!)
  },
  reply_note: (i: CommandInput<'reply_note'>) => {
    const m = findNote(i.note)
    useStore.getState().replyToMark(m.id, i.text, 'agent')
    return describeNote(useStore.getState().notes.find((n) => n.id === m.id)!)
  },
  save_version: (i: CommandInput<'save_version'>) => {
    pressVersionAndFly()
    const st = useStore.getState()
    const v = st.head ? st.versions[st.head] : null
    if (v && i.title) st.renameVersion(v.id, i.title)
    return v ? { version: v.letter, title: i.title ?? v.title } : null
  },
}

function summary(name: string, input: Record<string, unknown>): string {
  const sec = input.section !== undefined ? ` ${input.section}` : ''
  switch (name) {
    case 'set_block':
      return String(input.block).includes(' · ') ? `changed ${input.block}` : `changed ${input.block}${sec ? ` in${sec}` : ''}`
    case 'set_words':
      return `rewrote${sec}`
    case 'add_section':
      return `added a ${input.type}`
    case 'add_note':
      return `left a ${String(input.kind).replace('-', ' ')} note${sec ? ` on${sec}` : ''}`
    case 'update_note':
      return `marked N${String(input.note).replace(/^n/i, '')} ${String(input.status).replace('_', ' ')}`
    case 'reply_note':
      return `replied on N${String(input.note).replace(/^n/i, '')}`
    default:
      return `${name.replace(/_/g, ' ')}${sec}`
  }
}
