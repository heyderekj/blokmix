import { ICON_NAMES, ICON_SETS } from '@/core/icons'
import { type CommandInput } from '@/core/commands/schema'
import { variantsFor } from '@/core/blocks/variants'
import { suggestedVariants } from '@/core/advise'
import { suggestClip, suggestTypes } from '@/core/suggest'
import { resolveGuide, openGroups } from '@/core/guide'
import { library, slotClip } from '@/data/library'
import { PROVIDER_LABEL, PROVIDER_LICENSE, searchFonts } from '@/core/fonts'
import { listContext } from '@/core/lists'
import { contentJson, type OutlineNode } from '@/core/outline'
import { wordChoices } from '@/core/words'
import { pageView } from '@/core/site'
import { revealSection } from '@/lib/actions'
import { useStore } from '../store'
import { findPage, findSection, findBlock, wordsFor, describeSection, outlineOf, adviceFor, positionOf } from './refs'

/** Reads about the page: its sections, words, fonts and options, and focusing one. */
export const read = {
  get_page: (i: CommandInput<'get_page'>) => {
    const st = useStore.getState()
    const guide = resolveGuide(st.guide)
    const page = findPage(i.page)
    const sections = i.section !== undefined ? [findSection(i.section, page.id)] : pageView(st.site, page.id)
    return {
      mix: st.mixName,
      page: { path: page.path, title: page.title, nav: page.show.nav, footer: page.show.footer },
      pages: st.site.pages.map((p) => p.path),
      mode: st.ui.mode === 'unified' ? 'your style' : 'original',
      sections: sections.map((s) => describeSection(s, positionOf(s, page.id))),
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
    const page = findPage(i.page)
    const sections = i.section !== undefined ? [findSection(i.section, page.id)] : pageView(st.site, page.id)
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
      return { section: s.id, position: positionOf(s, page.id), type: s.type, content: contentJson(nodes, wordsFor(s)), lists, options }
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
    const page = findPage(i.page)
    const view = pageView(st.site, page.id)
    if (i.section !== undefined && i.block) {
      const slot = findSection(i.section, page.id)
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
      const slot = findSection(i.section, page.id)
      const at = Math.max(0, view.indexOf(slot))
      return { section: slot.id, options: suggestClip(slot.type, view, at, library, true).map((o) => ({ ...o, title: library.clips[o.clipId].title, origin: library.clips[o.clipId].origin })) }
    }
    const at = i.at ?? view.length
    return { page: page.path, at, types: suggestTypes(view, at).map((t) => ({ ...t, available: library.byType[t.type].length > 0 })) }
  },
  show: (i: CommandInput<'show'>) => {
    const st = useStore.getState()
    const page = findPage(i.page)
    if (i.section === undefined) {
      st.openPage(page.id)
      return { page: page.path }
    }
    const slot = findSection(i.section, page.id)
    st.focusSlot(slot.id)
    revealSection(slot.id)
    st.selectBlock(i.block ? findBlock(slot, i.block).id : null)
    return { page: findPage().path, focused: slot.id }
  },
}
