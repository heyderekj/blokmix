import type { BlockEdit, BlockInfo, BlockMotion, BlockStyle, Choice, MediaFill, Keep, Note, NoteAnchor, Slot, TokenKey } from '@/core/types'
import { isMark, MARK_GUIDANCE, SOURCE_LABEL, sortMarks } from '@/core/notes'
import { detectLink } from '@/core/media'
import { COMMANDS, toolDefinitions, type CommandInput, type CommandName } from '@/core/commands/schema'
import { TYPE_LABEL, resolveFields } from '@/core/content'
import { effectiveEdit } from '@/core/blocks/style'
import { variantsFor } from '@/core/blocks/variants'
import { advise, suggestedVariants } from '@/core/advise'
import { suggestClip, suggestTypes } from '@/core/suggest'
import { resolveGuide, openGroups } from '@/core/guide'
import { library } from '@/data/library'
import { pressVersionAndFly } from '@/lib/actions'
import { useStore } from './store'

/**
 * Runs the commands in core/commands/schema.ts against the live tape. Every
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
  const blocks = library.clips[slot.clipId].blocks
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
  const clip = library.clips[slot.clipId]
  return resolveFields(clip.type, clip.fields, useStore.getState().content, slot.keep.content, slot.words).fields
}

function describeSection(slot: Slot, position: number) {
  const st = useStore.getState()
  const clip = library.clips[slot.clipId]
  const words = wordsFor(slot)
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
        hidden: !!e?.hidden,
      }
    }),
  }
}

const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/* ---------- reads ---------- */

const READ = {
  get_page: (i: CommandInput<'get_page'>) => {
    const st = useStore.getState()
    const guide = resolveGuide(st.guide)
    const sections = i.section !== undefined ? [findSection(i.section)] : st.slots
    return {
      tape: st.tapeName,
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
  get_options: (i: CommandInput<'get_options'>) => {
    const st = useStore.getState()
    if (i.section !== undefined && i.block) {
      const slot = findSection(i.section)
      const b = findBlock(slot, i.block)
      const clip = library.clips[slot.clipId]
      const fields = wordsFor(slot)
      const suggested = suggestedVariants(b, { blocks: clip.blocks, fields })
      return {
        block: b.label,
        looks: variantsFor(b.kind).map((v) => ({ id: v.id, label: v.label, when: v.hint, suggested: suggested.includes(v.id) })),
        palette: ['primary', 'accent', 'text', 'muted', 'surface', 'bg', ...(st.guide.swatches ?? []).map((w) => `x:${w.name}`)],
        spacingSteps: { '0': 0, XS: 1, S: 2, M: 4, L: 6, XL: 8 },
        advice: adviceFor(slot).filter((a) => a.blockId === b.id),
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
      const blocks = library.clips[s.clipId].blocks
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
  const clip = library.clips[slot.clipId]
  return advise({
    blocks: clip.blocks,
      sectionType: clip.type,
    edits: slot.edits?.[clip.id],
    components: st.guide.components,
    tokens: resolveGuide(st.guide).tokens,
    swatches: st.guide.swatches,
    fields: wordsFor(slot),
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
    const fields = Object.keys(library.clips[slot.clipId].fields)
    for (const [field, text] of Object.entries(i.words)) {
      if (!fields.includes(field)) throw new CommandError(`No field "${field}" in this ${slot.type}. Fields: ${fields.join(', ')}`)
      useStore.getState().setWord(slot.id, field, text === '' ? null : text)
    }
    return { words: wordsFor(findSection(slot.id)) }
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
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block. Image blocks: ${library.clips[slot.clipId].blocks.filter((x) => x.kind === 'image').map((x) => x.label).join('; ') || 'none'}`)
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
  set_section_motion: (i: CommandInput<'set_section_motion'>) => {
    const slot = findSection(i.section)
    useStore
      .getState()
      .setSectionMotion(slot.id, i.mode === 'captured' ? null : i.mode === 'none' ? { mode: 'none' } : { mode: 'preset', enter: i.enter ?? 'rise', stagger: i.stagger, onScroll: i.on_scroll, speed: i.speed === 'normal' ? undefined : i.speed })
    return { motion: findSection(slot.id).motion ?? { mode: 'captured' } }
  },
  set_token: (i: CommandInput<'set_token'>) => {
    const choice: Choice | null = i.value === null ? null : { kind: 'custom', value: i.value }
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
