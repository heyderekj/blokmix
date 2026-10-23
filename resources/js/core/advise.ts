// Suggestions for blocks: the checklist ReviseMy's second opinion uses (one main
// action, readable contrast, tap targets, readable measure, clear labels), plus
// a nudge towards consistency. Pure, so it's tested and an agent can run it.

import type { BlockEdit, BlockInfo, BlockKind, ColorRef, ComponentDefault, Swatch, TokenSet } from './types'
import { contrastRatio, hexToRgb } from './tokens'
import { effectiveEdit } from './blocks/style'

export interface Advice {
  blockId: string
  rule: 'one-primary' | 'contrast' | 'tap-target' | 'label' | 'measure' | 'consistency'
  level: 'problem' | 'suggestion'
  message: string
  /** One click applies this to the block. */
  fix?: { label: string; edit?: Partial<BlockEdit>; promote?: boolean }
}

export interface AdviseInput {
  blocks: BlockInfo[]
  edits: Record<string, BlockEdit> | undefined
  components?: Partial<Record<BlockKind, ComponentDefault>>
  tokens: TokenSet
  swatches?: Swatch[]
  /** The words each field shows. */
  fields: Record<string, string>
  /** Measured size of blocks, when known (the selected one). */
  rects?: Record<string, { w: number; h: number }>
  /** Own styles on blocks of each kind across the whole page, for the consistency nudge. */
  pageStyles?: Partial<Record<BlockKind, string[]>>
}

const SOLID = new Set(['solid', 'pill', 'offset'])
/** Document order of a block id ('b12' → 12). */
const ord = (id: string) => Number(id.slice(1))
const CTA = new Set<BlockKind>(['button', 'link'])
const VAGUE = /^(click here|submit|learn more|read more|more|go|here|ok|continue|button)$/i

/** A palette ref as a hex colour, mixing tints towards the page colour. */
export function refToHex(ref: ColorRef, tokens: TokenSet, swatches: Swatch[] = []): string | null {
  const [name, mix] = ref.split('/')
  const base = name.startsWith('x:') ? swatches.find((w) => w.name === name.slice(2))?.value : (tokens as Record<string, string>)[`color.${name}`]
  if (!base) return null
  const n = Number(mix)
  if (!mix || !(n > 0 && n < 100)) return base
  const a = hexToRgb(base)
  const b = hexToRgb(tokens['color.bg'])
  if (!a || !b) return base
  const t = n / 100
  return `#${a.map((c, i) => Math.round(c * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`
}

/** Which palette colour reads best on a fill: text or page colour. */
export function bestInk(fillHex: string, tokens: TokenSet): ColorRef {
  const onText = contrastRatio(fillHex, tokens['color.text']) ?? 0
  const onBg = contrastRatio(fillHex, tokens['color.bg']) ?? 0
  return onText >= onBg ? 'text' : 'bg'
}

