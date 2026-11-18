import { z } from 'zod'
import { indexBlocks } from './blocks'
import { FIELD_SCHEMA, resolveFields } from './content'
import { isKept } from './contract'
import { choose, resolveGuide } from './guide'
import { hash, stableStringify } from './hash'
import { parseHtml } from './html/parse'
import { allSlots, updateSlotIn } from './site'
import { DEFAULT_KEEP, PLACEHOLDER_STYLES, SECTION_TYPES, type Library, type MixSnapshot, type SpaceStep, type Slot } from './types'

const field = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9]{0,45}$/)
  .refine((k) => !(k in Object.prototype))
const label = z.string().trim().min(1).max(100)
const words = z.record(field, z.string().max(3000))
const spacing = z.enum(['none', 'tight', 'default', 'roomy'])
const blockId = z.string().regex(/^b\d+$/)
const palette = z.enum(['primary', 'accent', 'surface', 'bg', 'text', 'muted', 'border', 'onPrimary'])
const style = z.object({
  fill: palette.optional(),
  ink: palette.optional(),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'pill']).optional(),
  shadow: z.enum(['none', 'soft', 'lifted', 'offset']).optional(),
})
const option = z.object({
  label,
  words,
  blocks: z.record(blockId, style).optional(),
  surface: z.enum(['page', 'brand', 'inverse', 'soft']).optional(),
})
const control = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice'), label, options: z.array(option).min(2).max(12) }),
  z.object({ kind: z.literal('toggle'), label, options: z.tuple([option, option]) }),
  z.object({ kind: z.literal('range'), label, block: z.string().regex(/^b\d+$/) }),
])
const cell = z.object({ field, kind: z.enum(['heading', 'text', 'badge', 'button']) })
export const recipeSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: label,
  layout: z.union([z.object({ clip: label }), z.object({ rows: z.array(z.array(cell).min(1).max(6)).min(1).max(20) })]),
  controls: z.array(control).max(12).default([]),
})
// PHP array casts serialize empty nested maps as []. Rebuild only the named record fields.
export function fromSavedIteration<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, child) =>
    ['words', 'blocks', 'style'].includes(key) && Array.isArray(child) && !child.length ? {} : child,
  )
}

export type Recipe = z.infer<typeof recipeSchema>
export type AgentControl = z.infer<typeof control>
const changes = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add'),
    page: label,
    section: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/),
    recipe: recipeSchema,
    words: words.optional(),
  }),
  z.object({
    kind: z.literal('color'),
    token: z.enum(['color.bg', 'color.surface', 'color.text', 'color.muted', 'color.border', 'color.primary', 'color.onPrimary', 'color.accent']),
    value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  z.object({ kind: z.literal('layout'), section: label, recipe: recipeSchema }),
  z.object({
    kind: z.literal('media'),
    section: label,
    block: blockId,
    value: z.discriminatedUnion('source', [
      z.object({ source: z.literal('placeholder'), style: z.enum(PLACEHOLDER_STYLES), alt: label.optional() }),
      z.object({
        source: z.literal('upload'),
        asset: z.string().regex(/^img_[a-z0-9]{1,12}$/),
        alt: label.optional(),
        fit: z.enum(['cover', 'contain']).optional(),
      }),
    ]),
  }),
  z.object({ kind: z.literal('word'), section: label, field, value: z.string().max(3000) }),
  z.object({ kind: z.literal('spacing'), section: label, edge: z.enum(['top', 'bottom']), value: spacing }),
  z.object({ kind: z.literal('surface'), section: label, value: z.enum(['page', 'brand', 'soft', 'inverse']) }),
])
export const returnSchema = z.object({
  format: z.literal('blokmix.return/v1'),
  id: z.uuid(),
  base: label.optional(),
  mix: label.optional(),
  draft: label.optional(),
  agent: label,
  summary: z.string().min(1).max(240),
  preview: z.url({ protocol: /^https?$/ }).optional(),
  changes: z.array(changes).max(100),
})
export type Bundle = z.infer<typeof returnSchema>
export type Change = Bundle['changes'][number]
export type ReturnRecord = { bundle: Bundle; status: 'pending' | 'accepted' | 'dismissed'; at: number; version?: string }

