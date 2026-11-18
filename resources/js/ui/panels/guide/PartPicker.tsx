import { useEffect, useMemo, useState } from 'react'
import { listParts } from '@/core/themeParts'
import { type StyleArea } from '@/core/contract'
import { swapThemeParts, type ThemeParts } from '@/core/skins'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'
import { pageOf } from '@/core/site'
import { SkinPreview } from '@/ui/skins/SkinPreview'

const control = 'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2'

export function PartPicker() {
  const guide = useStore((s) => s.guide)
  const contract = useStore((s) => s.contract)
  const content = useStore((s) => s.content)
  const site = useStore((s) => s.site)
  const pageId = useStore((s) => s.ui.pageId)
  const draft = useStore((s) => s.draftId)
  const [area, setArea] = useState<StyleArea | ''>('')
  const [parts, setParts] = useState<ThemeParts | null>(null)
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
  const clear = () => setParts(null)
  useEffect(clear, [guide, contract, content, draft])
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
