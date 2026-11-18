import { Dropdown } from '@/ui/controls/Dropdown'
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
const field = `${control} w-full min-w-0`

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
      <div className="grid gap-1.5 text-[13px] font-semibold">
        <span>Change one part</span>
        <Dropdown
          label="Change one part"
          className="w-full"
          value={area}
          options={[{ v: '' as const, label: 'Choose a part' }, ...rows.map((r) => ({ v: r.area, label: r.name + (r.kept ? ' · Kept' : '') }))]}
          onChange={(next) => {
            clear()
            setArea(next)
          }}
        />
      </div>
      {row &&
        (row.kept ? (
          <p className="text-xs">
            {row.name} is kept.{' '}
            <button className="underline" onClick={() => useStore.getState().setUi({ guideView: 'guide' })}>
              Rules for your agent
            </button>
          </p>
        ) : (
          <div className="grid gap-1 text-xs">
            <span>{row.name}</span>
            <Dropdown
              label={row.name}
              className="w-full"
              value={parts?.[row.area] ?? row.current ?? ''}
              options={[
                ...(!row.current ? [{ v: '', label: 'Your own' }] : []),
                ...row.options.map((p) => ({ v: p.id, label: p.name })),
              ]}
              onChange={(next) => setParts(next ? { [row.area]: next } : null)}
            />
          </div>
        ))}
      {enabled && online && (
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs">
            Say how it should change
            <input
              className={field}
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