export function advise(i: AdviseInput): Advice[] {
  const out: Advice[] = []
  const byId = new Map(i.blocks.map((b) => [b.id, b]))
  const eff = (b: BlockInfo) => effectiveEdit(i.edits?.[b.id], i.components?.[b.kind])
  const hex = (r: ColorRef) => refToHex(r, i.tokens, i.swatches)

  for (const b of i.blocks) {
    const e = eff(b)
    if (e?.hidden) continue

    // One main action: two solid buttons side by side compete.
    if (b.kind === 'button' && e?.variant && SOLID.has(e.variant)) {
      const peers = i.blocks.filter((o) => o.kind === 'button' && o.parent === b.parent && o.id !== b.id)
      const earlierSolid = peers.some((o) => ord(o.id) < ord(b.id) && SOLID.has(eff(o)?.variant ?? '') && !eff(o)?.hidden)
      if (earlierSolid) {
        out.push({
          blockId: b.id,
          rule: 'one-primary',
          level: 'suggestion',
          message: 'Two solid buttons compete for attention. Let this one step back so the main action stands out.',
          fix: { label: 'Make it outline', edit: { variant: 'outline' } },
        })
      }
    }

    // Contrast between a block's fill and its words.
    const fill = e?.style?.fill
    const ink = e?.style?.ink
    if (fill || ink) {
      const solidFill = b.kind === 'button' || b.kind === 'badge' || b.kind === 'icon'
      const fillHex = fill ? hex(fill) : solidFill ? i.tokens['color.primary'] : i.tokens['color.bg']
      const inkHex = ink ? hex(ink) : solidFill && fill ? i.tokens['color.onPrimary'] : i.tokens['color.text']
      const soft = b.kind === 'badge' || (b.kind === 'button' && e?.variant && !SOLID.has(e.variant))
      if (fillHex && inkHex && !(soft && !ink)) {
        const ratio = contrastRatio(fillHex, inkHex)
        const large = b.kind === 'heading'
        const need = large ? 3 : 4.5
        if (ratio !== null && ratio < need) {
          const better = bestInk(fillHex, i.tokens)
          out.push({
            blockId: b.id,
            rule: 'contrast',
            level: 'problem',
            message: `Words on this fill are hard to read (${ratio}:1; aim for ${need}:1).`,
            fix: { label: `Use ${better === 'text' ? 'dark' : 'light'} text`, edit: { style: { ink: better } } },
          })
        }
      }
    }

    // Tap targets.
    const r = i.rects?.[b.id]
    if (r && (CTA.has(b.kind) || b.kind === 'input') && r.h < 40) {
      out.push({
        blockId: b.id,
        rule: 'tap-target',
        level: 'suggestion',
        message: `Small to tap (${Math.round(r.h)}px tall). 44px is comfortable on a phone.`,
        fix: b.kind === 'button' ? { label: 'Use a solid button', edit: { variant: 'solid' } } : undefined,
      })
    }

    // Labels that say what happens.
    const words = b.field ? (i.fields[b.field] ?? '').trim() : ''
    if (CTA.has(b.kind) && words) {
      if (VAGUE.test(words)) {
        out.push({ blockId: b.id, rule: 'label', level: 'suggestion', message: `“${words}” doesn’t say what happens. Start with a verb that names the outcome, like “Start your free trial”.` })
      } else if (words.split(/\s+/).length > 6) {
        out.push({ blockId: b.id, rule: 'label', level: 'suggestion', message: 'Long button labels get skipped. Two to four words read at a glance.' })
      }
    }

    // Readable measure for headings.
    if (b.kind === 'heading' && words.length > 80 && !byId.get(b.parent ?? '')?.list) {
      out.push({ blockId: b.id, rule: 'measure', level: 'suggestion', message: `Long headings scan poorly (${words.length} characters). Aim for under 60 and move detail into the text below.` })
    }

    // Consistency: several different one-off looks for the same kind of block.
    const own = i.edits?.[b.id]
    if (own && (own.variant || own.style) && !i.components?.[b.kind]) {
      const looks = new Set(i.pageStyles?.[b.kind] ?? [])
      if (looks.size >= 2) {
        out.push({
          blockId: b.id,
          rule: 'consistency',
          level: 'suggestion',
          message: `There are ${looks.size} different ${b.kind} looks on this page. Choosing one keeps the page feeling designed.`,
          fix: { label: `Use this for all`, promote: true },
        })
      }
    }
  }
  return out
}

/** Variants that suit this block where it sits, first-choice first. */
export function suggestedVariants(b: BlockInfo, i: Pick<AdviseInput, 'blocks' | 'fields'>): string[] {
  if (b.kind === 'button') {
    const peers = i.blocks.filter((o) => o.kind === 'button' && o.parent === b.parent && o.id !== b.id)
    const lead = peers.length && peers.every((o) => ord(o.id) > ord(b.id))
    if (!peers.length || lead) return ['solid', 'pill']
    return ['outline', 'ghost', 'arrow']
  }
  if (b.kind === 'heading') {
    const len = (i.fields[b.field ?? ''] ?? '').length
    return len > 40 ? ['marker', 'italic'] : ['gradient', 'scribble', 'caps']
  }
  if (b.kind === 'card' || b.kind === 'item') {
    const parent = i.blocks.find((o) => o.id === b.parent)
    return parent?.kind === 'list' ? ['bordered', 'raised', 'flat'] : ['raised', 'tinted', 'glass']
  }
  if (b.kind === 'badge') return ['pill', 'dot']
  if (b.kind === 'image') return ['rounded', 'arch']
  return []
}