export function layoutClip(recipe: Recipe, lib: Library) {
  const { layout, type } = recipe
  if ('clip' in layout) {
    const clip = lib.clips[layout.clip]
    if (!clip || clip.type !== type || clip.origin !== 'layout') throw Error('Choose an available layout for this section.')
    return clip
  }
  const fields = layout.rows.flat().map((c) => c.field)
  if (new Set(fields).size !== fields.length || fields.some((f) => !FIELD_SCHEMA[type].includes(f)))
    throw Error('Each layout field must be unique and belong to the section type.')
  const fingerprint = stableStringify(recipe)
  const id = type + '.ai-' + hash(fingerprint)
  const found = lib.clips[id]
  if (found) {
    if (stableStringify(found.recipe) !== fingerprint) throw Error('Layout identifier collision.')
    return found
  }
  const root = 'mx-' + id.replace('.', '-')
  const tags = { heading: 'h2', text: 'p', badge: 'span', button: 'a' }
  const classes = { heading: 'heading', text: 'lead', button: 'btn primary', badge: 'eyebrow' }
  const rows = layout.rows
    .map(
      (row) =>
        '<div class="ai-row" data-mx-block="card">' +
        row
          .map((c) => {
            const tag = tags[c.kind]
            return (
              '<' +
              tag +
              ' class="' +
              classes[c.kind] +
              '"' +
              (tag === 'a' ? ' href="#"' : '') +
              ' data-mx-block="' +
              c.kind +
              '" data-mx-field="' +
              c.field +
              '">' +
              c.field +
              '</' +
              tag +
              '>'
            )
          })
          .join('') +
        '</div>',
    )
    .join('')
  const html = '<section class="' + root + '" data-mx-section="' + type + '"><div class="container">' + rows + '</div></section>'
  const base = lib.clips[lib.layoutsByType[type][0]]
  const clip = {
    ...base,
    id,
    origin: 'clip' as const,
    title: recipe.title,
    recipe,
    rootClass: root,
    layoutPattern: recipe.title,
    html,
    css: `
.${root} {background:var(--mx-color-bg);color:var(--mx-color-text);padding:var(--mx-space-section) var(--mx-space-6);container-type:inline-size}
.${root} .container {max-width:var(--mx-width-content);margin:auto;display:grid;gap:var(--mx-space-5)}
.${root} .ai-row {display:grid;grid-auto-columns:minmax(0,1fr);grid-auto-flow:column;align-items:center;gap:var(--mx-space-4)}
.${root} .heading {font:inherit;font-family:var(--mx-font-display);font-weight:var(--mx-type-display-weight);font-size:var(--mx-text-3xl)}
.${root} .btn {width:fit-content;padding:var(--mx-space-2) var(--mx-space-4);border-radius:var(--mx-radius-md);background:var(--mx-color-primary);color:var(--mx-color-on-primary)}
@container (max-width:600px){.${root} .ai-row{grid-auto-flow:row}}`,
    motionCss: null,
    slider: undefined,
    hash: hash(fingerprint),
    blocks: indexBlocks(parseHtml(html), type),
    fields: Object.fromEntries(fields.map((k) => [k, k])),
  }
  lib.clips[id] = clip
  return clip
}

export function applyControl(slot: Slot, control: AgentControl, index: number): Slot {
  if (control.kind === 'range') {
    if (!Number.isInteger(index) || index < 0 || index > 10) throw Error('Spacing must be between 0 and 10.')
    const existing = slot.edits?.[slot.clipId] ?? {}
    const block = existing[control.block]
    return {
      ...slot,
      edits: { ...slot.edits, [slot.clipId]: { ...existing, [control.block]: { ...block, style: { ...block?.style, gap: index as SpaceStep } } } },
    }
  }
  const choice = control.options[index]
  if (!choice) throw Error('Choose an available control value.')
  const edits = { ...slot.edits?.[slot.clipId] }
  for (const [id, patch] of Object.entries(choice.blocks ?? {})) edits[id] = { ...edits[id], style: { ...edits[id]?.style, ...patch } }
  return {
    ...slot,
    ...(choice.blocks && { edits: { ...slot.edits, [slot.clipId]: edits } }),
    words: { ...slot.words, ...choice.words },
    ...(choice.surface && { surface: choice.surface }),
  }
}

export function makeSection(recipe: Recipe, id: string, lib: Library, copy: Slot['words'] = {}): Slot {
  const clip = layoutClip(recipe, lib)
  const check = (fields: Slot['words']) => {
    if (Object.keys(fields ?? {}).some((k) => !Object.hasOwn(clip.fields, k))) throw Error('A word binding is missing from this layout.')
  }
  let slot: Slot = { id, type: recipe.type, clipId: clip.id, keep: { ...DEFAULT_KEEP }, locked: false, recipe }
  for (const c of recipe.controls) {
    if (c.kind === 'range') {
      if (!clip.blocks.some((b) => b.id === c.block)) throw Error('Spacing control refers to a missing block.')
    } else {
      c.options.forEach((o) => {
        check(o.words)
        if (Object.keys(o.blocks ?? {}).some((id) => !clip.blocks.some((b) => b.id === id))) throw Error('A control targets a missing block.')
      })
      slot = applyControl(slot, c, 0)
    }
  }
  check(copy)
  return { ...slot, words: { ...slot.words, ...copy } }
}

export function inspectChange(s: MixSnapshot, c: Change, lib: Library) {
  if (c.kind === 'color') return resolveGuide(s.guide).tokens[c.token]
  const slot = allSlots(s.site).find((x) => x.id === c.section)
  if (c.kind === 'add') return slot ?? null
  if (!slot) throw Error('The target section was removed.')
  if (c.kind === 'layout') return { clipId: slot.clipId, recipe: slot.recipe, edits: slot.edits }
  if (c.kind === 'media') {
    if (!lib.clips[slot.clipId]?.blocks.some((b) => b.id === c.block && b.kind === 'image')) throw Error('The target image is missing.')
    return slot.edits?.[slot.clipId]?.[c.block]?.media ?? null
  }
  if (c.kind === 'word') {
    const clip = lib.clips[slot.clipId]
    if (!clip || !Object.hasOwn(clip.fields, c.field)) throw Error('The target word is missing from this layout.')
    return resolveFields(slot.type, clip.fields, s.content, slot.keep.content, slot.words).fields[c.field]
  }
  return c.kind === 'spacing' ? (slot.spacing?.[c.edge] ?? 'default') : (slot.surface ?? 'page')
}

