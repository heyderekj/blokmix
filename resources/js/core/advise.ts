// Suggestions for blocks: the checklist ReviseMy's second opinion uses (one main
// action, readable contrast, tap targets, readable measure, clear labels), plus
// a nudge towards consistency. Pure, so it's tested and an agent can run it.

import type { BlockEdit, BlockInfo, BlockKind, ColorRef, ComponentDefault, LinkTarget, Swatch, TokenSet } from './types'
import { contrastRatio, hexToRgb } from './tokens'
import { defaultFor, effectiveEdit, MOBILE_MAX } from './blocks/style'

/**
 * Where a suggestion comes from. Like ReviseMy's craft lenses, these are our own
 * distillations of public craft sources, not quotes from or endorsed by them:
 * IIDS (Matt D. Smith / Shift Nudge) for hierarchy, spacing and type; Laws of UX
 * for behavior; Emil Kowalski's design-engineering skill for motion and feel.
 */
export type Lens = 'IIDS' | 'Laws of UX' | 'Motion' | 'Accessibility'

export interface Advice {
  blockId: string
  rule:
    | 'one-primary'
    | 'contrast'
    | 'tap-target'
    | 'label'
    | 'measure'
    | 'consistency'
    | 'expressive'
    | 'small-display'
    | 'cramped'
    | 'rhythm'
    | 'line-length'
    | 'corners'
    | 'loops'
    | 'hover-static'
    | 'nav-motion'
    | 'alt'
    | 'placeholder'
    | 'captions'
    | 'dead-link'
  level: 'problem' | 'suggestion'
  lens: Lens
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
  /** Measured size of blocks, when known. */
  rects?: Record<string, { w: number; h: number }>
  /**
   * The page width the rects were measured at (1280 desktop, 390 mobile). At
   * phone widths (≤760) blocks take their phone spacing and hiding, spacing
   * fixes go to phones only, and measured messages say "At 390px…".
   */
  width?: number
  /** Which kind of section this is (nav and footer motion get special care). */
  sectionType?: string
  /** The section's root font size isn't known, so line length uses the page's base text size (px). */
  basePx?: number
  /** Own styles on blocks of each kind across the whole page, for the consistency nudge. */
  pageStyles?: Partial<Record<BlockKind, string[]>>
  /** Where each link block leads (href "#" = nowhere), when known. */
  links?: Record<string, { href: string }>
  /** Where Jev thinks links that lead nowhere should go, by block id (core/jev/links.ts). */
  linkGuesses?: Record<string, { target: LinkTarget; label: string }>
}

const SOLID = new Set(['solid', 'pill', 'offset'])
/** Document order of a block id ('b12' → 12). */
const ord = (id: string) => Number(id.slice(1))
const CTA = new Set<BlockKind>(['button', 'link'])
const VAGUE = /^(click here|submit|learn more|read more|more|go|here|ok|continue|button)$/i

/** A palette ref as a hex color, mixing tints towards the page color. */
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

/** Which palette color reads best on a fill: text or page color. */
export function bestInk(fillHex: string, tokens: TokenSet): ColorRef {
  const onText = contrastRatio(fillHex, tokens['color.text']) ?? 0
  const onBg = contrastRatio(fillHex, tokens['color.bg']) ?? 0
  return onText >= onBg ? 'text' : 'bg'
}

