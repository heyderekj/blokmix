import { useEffect, useMemo, useRef, useState } from 'react'
import { listParts } from '@/core/themeParts'
import { AREA_LABEL, type StyleArea } from '@/core/contract'
import { swapThemeParts, type ThemeParts } from '@/core/skins'
import { runCommand } from '@/state/commands'
import { checkLook, restyle } from '@/state/jevThemes'
import { useJevTools } from '@/state/jevSay'
import { useStore } from '@/state/store'
import { pageOf } from '@/core/site'
import { SkinPreview } from '@/ui/skins/SkinPreview'
import { jevOn } from '@/lib/jev'

const control = 'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2'

export function PartPicker() {
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const content = useStore((s) => s.content)
  const site = useStore((s) => s.site)
  const pageId = useStore((s) => s.ui.pageId)
  const draft = useStore((s) => s.draftId)
  const enabled = useStore((s) => s.ui.jev)
  const asked = useJevTools((s) => (s.open === 'restyle' ? s.text : undefined))
  const [area, setArea] = useState<StyleArea | ''>('')
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(false)
  const [alternatives, setAlternatives] = useState<ThemeParts[]>([])
  const [parts, setParts] = useState<ThemeParts | null>(null)
  const request = useRef(0)
  const rows = useMemo(() => listParts(guide, contract), [guide, contract])
  const row = rows.find((r) => r.area === area)
  const result = useMemo(
    () =>
      parts && Object.entries(parts).every(([a, id]) => rows.some((r) => r.area === a && !r.kept && r.options.some((p) => p.id === id)))
        ? swapThemeParts(guide, parts, contract)
        : null,
    [parts, guide, contract, rows],
  )
  const page = useMemo(() => {
    const here = pageOf(site, pageId)
    return { ...site, pages: [here, ...site.pages.filter((p) => p !== here)] }
  }, [site, pageId])
  const clear = () => {
    request.current++
    setParts(null)
    setAlternatives([])
    setNote('')
    setBusy(false)
  }
  useEffect(() => {
    clear()
    return () => {
      request.current++
    }
  }, [guide, contract, content, draft, enabled])
  useEffect(() => {
    let live = true
    if (enabled) jevOn().then((on) => live && setOnline(on))
    return () => {
      live = false
    }
  }, [enabled])
  useEffect(() => {
    if (asked) {
      setText(asked)
      useJevTools.setState({ open: null })
    }
  }, [asked])
  const ask = async (check: boolean) => {
    clear()
    setBusy(true)
    const id = request.current
    try {
      const r = check ? await checkLook() : await restyle(text)
      if (id !== request.current) return
      const options = 'options' in r ? r.options.map((o) => o.parts) : r.parts ? [r.parts] : []
      setAlternatives(options)
      setParts(options[0] ?? null)
      setArea('')
      setNote('verdict' in r ? r.verdict : options.length ? '' : 'No clear change for those words.')
    } catch {
      if (id === request.current) setNote('Suggestions are unavailable. You can still choose a part.')
    } finally {
      if (id === request.current) setBusy(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-2xl bg-[var(--lift)] p-3">
      <label className="grid gap-1.5 text-[13px] font-semibold">
        Change one part
        <select
          aria-label="Change one part"
          className={control}
          value={area}
          onChange={(e) => {
            clear()
            setArea(e.target.value as StyleArea)
          }}
        >
          <option value="">Choose a part</option>
          {rows.map((r) => (
            <option key={r.area} value={r.area}>
              {r.name}
              {r.kept ? ' · Kept' : ''}
            </option>
          ))}
        </select>
      </label>
      {row &&
        (row.kept ? (
          <p className="text-xs">
            {row.name} is kept.{' '}
            <button className="underline" onClick={() => useStore.getState().setUi({ guideView: 'guide' })}>
              Rules for your agent
            </button>
          </p>
        ) : (
          <label className="grid gap-1 text-xs">
            {row.name}
            <select
              aria-label={row.name}
              className={control}
              value={parts?.[row.area] ?? row.current ?? ''}
              onChange={(e) => setParts(e.target.value ? { [row.area]: e.target.value } : null)}
            >
              {!row.current && <option value="">Your own</option>}
              {row.options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      {enabled && online && (
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs">
            Say how it should change
            <input
              className={control}
              value={text}
              maxLength={300}
              onChange={(e) => {
                clear()
                setText(e.target.value)
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={control} disabled={busy || !text.trim()} onClick={() => ask(false)}>
              Preview changes
            </button>
            <button className={control} disabled={busy} onClick={() => ask(true)}>
              Check the fit
            </button>
          </div>
        </div>
      )}
      {(busy || note) && (
        <p role="status" className="text-xs">
          {busy ? 'Checking the look…' : note}
        </p>
      )}
      {alternatives.length > 0 && (
        <div className="grid gap-1">
          {alternatives.map((p, i) => (
            <button key={i} className={control} aria-pressed={p === parts} onClick={() => setParts(p)}>
              {Object.entries(p)
                .map(([a, id]) => `${AREA_LABEL[a as StyleArea].name} · ${rows.find((r) => r.area === a)?.options.find((o) => o.id === id)?.name ?? id}`)
                .join(', ')}
            </button>
          ))}
        </div>
      )}
      {parts && result && (
        <>
          <SkinPreview site={page} content={content} guide={result} title="Preview changes on this page" height={190} />
          <div className="flex gap-2">
            <button
              className={control}
              onClick={() => {
                runCommand('set_theme_parts', { parts }, 'you')
                clear()
                useStore.getState().showFlash('Theme updated', { undo: true })
              }}
            >
              Use this
            </button>
            <button className={control} onClick={clear}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  )
}
