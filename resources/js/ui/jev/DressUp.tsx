import { useEffect, useState } from 'react'
import { Lock, Wand2 } from 'lucide-react'
import type { Slot } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { backdropPlace, isBackdropId, treatmentInfo, type TreatmentValue } from '@/core/treatments'
import { jevOn } from '@/lib/jev'
import { dressSection, type DressIdea } from '@/state/jevDress'
import { useJevTools } from '@/state/jevSay'
import { runCommand } from '@/state/commands'
import { useStore } from '@/state/store'
import { useBlockPreview } from '../blocks/preview'
import { noteWants } from '@/lib/jevWants'

/** A backdrop idea as the value the preview draws. */
function backdropValue(idea: DressIdea): TreatmentValue | null {
  if (idea.command !== 'set_section_backdrop') return null
  const id = String(idea.input.backdrop)
  if (!isBackdropId(id)) return null
  const t = treatmentInfo('backdrop', id)
  const p = t?.presets.find((x) => x.id === idea.input.preset) ?? t?.presets[0]
  return t ? { id, seed: 1, preset: p?.id, params: { ...p?.values, ...backdropPlace(id) } } : null
}

/**
 * Dress it up: backgrounds (and a product screen for an empty picture) that suit this section's words and the
 * skin's mood, from Blokmix's own treatments. Hover to see one on the page; a click puts it on.
 */
export function DressUp({ slot }: { slot: Slot }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ideas, setIdeas] = useState<DressIdea[] | null>(null)
  const [feel, setFeel] = useState('')
  const asked = useJevTools((s) => (s.open === 'dress' && (!s.slotId || s.slotId === slot.id) ? (s.text ?? '') : null))
  const show = useBlockPreview((s) => s.showBackdrop)

  useEffect(() => {
    let live = true
    jevOn().then((v) => live && setOn(v))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => setIdeas(null), [slot.id])

  const find = async (f?: string) => {
    setBusy(true)
    const r = await dressSection(slot.id, f)
    setBusy(false)
    setIdeas(r?.ideas ?? [])
    if (r && !r.ideas.length && f) void noteWants([f], 'dress', slot.type)
  }

  // Asked in Say it ("make the hero pop"): look right away, with those words as the feel.
  useEffect(() => {
    if (asked === null || !on) return
    setFeel(asked)
    useJevTools.setState({ open: null, slotId: undefined, text: undefined })
    void find(asked || undefined)
  }, [asked, on])

  if (!on) return null
  return (
    <div className="mb-2.5 rounded-xl bg-zinc-950/[0.035] p-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void find(feel.trim() || undefined)
        }}
        className="flex items-center gap-1.5"
      >
        <Wand2 size={13} className={`shrink-0 text-zinc-500 ${busy ? 'animate-pulse' : ''}`} />
        <input
          value={feel}
          onChange={(e) => setFeel(e.target.value)}
          placeholder="Dress it up: more premium, playful…"
          aria-label="How should it feel"
          className="h-7 min-w-0 flex-1 bg-transparent text-[12px] text-zinc-900 outline-none placeholder:text-zinc-500"
        />
        <button type="submit" disabled={busy} className="h-7 cursor-pointer rounded-full bg-zinc-900 px-2.5 text-[11.5px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-40">
          {busy ? 'Looking…' : ideas ? 'Again' : 'Show me'}
        </button>
      </form>
      {ideas && (
        <div className="mt-1.5 grid gap-1" onMouseLeave={() => show(null)}>
          {ideas.length === 0 && <p className="px-1 text-[11.5px] text-zinc-500">Nothing stood out. Try a few words about the feel.</p>}
          {ideas.map((idea) => (
            <button
              key={idea.label}
              type="button"
              onMouseEnter={() => {
                const v = backdropValue(idea)
                if (v) show({ slotId: slot.id, value: v })
              }}
              onClick={() => {
                show(null)
                runCommand(idea.command, idea.input, 'you')
                if (!idea.locked) useStore.getState().showFlash(`${idea.label} on ${TYPE_LABEL[slot.type]}`, { undo: true })
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-left text-[12px] text-zinc-800 ring-1 ring-zinc-950/10 transition hover:ring-zinc-400 active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1 truncate">{idea.label}</span>
              {idea.locked && <Lock size={11} className="shrink-0 text-zinc-400" aria-label="Needs a mix pack" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
