import { useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { runCommand } from '@/state/commands'

/**
 * "I need a [section | page] that [does what]": a sentence with one blank, typed in your own words. Enter (or the arrow)
 * reads it (the reader when suggestions are on, else keywords) and adds what it asks for, the same as `need_section` and
 * `need_page`. If it can't tell, it says so here and nothing changes.
 */
export function NeedLine({ what, at, onDone }: { what: 'section' | 'page'; at?: number; onDone: (result: unknown) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setNote(null)
    try {
      const input = what === 'section' ? { text, ...(at !== undefined ? { at: at + 1 } : {}) } : { text }
      const out = await runCommand(what === 'section' ? 'need_section' : 'need_page', input, 'you')
      onDone(out)
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="px-1 pb-1"
      onSubmit={(e) => {
        e.preventDefault()
        void go()
      }}
    >
      <label className="flex h-10 items-center gap-1.5 rounded-xl bg-white pl-3 pr-1 text-[13px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)] focus-within:shadow-[0_0_0_2px_rgb(0_0_0/0.5)]">
        <span className="shrink-0 font-medium text-zinc-500">I need a {what} that</span>
        <input
          data-need-line
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setNote(null)
          }}
          placeholder={what === 'section' ? 'shows our prices' : 'tells our story'}
          aria-label={`I need a ${what} that…`}
          className="min-w-0 flex-1 bg-transparent font-medium text-zinc-900 outline-none placeholder:text-zinc-300"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label={`Add the ${what}`}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg bg-zinc-900 text-white transition-[opacity,scale] active:scale-[0.97] disabled:cursor-default disabled:opacity-25"
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </label>
      {note && <p className="px-1 pt-1.5 text-[12px] leading-snug text-zinc-500">{note}</p>}
    </form>
  )
}
