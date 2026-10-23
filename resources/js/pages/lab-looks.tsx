import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import type { BlockKind } from '@/core/types'
import { VARIANTS, type Variant } from '@/core/blocks/variants'
import { expandTokens, varsToCss } from '@/core/tokens'
import { fontHrefFor, useResolvedGuide } from '@/state/derived'
import { useStore } from '@/state/store'

/**
 * Design exploration: the Look menu. Today it's names and one-line hints;
 * these show each look itself, drawn with your style guide. Open with ?lab=looks.
 */
const KINDS: { kind: BlockKind; label: string; text: string; suggested: string[] }[] = [
  { kind: 'badge', label: 'Badge', text: 'Now in beta', suggested: ['pill', 'dot'] },
  { kind: 'button', label: 'Button', text: 'Start a tape', suggested: ['solid', 'pill'] },
  { kind: 'heading', label: 'Heading', text: 'Clip the web', suggested: ['gradient', 'scribble'] },
  { kind: 'card', label: 'Card', text: 'Slide to remix', suggested: ['raised', 'tinted'] },
]

export default function LabLooks() {
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const tokens = useResolvedGuide().tokens
  const [k, setK] = useState(0)
  const kind = KINDS[k]
  const css = useMemo(() => {
    // Your tokens on a wrapper, and every look scoped to a class, exactly as the frames draw them.
    const vars = varsToCss(expandTokens(tokens), '.lv')
    const looks = (Object.entries(VARIANTS) as [BlockKind, Variant[]][]).flatMap(([kd, list]) => list.map((v) => `.lv .lv-${kd}-${v.id} { ${v.css} }`))
    return `${vars}\n.lv { font-family: var(--mx-font-body); color: var(--mx-color-text); }\n${looks.join('\n')}`
  }, [tokens])
  const href = fontHrefFor(tokens)

  const variants: { letter: string; name: string; notes: string; V: (p: P) => ReactNode }[] = [
    { letter: 'A', name: 'Look swatches', notes: 'A grid of the block drawn in each look, in your style. The same idea as the motion swatches; the hint is a tooltip.', V: VariantA },
    { letter: 'B', name: 'Sample rows', notes: 'Compact rows: the sample on the left, the name beside it. Suggested looks first, the rest under “More”. Easy to scan, still visual.', V: VariantB },
    { letter: 'C', name: 'Step through on the page', notes: 'No menu: ‹ › arrows in the block bar cycle looks right on the page, like sliding sections, with the name and a dot per look.', V: VariantC },
    { letter: 'D', name: 'Big preview + strip', notes: 'One large preview of the look you’re on, with a strip of small samples underneath to choose from.', V: VariantD },
  ]

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      {href && <link rel="stylesheet" href={href} />}
      <style>{css}</style>
      <div className="mx-auto max-w-[1240px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">The Look menu: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">Samples are drawn with your style guide and the real look CSS. Switch the block type to see how each copes.</p>
        <div className="mt-4 flex gap-1">
          {KINDS.map((x, i) => (
            <button key={x.kind} type="button" onClick={() => setK(i)} className={`h-7 rounded-full px-3 text-[12.5px] font-medium ${i === k ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-700 hover:bg-chip-hover'}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6">
          {variants.map(({ letter, name, notes, V }) => (
            <section key={letter} className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
                <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">{notes}</p>
              <V kind={kind.kind} text={kind.text} suggested={kind.suggested} />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

type P = { kind: BlockKind; text: string; suggested: string[] }

/** The block drawn in one look (or its original look), at a given scale. */
function Sample({ kind, id, text, scale = 1 }: { kind: BlockKind; id?: string; text: string; scale?: number }) {
  const cls = id ? `lv-${kind}-${id}` : ''
  const el =
    kind === 'heading' ? (
      <span className={cls} style={{ fontFamily: 'var(--mx-font-display)', fontWeight: 'var(--mx-type-display-weight)' as never, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
        {text}
      </span>
    ) : kind === 'card' ? (
      <span className={cls} style={id ? { display: 'block', width: 150 } : { display: 'block', width: 150, padding: 14, borderRadius: 10, background: 'var(--mx-color-surface)' }}>
        <span style={{ display: 'block', fontFamily: 'var(--mx-font-display)', fontSize: 15, fontWeight: 600 }}>{text}</span>
        <span style={{ display: 'block', marginTop: 4, height: 5, width: '80%', borderRadius: 3, background: 'color-mix(in oklab, var(--mx-color-text) 18%, transparent)' }} />
        <span style={{ display: 'block', marginTop: 4, height: 5, width: '55%', borderRadius: 3, background: 'color-mix(in oklab, var(--mx-color-text) 18%, transparent)' }} />
      </span>
    ) : kind === 'button' ? (
      <span className={cls} style={id ? undefined : { display: 'inline-flex', padding: '10px 18px', borderRadius: 8, background: 'var(--mx-color-primary)', color: 'var(--mx-color-on-primary)', fontWeight: 600, fontSize: 14 }}>
        {text}
      </span>
    ) : (
      <span className={cls} style={id ? undefined : { fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mx-color-muted)' }}>
        {text}
      </span>
    )
  return (
    <span className="lv inline-flex" style={{ zoom: scale }}>
      {el}
    </span>
  )
}

const looksFor = (kind: BlockKind, suggested: string[]) => {
  const list = VARIANTS[kind] ?? []
  return [...list].sort((a, b) => (suggested.includes(b.id) ? 1 : 0) - (suggested.includes(a.id) ? 1 : 0))
}

const panel = 'glass-menu rounded-2xl p-2'

function VariantA({ kind, text, suggested }: P) {
  const [on, setOn] = useState<string | undefined>()
  const items = [{ id: undefined, label: 'Original', hint: 'As clipped' }, ...looksFor(kind, suggested)]
  return (
    <div className={`${panel} w-[360px]`}>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((v) => (
          <button key={v.id ?? 'o'} type="button" title={v.hint} onClick={() => setOn(v.id)} className="group flex flex-col gap-1 text-left">
            <span className={`lv grid h-[72px] place-items-center overflow-hidden rounded-xl px-2 transition ${on === v.id ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/8 group-hover:ring-zinc-950/25'}`} style={{ background: 'var(--mx-color-bg)' }}>
              <Sample kind={kind} id={v.id} text={text} scale={kind === 'heading' ? 0.6 : kind === 'card' ? 0.75 : 0.85} />
            </span>
            <span className="flex items-center gap-1 px-0.5 text-[11.5px] font-medium text-zinc-700">
              {v.label}
              {v.id && suggested.includes(v.id) && <Sparkles size={10} className="text-key-ink" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function VariantB({ kind, text, suggested }: P) {
  const [on, setOn] = useState<string | undefined>()
  const list = looksFor(kind, suggested)
  const Row = ({ v }: { v: { id?: string; label: string; hint: string } }) => (
    <button type="button" onClick={() => setOn(v.id)} title={v.hint} className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left ${on === v.id ? 'bg-zinc-950/[0.06]' : 'hover:bg-zinc-950/[0.04]'}`}>
      <span className="lv grid h-12 w-28 shrink-0 place-items-center overflow-hidden rounded-lg ring-1 ring-zinc-950/8" style={{ background: 'var(--mx-color-bg)' }}>
        <Sample kind={kind} id={v.id} text={text} scale={kind === 'heading' ? 0.45 : kind === 'card' ? 0.5 : 0.7} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-zinc-900">{v.label}</span>
        <span className="block truncate text-[11.5px] text-zinc-500">{v.hint}</span>
      </span>
      {on === v.id && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-tape" />}
    </button>
  )
  return (
    <div className={`${panel} w-[340px]`}>
      <div className="flex items-center gap-1 px-2 pb-1 pt-0.5 text-[11px] font-semibold text-zinc-400">
        <Sparkles size={11} /> Suggested here
      </div>
      <Row v={{ id: undefined, label: 'Original', hint: 'As clipped' }} />
      {list.filter((v) => suggested.includes(v.id)).map((v) => <Row key={v.id} v={v} />)}
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-zinc-400">More</div>
      {list.filter((v) => !suggested.includes(v.id)).map((v) => <Row key={v.id} v={v} />)}
    </div>
  )
}

function VariantC({ kind, text, suggested }: P) {
  const items = [{ id: undefined as string | undefined, label: 'Original', hint: 'As clipped' }, ...looksFor(kind, suggested)]
  const [i, setI] = useState(0)
  const cur = items[i]
  const step = (d: number) => setI((n) => (n + d + items.length) % items.length)
  return (
    <div className="w-[380px]">
      {/* the page */}
      <div className="lv grid h-36 place-items-center rounded-2xl ring-1 ring-zinc-950/8" style={{ background: 'var(--mx-color-bg)' }}>
        <span style={{ outline: '2px solid var(--color-tape)', outlineOffset: 6, borderRadius: 4 }}>
          <Sample kind={kind} id={cur.id} text={text} />
        </span>
      </div>
      {/* the bar */}
      <div className="glass-panel mt-2 flex h-10 items-center gap-1 rounded-[14px] px-1.5 text-[12.5px]">
        <span className="px-1.5 font-semibold text-zinc-900">{kind[0].toUpperCase() + kind.slice(1)}</span>
        <div className="mx-1 h-5 w-px bg-zinc-950/10" />
        <button type="button" onClick={() => step(-1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-950/5" aria-label="Previous look">
          <ChevronLeft size={15} />
        </button>
        <span className="w-24 text-center font-semibold text-zinc-800" title={cur.hint}>
          {cur.label}
        </span>
        <button type="button" onClick={() => step(1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-950/5" aria-label="Next look">
          <ChevronRight size={15} />
        </button>
        <div className="ml-1 flex gap-1">
          {items.map((v, n) => (
            <button key={v.id ?? 'o'} type="button" onClick={() => setI(n)} title={v.label} className={`size-1.5 rounded-full ${n === i ? 'bg-zinc-900' : v.id && suggested.includes(v.id) ? 'bg-key' : 'bg-zinc-300'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function VariantD({ kind, text, suggested }: P) {
  const items = [{ id: undefined as string | undefined, label: 'Original', hint: 'As clipped' }, ...looksFor(kind, suggested)]
  const [i, setI] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const show = items[hover ?? i]
  return (
    <div className={`${panel} w-[360px]`}>
      <div className="lv grid h-32 place-items-center rounded-xl ring-1 ring-zinc-950/8" style={{ background: 'var(--mx-color-bg)' }}>
        <Sample kind={kind} id={show.id} text={text} />
      </div>
      <div className="px-1 pt-2">
        <div className="text-[13px] font-semibold text-zinc-900">{show.label}</div>
        <div className="text-[11.5px] text-zinc-500">{show.hint}</div>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 thin-scroll" onMouseLeave={() => setHover(null)}>
        {items.map((v, n) => (
          <button key={v.id ?? 'o'} type="button" onMouseEnter={() => setHover(n)} onClick={() => setI(n)} className={`lv grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg ${n === i ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-950/8'}`} style={{ background: 'var(--mx-color-bg)' }}>
            <Sample kind={kind} id={v.id} text={text} scale={kind === 'heading' ? 0.3 : kind === 'card' ? 0.32 : 0.45} />
          </button>
        ))}
      </div>
    </div>
  )
}
