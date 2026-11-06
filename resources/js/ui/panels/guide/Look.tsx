import { useMemo, useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { FEEL_WORDS, NUDGE_LABEL, nudgesFor, nudgeTokens, themesFor, type FeelWord, type Nudge } from '@/core/feel'
import { emptyContract } from '@/core/contract'
import { openGroups, resolveGuide } from '@/core/guide'
import { skinList, skinOpen, surpriseMe } from '@/core/skins'
import { library } from '@/data/library'
import { useResolvedGuide } from '@/state/derived'
import { useStore } from '@/state/store'
import { ColorsByFeel } from '../../jev/ColorsByFeel'
import { BrandColor } from './Dials'
import { AllThemes, putSkin, SkinCard, useSkinLooks } from './Skins'
import { FontLinks } from './shared'

const TILE = 'rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]'
const CHIP = 'h-7 cursor-pointer rounded-full px-2.5 text-[11.5px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#ff69b4)]'
const LINK = 'cursor-pointer text-[11.5px] font-semibold text-zinc-500 transition-[color] [@media(hover:hover)_and_(pointer:fine)]:hover:text-zinc-900'

/** A mix in a line: where the colors and the type came from, then how many more themes chipped in. */
function shortMix(picks: { area: string; skin: { name: string } }[]): string {
  const from = (a: string) => picks.find((p) => p.area === a)?.skin.name
  const parts = [from('color') && `Colors from ${from('color')}`, from('type') && `type from ${from('type')}`].filter(Boolean) as string[]
  const rest = new Set(picks.filter((p) => p.area !== 'color' && p.area !== 'type').map((p) => p.skin.name))
  for (const n of [from('color'), from('type')]) if (n) rest.delete(n)
  const names = `${[...rest].slice(0, 2).join(' and ')}${rest.size > 2 ? ' and more' : ''}`
  const line = !parts.length ? (rest.size ? `Bits of ${names}` : '') : parts.join(', ') + (rest.size ? `, the rest from ${names}` : '')
  return (line || 'A few themes at once').replace(/^./, (c) => c.toUpperCase()) + '.'
}

const WORD_LABEL = (w: FeelWord) => w[0].toUpperCase() + w.slice(1)

/**
 * Look: how your site looks, for people who aren't designers. Say how it should feel and the themes that fit come
 * first; nudge it in plain words; give it your color. Every value lives one tap away, in the style guide.
 */
export function Look() {
  return (
    <div className="grid gap-2 p-3">
      <Feel />
      <Themes />
      <Nudges />
      <div className={TILE}>
        <div className="mb-1 text-[12.5px] font-semibold text-zinc-900">Your color</div>
        <BrandColor fallback={useResolvedGuide().tokens['color.primary']} />
        <ColorsByFeel />
      </div>
      <GuideDoor />
    </div>
  )
}

function Feel() {
  const words = useStore((s) => s.ui.feelWords) ?? []
  const toggle = (w: FeelWord) => useStore.getState().setUi({ feelWords: words.includes(w) ? words.filter((x) => x !== w) : [...words, w] })
  return (
    <div className={TILE}>
      <div className="text-[12.5px] font-semibold text-zinc-900">How should it feel?</div>
      <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-zinc-500">Tap a few. The themes that fit come first.</p>
      <div className="flex flex-wrap gap-1.5">
        {FEEL_WORDS.map((w) => {
          const on = words.includes(w)
          return (
            <button key={w} type="button" aria-pressed={on} onClick={() => toggle(w)} className={`${CHIP} ${on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-chip-hover'}`}>
              {WORD_LABEL(w)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Three themes for your words, or three you wouldn't have picked: two that match none of them and a mix of a few
 * (what Surprise me was), drawn before anything changes. Every theme is a tap away.
 */
function Themes() {
  const words = useStore((s) => s.ui.feelWords) ?? []
  const on = useStore((s) => s.guide.skin)
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const looks = useSkinLooks()
  const [different, setDifferent] = useState(false)
  const [all, setAll] = useState(false)
  const [seed, setSeed] = useState(() => Date.now() % 100000)

  const away = different && words.length > 0
  const picked = themesFor(words, skinList(), { different: away, count: away ? 2 : 3 })
  const shown = picked.map((s) => looks.find((l) => l.skin.id === s.id)!).filter(Boolean)
  // The mix, as it would land: the same pure roll the store runs with this seed.
  const mix = useMemo(() => {
    if (!away) return null
    const out = surpriseMe(guide, contract ?? emptyContract(), seed, skinList())
    return out && { words: shortMix(out.picks), tokens: resolveGuide(out.guide).tokens, components: out.guide.components }
  }, [away, guide, contract, seed])
  const putMix = () => {
    const st = useStore.getState()
    if (st.surpriseMe(seed) && mix) {
      st.showFlash(`A mix is on: ${mix.words.replace(/^./, (c) => c.toLowerCase())}`, { undo: true })
      setSeed((n) => n + 1)
    }
  }

  return (
    <div className={TILE}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] font-semibold text-zinc-900">Theme{on ? `: ${on.id === 'remix' ? 'a mix' : on.name}` : ''}</span>
        {words.length > 0 && (
          <button type="button" onClick={() => setDifferent((d) => !d)} className={LINK}>
            {away ? '‹ Back to my words' : 'Something different'}
          </button>
        )}
      </div>
      <FontLinks tokens={[...shown.map((l) => l.tokens), ...(mix ? [mix.tokens] : [])]} />
      <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">
        {shown.map(({ skin, tokens, components }) => (
          <SkinCard key={skin.id} label={skin.name} words={skin.words} tokens={tokens} components={components} here={on?.id === skin.id} locked={!skinOpen(library, skin)} onPick={() => putSkin(skin)} />
        ))}
        {mix && <SkinCard label="A mix" words={mix.words} tokens={mix.tokens} components={mix.components} here={false} locked={library.paid === false} onPick={putMix} />}
      </div>
      {mix && (
        <div className="mt-2 flex items-start justify-between gap-2 text-[11px] leading-snug text-zinc-500">
          <span className="min-w-0 text-pretty">A mix: {mix.words}</span>
          <button type="button" onClick={() => setSeed((n) => n + 1)} aria-label="Another mix" className={`flex shrink-0 items-center gap-1 ${LINK}`}>
            <RefreshCw size={11} /> Another
          </button>
        </div>
      )}
      <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={`mt-2.5 flex w-full items-center justify-between ${LINK}`}>
        <span>{all ? 'Fewer themes' : `All ${skinList().length} themes`}</span>
        <ChevronRight size={13} className={`transition-[rotate] duration-200 ${all ? 'rotate-90' : ''}`} />
      </button>
      {all && (
        <div className="mt-2">
          <AllThemes />
        </div>
      )}
    </div>
  )
}

/** Nudge it in plain words: each one turns a few Feel dials a step, or the page light or dark. */
function Nudges() {
  const tokens = useResolvedGuide().tokens
  const offered = nudgesFor(tokens)
  const nudge = (n: Nudge) => {
    const values = nudgeTokens(tokens, n)
    const st = useStore.getState()
    if (!values) return st.showFlash(`It’s as ${NUDGE_LABEL[n].toLowerCase().replace(/er$/, '')} as it goes`)
    st.chooseTokens(values)
    st.showFlash(NUDGE_LABEL[n], { undo: true })
  }
  return (
    <div className={TILE}>
      <div className="text-[12.5px] font-semibold text-zinc-900">Nudge it</div>
      <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-zinc-500">Each one moves a few things at once. ⌘Z takes it back.</p>
      <div className="flex flex-wrap gap-1.5">
        {offered.map((n) => (
          <button key={n} type="button" disabled={!nudgeTokens(tokens, n)} onClick={() => nudge(n)} className={`${CHIP} bg-transparent text-zinc-700 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] disabled:cursor-default disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:enabled:hover:bg-zinc-950/5`}>
            {NUDGE_LABEL[n]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The way into every value: for a designer, or for your agent. Says when the style guide has a choice waiting. */
function GuideDoor() {
  const decisions = openGroups(useResolvedGuide()).length
  return (
    <button
      type="button"
      onClick={() => useStore.getState().setUi({ guideView: 'guide' })}
      className={`${TILE} flex cursor-pointer items-center justify-between gap-3 text-left transition-[translate,box-shadow,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5`}
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-900">
          Style guide
          {decisions > 0 && <span className="rounded-full bg-attention-soft px-2 py-0.5 text-[10.5px] font-bold text-attention-ink">{decisions} to decide</span>}
        </span>
        <span className="text-[11.5px] leading-snug text-zinc-500">Every value, for a designer or your agent.</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-zinc-400" />
    </button>
  )
}
