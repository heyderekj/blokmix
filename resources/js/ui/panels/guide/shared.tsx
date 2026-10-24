import type { Candidate, TokenGroup, TokenKey, TokenSet } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { groupWinner, openGroups } from '@/core/guide'
import { keysInGroup, primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { fontHrefsFor, useResolvedGuide } from '@/state/derived'

/** What every style guide direction reads: the resolved tokens, the open decisions, and each group's sources. */
export function useGuideData() {
  const guide = useResolvedGuide()
  const state = useStore((s) => s.guide)
  const open = openGroups(guide)
  const candidates = (g: TokenGroup) => state.candidates.filter((c) => c.group === g)
  const winner = (g: TokenGroup) => groupWinner(state, g)
  const decided = TOKEN_GROUPS.filter((g) => candidates(g).length > 1 && !open.includes(g))
  return { guide, tokens: guide.tokens, state, open, candidates, winner, decided }
}

export const sourceName = (c: Candidate) => library.sources[library.clips[c.clipId]?.sourceId]?.name ?? c.clipId

/** The guide with one candidate's values for its group laid over it: what choosing it would look like. */
export const withCandidate = (tokens: TokenSet, c: Candidate | null | undefined): TokenSet => (c ? ({ ...tokens, ...c.values } as TokenSet) : tokens)

/** Follow one source for a whole group. */
export const choose = (c: Candidate) => useStore.getState().chooseGroup(c.id)

/** Back to undecided: the group's tokens go automatic again. */
export const unchoose = (g: TokenGroup) => {
  const st = useStore.getState()
  for (const k of keysInGroup(g)) if (st.guide.choices[k]) st.chooseToken(k, null)
}

/** Load the fonts a token set uses, so previews draw in them. */
export function FontLinks({ tokens }: { tokens: TokenSet[] }) {
  const hrefs = [...new Set(tokens.flatMap((t) => fontHrefsFor(t)))]
  return (
    <>
      {hrefs.map((h) => (
        <link key={h} rel="stylesheet" href={h} />
      ))}
    </>
  )
}

const px = (v: string, fallback = 0) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

/**
 * A small page drawn from tokens: eyebrow, headline, line of body, two buttons and
 * (large) a card. Uses the mix's own hero words, so a choice reads in context.
 */
export function Specimen({ tokens, size = 'lg', className = '' }: { tokens: TokenSet; size?: 'lg' | 'sm'; className?: string }) {
  const words = useStore((s) => s.content.fields.hero ?? {})
  const r = px(tokens['radius.base'], 8)
  const lg = size === 'lg'
  const dur = tokens['motion.duration'] || '200ms'
  const ease = tokens['motion.ease'] || 'ease-out'
  return (
    <div
      className={`grid gap-2 overflow-hidden ${lg ? 'p-5' : 'p-3'} ${className}`}
      style={{ background: tokens['color.bg'], color: tokens['color.text'], fontFamily: tokens['font.body'], borderRadius: Math.min(r * 1.6, 18) + 6, boxShadow: `inset 0 0 0 ${tokens['stroke.width'] || '1px'} ${tokens['color.border']}` }}
    >
      {lg && (
        <span className="w-max rounded-full px-2 py-0.5 text-[10px] tracking-[0.08em] uppercase" style={{ fontFamily: tokens['font.mono'], color: tokens['color.accent'], boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tokens['color.accent']} 40%, transparent)` }}>
          {words.eyebrow || 'Now in private beta'}
        </span>
      )}
      <span className="text-balance" style={{ fontFamily: tokens['font.display'], fontWeight: Number(tokens['type.displayWeight']) || 700, fontSize: lg ? 26 : 15, lineHeight: 1.06, letterSpacing: '-0.01em' }}>
        {(lg ? words.headline : words.headline?.split(/[.!?]/)[0]) || 'Clip the web. Mix your site.'}
      </span>
      {lg && (
        <span className="line-clamp-2 text-[12.5px] leading-snug text-pretty" style={{ color: tokens['color.muted'] }}>
          {words.subhead || 'Grab sections from any site you love and hand a clean packet to your agent.'}
        </span>
      )}
      <span className={`flex items-center gap-1.5 ${lg ? 'mt-1' : ''}`}>
        <span
          className={`inline-flex items-center font-semibold transition-[translate,filter] hover:-translate-y-px hover:brightness-110 ${lg ? 'h-8 px-3.5 text-[12px]' : 'h-5 px-2 text-[9px]'}`}
          style={{ background: tokens['color.primary'], color: tokens['color.onPrimary'], borderRadius: r, transitionDuration: dur, transitionTimingFunction: ease }}
        >
          {words.ctaPrimary || 'Start a mix'}
        </span>
        {lg && (
          <span className="inline-flex h-8 items-center px-3.5 text-[12px] font-semibold" style={{ borderRadius: r, boxShadow: `inset 0 0 0 ${tokens['stroke.width'] || '1px'} ${tokens['color.border']}` }}>
            {words.ctaSecondary || 'Watch the demo'}
          </span>
        )}
      </span>
      {lg && (
        <span className="mt-1 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="grid gap-1 p-2" style={{ background: tokens['color.surface'], borderRadius: r, boxShadow: tokens['shadow.card'] }}>
              <span className="size-3 rounded-full" style={{ background: i === 1 ? tokens['color.accent'] : tokens['color.primary'], opacity: 0.85 }} />
              <span className="h-1 w-3/4 rounded-full" style={{ background: tokens['color.text'], opacity: 0.5 }} />
              <span className="h-1 w-1/2 rounded-full" style={{ background: tokens['color.muted'], opacity: 0.5 }} />
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

/** A group's sources as small marks: three colors, "Aa" in the face, a corner, a value. */
export function SourceMark({ group, tokens, size = 28 }: { group: TokenGroup; tokens: TokenSet; size?: number }) {
  const box = { width: size + 8, height: size, background: tokens['color.bg'], boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.08)' }
  if (group === 'color')
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-md" style={box}>
        <span className="flex -space-x-1">
          {(['color.primary', 'color.accent', 'color.text'] as TokenKey[]).map((k) => (
            <span key={k} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: tokens[k] }} />
          ))}
        </span>
      </span>
    )
  if (group === 'type')
    return (
      <span className="grid shrink-0 place-items-center rounded-md" style={{ ...box, color: tokens['color.text'] }}>
        <span style={{ fontFamily: tokens['font.display'], fontWeight: Number(tokens['type.displayWeight']) || 700, fontSize: size * 0.55, lineHeight: 1 }}>Aa</span>
      </span>
    )
  if (group === 'shape')
    return (
      <span className="grid shrink-0 place-items-end overflow-hidden rounded-md p-1" style={box}>
        <span className="block size-[70%] border-l-2 border-t-2" style={{ borderColor: tokens['color.text'], borderTopLeftRadius: Math.min(px(tokens['radius.base']), size * 0.6), borderWidth: `${Math.max(1, px(tokens['stroke.width'], 1))}px 0 0 ${Math.max(1, px(tokens['stroke.width'], 1))}px` }} />
      </span>
    )
  return (
    <span className="grid shrink-0 place-items-center rounded-md font-mono text-[9px]" style={{ ...box, color: tokens['color.text'] }}>
      {group === 'space' ? tokens['space.section'] : tokens['motion.duration']}
    </span>
  )
}

/** One line saying what a group is now. */
export function summaryOf(group: TokenGroup, t: TokenSet): string {
  if (group === 'color') return `${t['color.primary']} on ${t['color.bg']}`
  if (group === 'type') return `${primaryFamily(t['font.display'])} · ${t['type.base']} × ${t['type.ratio']}`
  if (group === 'shape') return `${t['radius.base']} corners · ${t['stroke.width']} lines`
  if (group === 'space') return `${t['space.base']} steps · ${t['space.section']} sections`
  return `${t['motion.duration']} · ${t['motion.ease'].includes('1.56') ? 'springy' : 'ease-out'}`
}