export function advise(i: AdviseInput): Advice[] {
  const out: Advice[] = []
  const byId = new Map(i.blocks.map((b) => [b.id, b]))
  const phone = i.width !== undefined && i.width <= MOBILE_MAX
  const eff = (b: BlockInfo) => {
    const e = effectiveEdit(i.edits?.[b.id], defaultFor(i.components, b))
    if (!phone || !e?.mobile) return e
    return { ...e, hidden: e.hidden || e.mobile.hidden, style: e.mobile.style ? { ...e.style, ...e.mobile.style } : e.style }
  }
  // Spacing fixes at a phone width change phones only.
  const spaceFix = (style: Partial<Record<'padding' | 'above' | 'below' | 'gap', number>>): Partial<BlockEdit> => (phone ? { mobile: { style } } : { style }) as Partial<BlockEdit>
  // Measured findings name the width they were measured at.
  const at = (m: string) => (i.width ? `At ${i.width}px, ${m[0].toLowerCase()}${m.slice(1)}` : m)
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
          lens: 'Laws of UX',
          message: 'Two solid buttons compete for attention. Let this one step back so the main action stands out.',
          fix: { label: 'Make it outline', edit: { variant: 'outline' } },
        })
      }
    }

    // A button or link that leads nowhere: people press it and nothing happens.
    if (b.linkable && (b.kind === 'button' || b.kind === 'link') && i.links?.[b.id]?.href === '#' && e?.link?.to !== 'none') {
      const guess = i.linkGuesses?.[b.id]
      out.push({
        blockId: b.id,
        rule: 'dead-link',
        level: 'suggestion',
        lens: 'Laws of UX',
        message: guess
          ? `This leads nowhere yet. Its words suggest the ${guess.label}.`
          : 'This leads nowhere yet. Point it at a section, a page or a web address, so pressing it does what its words promise.',
        ...(guess ? { fix: { label: `Point it at ${guess.label.replace(/ (section|page)$/, '')}`, edit: { link: guess.target } } } : {}),
      })
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
            lens: 'Accessibility',
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
        lens: 'Laws of UX',
        message: at(`Small to tap (${Math.round(r.h)}px tall). 44px is comfortable on a phone.`),
        fix: b.kind === 'button' ? { label: 'Use a solid button', edit: { variant: 'solid' } } : undefined,
      })
    }

    // Labels that say what happens.
    const words = b.field ? (i.fields[b.field] ?? '').trim() : ''
    if (CTA.has(b.kind) && words) {
      if (VAGUE.test(words)) {
        out.push({ blockId: b.id, rule: 'label', level: 'suggestion', lens: 'Laws of UX', message: `“${words}” doesn’t say what happens. Start with a verb that names the outcome, like “Start your free trial”.` })
      } else if (words.split(/\s+/).length > 6) {
        out.push({ blockId: b.id, rule: 'label', level: 'suggestion', lens: 'Laws of UX', message: 'Long button labels get skipped. Two to four words read at a glance.' })
      }
    }

    // Readable measure for headings.
    if (b.kind === 'heading' && words.length > 80 && !byId.get(b.parent ?? '')?.list) {
      out.push({ blockId: b.id, rule: 'measure', level: 'suggestion', lens: 'IIDS', message: `Long headings scan poorly (${words.length} characters). Aim for under 60 and move detail into the text below.` })
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
          lens: 'IIDS',
          message: `There are ${looks.size} different ${b.kind} looks on this page. Choosing one keeps the page feeling designed.`,
          fix: { label: `Use this for all`, promote: true },
        })
      }
    }
  }

  // ---- craft: hierarchy, rhythm and restraint (IIDS lens) ----
  const EXPRESSIVE = new Set(['gradient', 'marker', 'scribble', 'hollow', 'caps', 'offset'])
  const expressive = i.blocks.filter((b) => EXPRESSIVE.has(eff(b)?.variant ?? '') && !eff(b)?.hidden)
  if (expressive.length > 1) {
    // Keep the first, suggest the others step back.
    for (const b of expressive.slice(1)) {
      out.push({
        blockId: b.id,
        rule: 'expressive',
        level: 'suggestion',
        lens: 'IIDS',
        message: 'This section already has a bold treatment. One expressive moment per section reads as confident; more competes.',
        fix: { label: 'Back to its own look', edit: { variant: undefined } },
      })
    }
  }
  for (const b of i.blocks) {
    const e = eff(b)
    if (!e || e.hidden) continue
    const parent = b.parent ? byId.get(b.parent) : undefined
    const inUnit = parent?.kind === 'item' || parent?.kind === 'card'
    // Display treatments need display sizes.
    if (b.kind === 'heading' && inUnit && (e.variant === 'hollow' || e.variant === 'caps')) {
      out.push({
        blockId: b.id,
        rule: 'small-display',
        level: 'suggestion',
        lens: 'IIDS',
        message: `${e.variant === 'hollow' ? 'Hollow letters' : 'Tight caps'} are made for big headlines; at card size they get hard to read.`,
        fix: { label: 'Use plain', edit: { variant: undefined } },
      })
    }
    // Containers need room inside them.
    const filled = !!e.style?.fill || ['bordered', 'raised', 'tinted', 'glass', 'offset', 'grain', 'glow'].includes(e.variant ?? '')
    if ((b.kind === 'card' || b.kind === 'item') && filled && e.style?.padding !== undefined && e.style.padding < 3) {
      out.push({
        blockId: b.id,
        rule: 'cramped',
        level: 'suggestion',
        lens: 'IIDS',
        message: 'Content is pressed against the edge of its container. Give it at least medium padding so it can breathe.',
        fix: { label: 'Medium padding', edit: spaceFix({ padding: 4 }) },
      })
    }
    // Long lines are tiring: aim for roughly 45–75 characters.
    const r = i.rects?.[b.id]
    if (r && b.kind === 'text' && b.field && (i.fields[b.field] ?? '').length > 120) {
      const chars = r.w / ((i.basePx ?? 16) * 0.5)
      if (chars > 85) {
        out.push({
          blockId: b.id,
          rule: 'line-length',
          level: 'suggestion',
          lens: 'IIDS',
          message: at(`Lines here run about ${Math.round(chars)} characters. 45 to 75 is easier to read; add side padding or narrow the column.`),
          fix: { label: 'Add side padding', edit: spaceFix({ padding: 6 }) },
        })
      }
    }
  }

  // Spacing rhythm: siblings of a kind should sit on the same step.
  const groups = new Map<string, BlockInfo[]>()
  for (const b of i.blocks) {
    const key = `${b.parent}|${b.kind}`
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  for (const sibs of groups.values()) {
    if (sibs.length < 2) continue
    for (const prop of ['above', 'below', 'padding', 'gap'] as const) {
      const vals = sibs.map((b) => eff(b)?.style?.[prop])
      const set = vals.filter((v) => v !== undefined)
      if (!set.length || new Set(vals).size < 2) continue
      // The most common value wins; the odd ones out get the suggestion.
      const counts = new Map<number | undefined, number>()
      for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
      const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      sibs.forEach((b, n) => {
        if (vals[n] === common || vals[n] === undefined) return
        out.push({
          blockId: b.id,
          rule: 'rhythm',
          level: 'suggestion',
          lens: 'IIDS',
          message: `Its ${prop === 'above' ? 'space above' : prop === 'below' ? 'space below' : prop} differs from the ${sibs.length - 1} like it. Even spacing makes a group read as one.`,
          fix: { label: 'Match the others', edit: spaceFix({ [prop]: common }) },
        })
      })
    }
  }

  // ---- pictures ----
  for (const b of i.blocks) {
    const media = eff(b)?.media
    if (b.kind !== 'image' || !media || eff(b)?.hidden) continue
    const moving = media.source === 'video' || media.source === 'lottie' || media.source === 'embed'
    if (media.source !== 'placeholder' && !media.alt?.trim()) {
      out.push({
        blockId: b.id,
        rule: 'alt',
        // A purely decorative animation can go without; videos and pictures need a description.
        level: media.source === 'lottie' ? 'suggestion' : 'problem',
        lens: 'Accessibility',
        message:
          media.source === 'lottie'
            ? 'If this animation carries meaning, describe it; if it’s decoration, it can stay silent.'
            : `This ${moving ? 'video' : 'picture'} has no description. Screen readers will skip it or read the file name; say what’s in it in a few words.`,
      })
    }
    if ((media.source === 'video' && (media.play === 'click' || media.lightbox)) || media.source === 'embed') {
      out.push({ blockId: b.id, rule: 'captions', level: 'suggestion', lens: 'Accessibility', message: 'If this video has speech, give it captions so it works muted and for people who can’t hear it.' })
    }
    if (media.source === 'placeholder') {
      out.push({ blockId: b.id, rule: 'placeholder', level: 'suggestion', lens: 'IIDS', message: 'A placeholder, drawn from your palette. Swap in a real image before launch; the packet flags it for the agent too.' })
    }
  }

  // ---- motion (Emil Kowalski's craft): restraint, purpose, nothing on what you use constantly ----
  // Looping videos and animations count too: they pull the eye just like a looping block.
  const loops = i.blocks.filter((b) => {
    const e = eff(b)
    if (!e || e.hidden) return false
    const m = e.media
    const playingLoop = !!m && (m.source === 'video' || m.source === 'lottie') && m.loop !== false && (m.play ?? 'inview') !== 'click' && m.play !== 'scrub'
    return !!e.motion?.loop || playingLoop
  })
  for (const b of loops.slice(1)) {
    out.push({
      blockId: b.id,
      rule: 'loops',
      level: 'suggestion',
      lens: 'Motion',
      message: 'This section already has something looping. More than one constant motion pulls the eye in different directions.',
      fix: eff(b)?.motion?.loop ? { label: 'Stop this loop', edit: { motion: { loop: undefined } } } : undefined,
    })
  }
  for (const b of i.blocks) {
    const m = eff(b)?.motion
    if (!m) continue
    if (m.hover && (b.kind === 'heading' || b.kind === 'text' || b.kind === 'badge' || b.kind === 'list')) {
      out.push({
        blockId: b.id,
        rule: 'hover-static',
        level: 'suggestion',
        lens: 'Motion',
        message: 'It moves on hover but can’t be clicked, so it promises an action that isn’t there.',
        fix: { label: 'Remove the hover', edit: { motion: { hover: undefined } } },
      })
    }
    if ((i.sectionType === 'nav') && m.enter && m.enter !== 'none') {
      out.push({
        blockId: b.id,
        rule: 'nav-motion',
        level: 'suggestion',
        lens: 'Motion',
        message: 'Navigation is used constantly; it should be there the moment the page is, without an entrance.',
        fix: { label: 'No entrance', edit: { motion: { enter: undefined } } },
      })
    }
  }

  // Corners: one shape language per section.
  const radii = new Set(i.blocks.map((b) => eff(b)?.style?.radius).filter(Boolean))
  if (radii.size > 1) {
    for (const b of i.blocks) {
      const rad = eff(b)?.style?.radius
      if (rad && rad !== [...radii][0]) {
        out.push({ blockId: b.id, rule: 'corners', level: 'suggestion', lens: 'IIDS', message: 'Corners in this section mix shapes. One radius (or one plus pill buttons) keeps the shape language clear.' })
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
  if (b.kind === 'icon') return ['bare', 'tinted']
  if (b.kind === 'image') return b.ratio === '1/1' ? ['circle', 'rounded'] : ['rounded', 'square']
  return []
}
