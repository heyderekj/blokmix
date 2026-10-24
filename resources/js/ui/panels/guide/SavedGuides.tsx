import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { TokenKey } from '@/core/types'
import { resolveGuide } from '@/core/guide'
import { deleteGuide, listGuides, saveGuide, type SavedGuide } from '@/lib/styleGuides'
import { useStore } from '@/state/store'
import { confirmAction } from '@/ui/shell/Confirm'

const SWATCH: TokenKey[] = ['color.bg', 'color.text', 'color.primary', 'color.accent']

/**
 * Your saved style guides (hosted only): save this mix's guide under a name, or swap one in. Swapping is one undo
 * step and copies the guide, so later edits here never change the saved one or other mixes.
 */
export function SavedGuides() {
  const [guides, setGuides] = useState<SavedGuide[] | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [used, setUsed] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    listGuides().then((g) => live && setGuides(g))
    return () => {
      live = false
    }
  }, [])

  const save = async () => {
    const n = name.trim()
    if (!n) return
    const g = await saveGuide(n, useStore.getState().guide)
    if (!g) return
    setGuides((all) => [g, ...(all ?? []).filter((x) => x.id !== g.id)])
    setNaming(false)
    setSaved(g.name)
    window.setTimeout(() => setSaved(null), 1800)
  }

  const use = (g: SavedGuide) => {
    useStore.getState().replaceGuide(g.guide)
    setUsed(g.id)
    window.setTimeout(() => setUsed(null), 1800)
  }

  const remove = async (g: SavedGuide) => {
    const ok = await confirmAction({ title: `Delete “${g.name}”?`, body: 'Mixes that use this style guide keep their own copy.', confirm: 'Delete guide' })
    if (!ok) return
    if (await deleteGuide(g.id)) setGuides((all) => (all ?? []).filter((x) => x.id !== g.id))
  }

  return (
    <div className="col-span-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-zinc-900">Saved style guides</span>
        {!naming && (
          <button
            type="button"
            onClick={() => {
              setName(useStore.getState().mixName || 'My style')
              setNaming(true)
            }}
            className="flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97]"
          >
            {saved ? <Check size={13} className="text-green-600" /> : <Plus size={13} />} {saved ? 'Saved' : 'Save this one'}
          </button>
        )}
      </div>
      {naming && (
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
            maxLength={80}
            aria-label="Name this style guide"
            className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-[12.5px] text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] outline-none focus:shadow-[0_0_0_2px_rgb(255_105_180/0.45)]"
          />
          <button type="submit" className="btn-lit h-8 cursor-pointer rounded-full px-3 text-[12px] font-semibold active:scale-[0.97]">
            Save
          </button>
          <button type="button" onClick={() => setNaming(false)} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700" aria-label="Cancel">
            <X size={13} />
          </button>
        </form>
      )}
      {guides === null ? null : guides.length ? (
        <ul className="mt-2 grid gap-1">
          {guides.map((g) => {
            const t = resolveGuide(g.guide).tokens
            return (
              <li key={g.id} className="group/saved flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => use(g)}
                  title={`Use “${g.name}” in this mix (undo with ⌘Z)`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.98]"
                >
                  <span className="flex h-5 w-10 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
                    {SWATCH.map((k) => (
                      <i key={k} className="flex-1" style={{ background: t[k] }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-800" style={{ fontFamily: t['font.display'] }}>
                    {g.name}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-zinc-500">{used === g.id ? 'In use' : 'Use'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(g)}
                  aria-label={`Delete ${g.name}`}
                  className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-950/5 hover:text-red-600 focus-visible:opacity-100 group-hover/saved:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <X size={12} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        !naming && <p className="mt-1 text-[12px] text-zinc-500">Save this guide to start new mixes from it, or to use it in another mix.</p>
      )}
    </div>
  )
}
