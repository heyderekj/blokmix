import { useMemo } from 'react'
import { SECTION_TYPES, type SectionType } from '@/core/types'
import { FIELD_SCHEMA, TYPE_LABEL } from '@/core/content'
import { library } from '@/data/library'
import { useStore } from '@/state/store'
import { PanelSection } from './parts'

const human = (k: string) =>
  k
    .replace(/^([a-z]+)(\d)/, '$1 $2 ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()

export function CopyPanel() {
  const content = useStore((s) => s.content)
  const slots = useStore((s) => s.slots)
  const st = useStore.getState

  // Only the fields the clips on the tape actually use.
  const used = useMemo(() => {
    const out = new Map<SectionType, Set<string>>()
    for (const s of slots) {
      const clip = library.clips[s.clipId]
      const set = out.get(s.type) ?? new Set<string>()
      Object.keys(clip?.fields ?? {}).forEach((f) => set.add(f))
      out.set(s.type, set)
    }
    return out
  }, [slots])

  return (
    <div>
      <div className="px-4 pt-3.5 text-[12px] leading-relaxed text-zinc-500">
        Your copy replaces the source copy on every track where <strong className="font-semibold text-zinc-700">Source copy</strong> is off. Edits show up live.
      </div>
      <PanelSection title="Brand">
        <input value={content.brand} onChange={(e) => st().setBrand(e.target.value)} className={inputCls} />
      </PanelSection>
      {SECTION_TYPES.filter((t) => used.has(t)).map((t) => (
        <PanelSection key={t} title={TYPE_LABEL[t]}>
          <div className="space-y-2">
            {FIELD_SCHEMA[t]
              .filter((f) => used.get(t)!.has(f))
              .map((f) => {
                const v = content.fields[t]?.[f] ?? ''
                const long = v.length > 48 || /subhead|intro|Body|Quote/.test(f)
                return (
                  <label key={f} className="block">
                    <span className="mb-0.5 block text-[11px] font-medium text-zinc-400">{human(f)}</span>
                    {long ? (
                      <textarea value={v} rows={2} onChange={(e) => st().setField(t, f, e.target.value)} className={`${inputCls} h-auto py-1.5`} style={{ fieldSizing: 'content' } as React.CSSProperties} />
                    ) : (
                      <input value={v} placeholder="(source copy)" onChange={(e) => st().setField(t, f, e.target.value)} className={inputCls} />
                    )}
                  </label>
                )
              })}
          </div>
        </PanelSection>
      ))}
    </div>
  )
}

const inputCls =
  'block h-8 w-full resize-none rounded-lg border border-zinc-950/10 bg-white px-2.5 text-[12.5px] text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10'
