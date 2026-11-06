// The quiet ways to start a new mix, besides the questions: a starter, a saved style guide, a blank page or a mix
// file. Starters and guides list here; the guided start shows them under its first questions.
import { useEffect, useMemo } from 'react'
import { Lock } from 'lucide-react'
import type { GuideState, SectionType, TokenSet } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { TYPE_LABEL } from '@/core/content'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { library, starters } from '@/data/library'
import { buildStarter, type Starter } from '@/core/starters'
import { starterOpen } from '@/core/library'

/** A style guide to start from: one you saved, or another mix's. */
export interface GuideChoice {
  key: string
  name: string
  note: string
  guide?: GuideState
}

const PRESS = 'cursor-pointer transition-[scale,box-shadow] duration-150 active:scale-[0.99]'
const OPTION = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgb(23_18_26/0.1)] ${PRESS} [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_1px_rgb(23_18_26/0.25)]`
const PICKED = 'shadow-[inset_0_0_0_2px_#FF69B4] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_2px_#FF69B4]'

function Label({ title, note }: { title: string; note: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-semibold text-[#17121A]">{title}</span>
      <span className="block truncate text-[12.5px] text-[#6B5F68]">{note}</span>
    </span>
  )
}

/** "Aa" in the guide's display type with its main color, on its own background. */
function Swatch({ tokens: t }: { tokens: TokenSet }) {
  return (
    <span className="flex h-10 w-14 shrink-0 items-center justify-center gap-1.5 rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: t['color.bg'], color: t['color.text'] }}>
      <span className="text-[17px] leading-none" style={{ fontFamily: t['font.display'], fontWeight: Number(t['type.displayWeight']) || 700 }}>
        Aa
      </span>
      <i className="size-2 rounded-full" style={{ background: t['color.primary'] }} />
    </span>
  )
}

export function StarterOption({ starter, picked, onPick }: { starter: Starter; picked: boolean; onPick: () => void }) {
  const { site, guide } = useMemo(() => buildStarter(library, starter), [starter])
  const t = useMemo(() => resolveGuide(guide).tokens, [guide])
  const sections = site.pages[0].slots.map((s) => TYPE_LABEL[s.type as SectionType]).join(' · ')
  // On Free, a starter that uses layouts in a mix pack shows a lock (creating it says why).
  const locked = !starterOpen(library, starter)
  return (
    <button type="button" onClick={onPick} className={`${OPTION} ${picked ? PICKED : ''} relative`} title={locked ? 'Uses layouts in a mix pack' : undefined}>
      <Swatch tokens={t} />
      <Label title={starter.name} note={locked ? `In a mix pack · ${sections}` : sections} />
      {locked && <Lock size={13} className="absolute right-2.5 top-2.5 text-zinc-500" aria-label="In a mix pack" />}
    </button>
  )
}

export function GuideOption({ name, note, guide, picked, onPick }: { name: string; note: string; guide?: GuideState; picked: boolean; onPick: () => void }) {
  const t = resolveGuide(guide ?? { base: library.sources.layout.tokens, candidates: [], choices: {} }).tokens
  return (
    <button type="button" onClick={onPick} className={`${OPTION} ${picked ? PICKED : ''}`}>
      <Swatch tokens={t} />
      <Label title={name} note={note} />
    </button>
  )
}

/** Load the display fonts of every starter and guide on show, so each "Aa" is set in its own type. */
export function useDisplayFonts(guides: GuideChoice[] | null) {
  const hrefs = useMemo(() => {
    const out = new Set<string>()
    const add = (t: TokenSet) => {
      const tokens = { 'font.display': t['font.display'], 'font.body': t['font.display'], 'font.mono': t['font.display'] } as Parameters<typeof fontsForTokens>[0]
      for (const h of fontHrefs(fontsForTokens(tokens, []))) out.add(h)
    }
    for (const s of starters) add(resolveGuide(buildStarter(library, s).guide).tokens)
    for (const g of guides ?? []) if (g.guide) add(resolveGuide(g.guide).tokens)
    return [...out]
  }, [guides])
  useEffect(() => {
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [hrefs])
}
