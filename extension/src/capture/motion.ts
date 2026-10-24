// Write motion.css: the section's CSS animations (keyframes renamed under the
// root class) and transitions, timed from the motion tokens. clip.css already
// holds the at-rest state, so dropping this file just turns motion off.

import { allEls, els, sel, type WEl } from './tree'
import type { TokenWriter } from './css'
import type { Keyframe } from './types'

export interface MotionResult {
  css: string | null
  notes: string
}

const split = (v: string | undefined) => (v ?? '').split(/,(?![^(]*\))/).map((x) => x.trim())

const FALLBACK_PROPS = 'color, background-color, border-color, box-shadow, opacity, transform'

export function buildMotion(root: WEl, rootClass: string, w: TokenWriter, keyframes: Record<string, Keyframe[]>, hoverProps: (el: WEl) => string[]): MotionResult {
  const used = new Map<string, string>()
  const rules = new Map<WEl, string[]>()
  let animated = 0
  let transitions = 0
  let scroll = 0
  const safe = (n: string) => n.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'motion'

  for (const el of allEls(root)) {
    const decls: string[] = []
    const names = split(el.s['animation-name']).filter((n) => n && n !== 'none')
    if (names.length) {
      if (split(el.s['animation-timeline']).some((t) => t && t !== 'auto')) scroll++
      else {
        const parts: string[] = []
        names.forEach((name, i) => {
          if (!keyframes[name]) return
          const at = <T,>(list: T[]) => list[i] ?? list[0]
          const renamed = `${rootClass}-${safe(name)}`
          used.set(name, renamed)
          const dur = w.duration_(at(split(el.s['animation-duration'])) || '0s')
          const ease = w.ease(at(split(el.s['animation-timing-function'])) || 'ease')
          const delay = at(split(el.s['animation-delay'])) || '0s'
          const iter = at(split(el.s['animation-iteration-count'])) || '1'
          const dir = at(split(el.s['animation-direction'])) || 'normal'
          const fill = at(split(el.s['animation-fill-mode'])) || 'none'
          const ms = w.ms(delay)
          parts.push([renamed, dur, ease, ms ? `${Math.round(ms)}ms` : null, iter !== '1' ? iter : null, dir !== 'normal' ? dir : null, fill !== 'none' ? fill : null].filter(Boolean).join(' '))
        })
        if (parts.length) {
          decls.push(`animation: ${parts.join(', ')};`)
          animated++
        }
      }
    }
    const tprops = split(el.s['transition-property'])
    const tdur = split(el.s['transition-duration'])
    if (tdur.some((d) => w.ms(d) > 0)) {
      const parts: string[] = []
      tprops.forEach((p, i) => {
        const d = tdur[i] ?? tdur[0]
        if (!w.ms(d)) return
        const ease = w.ease(split(el.s['transition-timing-function'])[i] ?? split(el.s['transition-timing-function'])[0] ?? 'ease')
        const delay = split(el.s['transition-delay'])[i] ?? '0s'
        // Name the properties instead of `all`: the ones the hover changes, else the usual suspects.
        const list = p === 'all' ? (hoverProps(el).length ? hoverProps(el).join(', ') : FALLBACK_PROPS).split(', ') : [p]
        for (const prop of list) parts.push([prop, w.duration_(d), ease, w.ms(delay) ? `${Math.round(w.ms(delay))}ms` : null].filter(Boolean).join(' '))
      })
      if (parts.length) {
        decls.push(`transition: ${parts.join(', ')};`)
        transitions++
      }
    }
    if (decls.length) rules.set(el, decls)
  }

  if (!rules.size) return { css: null, notes: scroll ? 'Scroll-driven animations were dropped (frames don’t scroll).' : '' }

  // Elements sharing a class share a rule; a stagger becomes :nth-child rules.
  const lines: string[] = [`.${rootClass} {`]
  const rootRule = rules.get(root)
  if (rootRule) lines.push(...rootRule.map((d) => `  ${d}`))
  const byClass = new Map<string, WEl[]>()
  for (const el of rules.keys()) {
    if (el === root) continue
    if (!el.cls) continue
    byClass.set(el.cls, [...(byClass.get(el.cls) ?? []), el])
  }
  for (const [cls, list] of byClass) {
    const bodies = list.map((e) => rules.get(e)!.join('\n    '))
    if (new Set(bodies).size === 1) lines.push('', `  & ${sel(cls)} {`, `    ${bodies[0]}`, '  }')
    else
      list.forEach((e, i) => {
        const n = e.parent ? els(e.parent).indexOf(e) + 1 : 1
        lines.push('', `  & ${sel(cls)}:nth-child(${n}) {`, `    ${bodies[i]}`, '  }')
      })
  }
  lines.push('}')

  for (const [name, renamed] of used) {
    lines.push('', `@keyframes ${renamed} {`)
    for (const f of keyframes[name]) {
      const decls = Object.entries(f.decls).map(([k, v]) => `    ${k}: ${w.value(k, v)};`)
      lines.push(`  ${f.key} {`, ...decls, '  }')
    }
    lines.push('}')
  }

  const notes = [
    animated ? `${animated} element${animated > 1 ? 's' : ''} animate (${[...used.keys()].join(', ')})` : '',
    transitions ? `${transitions} transition${transitions > 1 ? 's' : ''} on hover states` : '',
    scroll ? 'scroll-driven animations dropped (frames don’t scroll)' : '',
  ].filter(Boolean)
  return { css: lines.join('\n') + '\n', notes: notes.length ? notes.join('; ') + '.' : '' }
}
