import { useMemo } from 'react'
import type { BlockKind } from '@/core/types'
import { VARIANTS, type Variant } from '@/core/blocks/variants'
import { expandTokens, varsToCss } from '@/core/tokens'
import { fontHrefsFor, useResolvedGuide } from '@/state/derived'

/**
 * Your style guide's tokens on `.lv`, and every look scoped to a class, so a
 * sample in the chrome is drawn exactly as the frames draw the block. Mounted
 * once, wherever samples are shown.
 */
export function LookStyles() {
  const tokens = useResolvedGuide().tokens
  const css = useMemo(() => {
    const vars = varsToCss(expandTokens(tokens), '.lv')
    const looks = (Object.entries(VARIANTS) as [BlockKind, Variant[]][]).flatMap(([kind, list]) => list.map((v) => `.lv .lv-${kind}-${v.id} { ${v.css} }`))
    return `${vars}\n.lv { font-family: var(--mx-font-body); color: var(--mx-color-text); }\n${looks.join('\n')}`
  }, [tokens])
  const hrefs = fontHrefsFor(tokens)
  return (
    <>
      {hrefs.map((h) => (
        <link key={h} rel="stylesheet" href={h} />
      ))}
      <style>{css}</style>
    </>
  )
}

const line = (w: string) => <span style={{ display: 'block', marginTop: 4, height: 5, width: w, borderRadius: 3, background: 'color-mix(in oklab, var(--mx-color-text) 18%, transparent)' }} />

/** A block drawn in one look (or as clipped, without one), with its own words. */
export function LookSample({ kind, look, text }: { kind: BlockKind; look?: string; text: string }) {
  const k = kind === 'item' ? 'card' : kind
  const cls = look ? `lv-${kind}-${look}` : ''
  const words = text.length > 26 ? `${text.slice(0, 24)}…` : text
  switch (k) {
    case 'heading':
      return (
        <span className={cls} style={{ fontFamily: 'var(--mx-font-display)', fontWeight: 'var(--mx-type-display-weight)' as never, fontSize: 24, lineHeight: 1.05, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          {words}
        </span>
      )
    case 'card':
      return (
        <span className={cls} style={look ? { display: 'block', width: 140 } : { display: 'block', width: 140, padding: 12, borderRadius: 10, background: 'var(--mx-color-surface)' }}>
          <span style={{ display: 'block', fontFamily: 'var(--mx-font-display)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{words}</span>
          {line('80%')}
          {line('55%')}
        </span>
      )
    case 'button':
      return (
        <span className={cls} style={look ? { whiteSpace: 'nowrap' } : { display: 'inline-flex', padding: '9px 16px', borderRadius: 8, background: 'var(--mx-color-primary)', color: 'var(--mx-color-on-primary)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
          {words}
        </span>
      )
    case 'badge':
      return (
        <span className={cls} style={look ? { whiteSpace: 'nowrap' } : { fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mx-color-muted)', whiteSpace: 'nowrap' }}>
          {words}
        </span>
      )
    case 'link':
      return (
        <span className={cls} style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', ...(look ? {} : { textDecoration: 'underline' }) }}>
          {words}
        </span>
      )
    case 'image':
      return (
        <span className={cls} style={{ display: 'block', width: 84, height: 60, background: 'linear-gradient(135deg, var(--mx-color-primary), var(--mx-color-accent))', ...(look ? {} : { borderRadius: 6 }) }} />
      )
    case 'icon':
      return (
        <span className={cls} style={look ? {} : { display: 'inline-grid', placeItems: 'center', width: 36, height: 36, color: 'var(--mx-color-primary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3v18M3 12h18" />
          </svg>
        </span>
      )
    case 'banner':
      return (
        <span className={cls} style={{ display: 'flex', gap: 8, width: 170, padding: '5px 8px', fontFamily: 'var(--mx-font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', ...(look ? {} : { background: 'var(--mx-color-text)', color: 'var(--mx-color-bg)' }) }}>
          {words} <span style={{ color: 'var(--mx-color-primary)' }}>★</span> {words}
        </span>
      )
    case 'input':
      return (
        <span className={cls} style={{ display: 'block', width: 150, fontSize: 13, color: 'var(--mx-color-muted)', ...(look ? {} : { padding: '8px 10px', border: 'var(--mx-stroke) solid var(--mx-color-border)', borderRadius: 8 }) }}>
          you@example.com
        </span>
      )
    default:
      return (
        <span className={cls} style={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
          {words}
        </span>
      )
  }
}

/** The sample at a size that fits a menu row. */
export function LookThumb({ kind, look, text }: { kind: BlockKind; look?: string; text: string }) {
  const zoom = kind === 'heading' ? 0.55 : kind === 'card' || kind === 'item' ? 0.55 : kind === 'image' ? 0.7 : 0.72
  return (
    <span className="lv grid h-12 w-28 shrink-0 place-items-center overflow-hidden rounded-lg ring-1 ring-zinc-950/8" style={{ background: 'var(--mx-color-bg)' }}>
      <span style={{ zoom }}>
        <LookSample kind={kind} look={look} text={text} />
      </span>
    </span>
  )
}