export function applyChange(s: MixSnapshot, c: Change, lib: Library): MixSnapshot {
  const value = inspectChange(s, c, lib)
  if (c.kind === 'color') {
    if (isKept(s.contract, 'color')) throw Error('This draft keeps its palette.')
    return { ...s, guide: choose(s.guide, c.token, { kind: 'custom', value: c.value }) }
  }
  if (c.kind === 'add') {
    if (value) throw Error('This section ID is already in use.')
    const page = s.site.pages.find((p) => p.id === c.page || p.path === c.page)
    if (!page) throw Error('The target page was removed.')
    if (isKept(s.contract, 'layout')) throw Error('This draft keeps its layout.')
    const slot = makeSection(c.recipe, c.section, lib, c.words)
    if (slot.type === 'nav' || slot.type === 'footer') {
      if (s.site.shared[slot.type]) throw Error('The site already has this shared section. Return a layout change for it.')
      return { ...s, site: { ...s.site, shared: { ...s.site.shared, [slot.type]: slot } } }
    }
    return { ...s, site: { ...s.site, pages: s.site.pages.map((p) => (p === page ? { ...p, slots: [...p.slots, slot] } : p)) } }
  }
  if (
    isKept(
      s.contract,
      c.kind === 'layout' ? 'layout' : c.kind === 'media' ? 'pictures' : c.kind === 'word' ? 'words' : c.kind === 'spacing' ? 'space' : 'sections',
    )
  )
    throw Error('This draft keeps that design choice.')
  return {
    ...s,
    site: updateSlotIn(s.site, c.section, (slot) => {
      if (slot.locked) throw Error('The target section is locked.')
      if (c.kind === 'layout') {
        if (c.recipe.type !== slot.type) throw Error('A replacement layout must fit this section type.')
        const next = makeSection(c.recipe, slot.id, lib)
        return {
          ...slot,
          clipId: next.clipId,
          recipe: c.recipe,
          words: { ...next.words, ...slot.words },
          prevClipId: slot.clipId,
          edits: { ...slot.edits, ...next.edits },
        }
      }
      if (c.kind === 'media') {
        const edits = slot.edits?.[slot.clipId] ?? {}
        return { ...slot, edits: { ...slot.edits, [slot.clipId]: { ...edits, [c.block]: { ...edits[c.block], media: c.value } } } }
      }
      if (c.kind === 'word') return { ...slot, words: { ...slot.words, [c.field]: c.value } }
      if (c.kind === 'spacing') return { ...slot, spacing: { ...slot.spacing, [c.edge]: c.value } }
      return { ...slot, surface: c.value }
    }),
  }
}

export function sampleRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    controls: recipe.controls.map((c) =>
      c.kind === 'range'
        ? c
        : {
            ...c,
            options: c.options.map((o) => ({
              ...o,
              words: Object.fromEntries(Object.keys(o.words).map((f) => [f, o.label + ' ' + f.replace(/([A-Z])/g, ' $1').toLowerCase()])),
            })),
          },
    ) as Recipe['controls'],
  }
}
export function addSharedRecipe(snapshot: MixSnapshot, page: string, section: string, recipe: Recipe, lib: Library) {
  const fields = layoutClip(recipe, lib).fields
  const words = Object.fromEntries(Object.entries(snapshot.content.fields[recipe.type] ?? {}).filter(([key]) => Object.hasOwn(fields, key)))
  return applyChange(snapshot, { kind: 'add', page, section, recipe, words }, lib)
}

export function changeLabel(change: Change): string {
  switch (change.kind) {
    case 'add':
      return 'Add ' + change.recipe.title
    case 'layout':
      return change.recipe.title
    case 'media':
      return 'Section image'
    case 'color':
      return change.token.replace('color.', '') + ' color'
    case 'word':
      return change.field
    case 'spacing':
      return change.edge + ' spacing'
    case 'surface':
      return 'Section background'
  }
}

/** Paths identify records by stable IDs even when a page or section was reordered. */
export function difference(before: unknown, after: unknown, path = ''): { path: string; before?: unknown; after?: unknown }[] {
  if (stableStringify(before) === stableStringify(after)) return []
  if (Array.isArray(before) && Array.isArray(after) && [...before, ...after].every((x) => x && typeof x.id === 'string')) {
    const keyed = (xs: { id: string }[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
    return [
      ...difference(
        before.map((x) => x.id),
        after.map((x) => x.id),
        path + '/order',
      ),
      ...difference(keyed(before), keyed(after), path),
    ]
  }
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const a = before as Record<string, unknown>,
      b = after as Record<string, unknown>
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => difference(a[k], b[k], path + '/' + k))
  }
  return [{ path, before, after }]
}
