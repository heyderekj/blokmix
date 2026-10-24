import { type CommandInput } from '@/core/commands/schema'
import type { Advice } from '@/core/advise'
import { slotClip } from '@/data/library'
import { measurePage, MEASURE_WIDTHS } from '@/lib/measure'
import type { BlockRects } from '../layout'
import { useStore } from '../store'
import { findSection, adviceFor } from './refs'
import type { AsyncCommand } from './index'

type Rects = Record<number, BlockRects>

/**
 * The design checklist, run over the page or one section at desktop (1280)
 * and phone (390) widths. It measures the page first, so it's async; advice
 * that reads the same at both widths is reported once, at 1280.
 */
export const later = {
  review: {
    prepare: async (i: CommandInput<'review'>): Promise<Rects> => {
      const widths = (i.widths ?? ['desktop', 'mobile']).map((w) => MEASURE_WIDTHS[w])
      return Object.fromEntries(await Promise.all(widths.map(async (w) => [w, await measurePage(w)] as const)))
    },
    apply: (i: CommandInput<'review'>, rects: Rects) => {
      const st = useStore.getState()
      const slots = i.section !== undefined ? [findSection(i.section)] : st.slots
      const widths = (i.widths ?? ['desktop', 'mobile']).map((w) => MEASURE_WIDTHS[w])
      return slots.flatMap((s) => {
        const blocks = slotClip(s).blocks
        const seen = new Set<string>()
        return widths.flatMap((width) =>
          adviceFor(s, { width, rects: rects[width]?.[s.id] }).flatMap((a: Advice) => {
            const key = `${a.blockId}|${a.rule}|${a.message}`
            if (seen.has(key)) return []
            seen.add(key)
            return [{ section: s.id, block: blocks.find((b) => b.id === a.blockId)?.label, at: width, ...a }]
          }),
        )
      })
    },
  } satisfies AsyncCommand<Rects>,
}
