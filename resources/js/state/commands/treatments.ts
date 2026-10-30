import { z } from 'zod'
import type { MediaFill } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { changedParams, clampParams, isEffectId, lookList, treatmentInfo, treatmentList, zodFor, type EffectsState, type ParamValues, type Surface, type TreatmentValue } from '@/core/treatments'
import { slotClip } from '@/data/library'
import { useStore } from '../store'
import { CommandError, findBlock, findSection } from './refs'

/** A treatment from a preset and dials, checked against its spec (unknown or out-of-range dials are refused, with the reason). */
export function treatmentFrom(surface: Surface, id: string, i: { preset?: string; params?: Record<string, unknown>; seed?: number }, cur?: TreatmentValue): TreatmentValue {
  const info = treatmentInfo(surface, id)
  if (!info) throw new CommandError(`No ${surface} called "${id}". See list_treatments.`)
  const p = i.preset ? info.presets.find((x) => x.id === i.preset) : undefined
  if (i.preset && !p) throw new CommandError(`${info.label} has no preset "${i.preset}". Presets: ${info.presets.map((x) => x.id).join(', ')}`)
  let given: ParamValues = {}
  if (i.params) {
    const r = zodFor(info.params).safeParse(i.params)
    if (!r.success) throw new CommandError(`${info.label}: ${z.prettifyError(r.error)}`)
    given = r.data as ParamValues
  }
  // Same treatment: change what's given and keep the rest; a new one starts from its defaults (and the preset).
  const base = cur?.id === id && !p ? (cur.params ?? {}) : (p?.values ?? {})
  const all = clampParams(info.params, { ...base, ...given })
  return {
    id,
    ...(changedParams(info.params, all) ? { params: changedParams(info.params, all) } : {}),
    ...(i.seed !== undefined ? { seed: i.seed } : cur?.seed !== undefined ? { seed: cur.seed } : {}),
    ...(p ? { preset: p.id } : cur?.id === id && !i.params && cur.preset ? { preset: cur.preset } : {}),
  }
}

export const read = {
  list_treatments: (i: CommandInput<'list_treatments'>) => ({
    treatments: treatmentList(i.surface).map((t) => ({
      id: t.id,
      surface: t.surface,
      label: t.label,
      hint: t.hint,
      ...(t.live ? { live: true } : {}),
      dials: z.toJSONSchema(zodFor(t.params)),
      presets: t.presets.map((p) => ({ id: p.id, label: p.label, dials: p.values })),
    })),
    looks: !i.surface || i.surface === 'effect' ? lookList().map((l) => ({ id: l.id, label: l.label, hint: l.hint, effects: l.effects })) : undefined,
    current: { effects: useStore.getState().guide.effects ?? {} },
  }),
}

export const write = {
  set_effect: (i: CommandInput<'set_effect'>) => {
    const st = useStore.getState()
    if (i.remove) {
      st.setEffect(i.effect, null)
      return { effect: i.effect, value: null }
    }
    const v = treatmentFrom('effect', i.effect, i, st.guide.effects?.[i.effect])
    st.setEffect(i.effect, v)
    return { effect: i.effect, value: useStore.getState().guide.effects?.[i.effect] ?? null }
  },
  apply_look: (i: CommandInput<'apply_look'>) => {
    let effects: EffectsState
    if (i.look) {
      const look = lookList().find((l) => l.id === i.look)
      if (!look) throw new CommandError(`No look called "${i.look}". Looks: ${lookList().map((l) => l.id).join(', ')}`)
      effects = look.effects
    } else if (i.effects) {
      effects = {}
      for (const [k, v] of Object.entries(i.effects)) {
        if (!isEffectId(k)) throw new CommandError(`"${k}" isn’t an effect. Effects: shadow, gradient, grain, glass, glow`)
        effects[k] = treatmentFrom('effect', k, { params: v.params })
      }
    } else throw new CommandError('Give a look id, or effects to apply')
    useStore.getState().setEffects(effects, i.replace ?? true)
    return { effects: useStore.getState().guide.effects ?? {} }
  },
  set_section_backdrop: (i: CommandInput<'set_section_backdrop'>) => {
    const slot = findSection(i.section)
    const st = useStore.getState()
    if (i.backdrop === null) {
      st.setBackdrop(slot.id, null)
      return { section: slot.id, backdrop: null }
    }
    st.setBackdrop(slot.id, treatmentFrom('backdrop', i.backdrop, i, slot.backdrop))
    return { section: slot.id, backdrop: findSection(slot.id).backdrop ?? null }
  },
  set_mock: (i: CommandInput<'set_mock'>) => {
    const slot = findSection(i.section)
    const b = findBlock(slot, i.block)
    if (b.kind !== 'image') throw new CommandError(`${b.label} isn’t an image block. Image blocks: ${slotClip(slot).blocks.filter((x) => x.kind === 'image').map((x) => x.label).join('; ') || 'none'}`)
    const cur = slot.edits?.[slot.clipId]?.[b.id]?.media
    const was = cur?.source === 'mock' && cur.mock ? { id: cur.mock, params: cur.params, seed: cur.seed } : undefined
    const v = treatmentFrom('mock', i.mock, i, was)
    const next: MediaFill = { source: 'mock', mock: v.id, params: v.params, seed: v.seed ?? 1, alt: i.alt ?? cur?.alt }
    useStore.getState().editBlock(slot.id, b.id, { media: next })
    return { block: b.label, media: next }
  },
}
