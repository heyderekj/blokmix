import { useMemo, useRef, useState } from 'react'
import { ChevronDown, FileUp, X } from 'lucide-react'
import type { Kind } from '@/core/types'
import { COPY_LIMIT, readCopyDocument } from '@/lib/copyDocument'
import { hearStart, type Heard } from '@/lib/startFromText'
import { HOVER, PRESS } from './parts'

/**
 * "I have words already": a drawer for the copy you already have, pasted or imported. Using it lays the page out from
 * your words (lines it isn't sure of wait in Content); it's never a step you have to pass through.
 */
export function CopyDrawer({ kind, using, onUse }: { kind: Kind; using: Heard | null; onUse: (heard: Heard | null) => void }) {
  const [open, setOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const over = pasted.length > COPY_LIMIT
  const words = useMemo(() => pasted.match(/[\p{L}\p{N}]+(?:['’–-][\p{L}\p{N}]+)*/gu)?.length ?? 0, [pasted])

  const importFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await readCopyDocument(file)
      const combined = pasted.trim() ? `${pasted.trimEnd()}\n\n${text}` : text
      if (combined.length > COPY_LIMIT) throw new Error('This would go over 100,000 characters. Paste a part of it, or a shorter document.')
      setPasted(combined)
      setNote(`Added ${file.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t read the file. Paste your words below.')
    } finally {
      setBusy(false)
    }
  }
  const use = async () => {
    if (!pasted.trim() || over || busy) return
    setBusy(true)
    setError('')
    try {
      const heard = await hearStart(pasted, kind, 'paste')
      if (!heard?.plan?.lines.length) throw new Error('Add some words that read as a page.')
      onUse(heard)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t lay out your words. They’re still here.')
    } finally {
      setBusy(false)
    }
  }

  if (using && !open)
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 px-3.5 py-2 text-[13px] text-[#6B5F68] shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
        <span className="font-semibold text-[#17121A]">Using your words</span> {using.lines ?? 0} lines laid out
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen(true)} className={`rounded-full px-2 py-1 font-medium ${HOVER}bg-zinc-950/5 ${PRESS}`}>Edit</button>
        <button type="button" onClick={() => onUse(null)} className={`rounded-full px-2 py-1 font-medium ${HOVER}bg-zinc-950/5 ${PRESS}`}>Stop using them</button>
      </p>
    )

  return (
    <div className="rounded-xl bg-white/80 shadow-[0_0_0_1px_rgb(23_18_26/0.06)]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-semibold ${HOVER}bg-white ${PRESS} active:scale-[0.99]`}>
        I have words already
        <span className="font-normal text-[#6B5F68]">Paste a page or import a document</span>
        <span className="flex-1" />
        {open ? <X size={15} className="text-[#6B5F68]" /> : <ChevronDown size={15} className="text-[#6B5F68]" />}
      </button>
      {open && (
        <div className="grid gap-2 px-3.5 pb-3.5 motion-safe:animate-pop">
          <textarea
            value={pasted}
            disabled={busy}
            onChange={(e) => (setPasted(e.target.value), setNote(''), setError(''))}
            placeholder="Paste a page, an outline, or your whole document…"
            aria-label="Your words"
            aria-invalid={over || undefined}
            className="thin-scroll min-h-40 w-full resize-y rounded-lg bg-white p-3 text-[14px] leading-relaxed shadow-[0_0_0_1px_rgb(23_18_26/0.1)] outline-none placeholder:text-zinc-500 focus:shadow-[0_0_0_2px_#FF69B4]"
          />
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B5F68]">
            <button type="button" disabled={busy} onClick={() => upload.current?.click()} className="btn-quiet inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold disabled:opacity-45">
              <FileUp size={14} /> {busy && !pasted ? 'Reading file…' : 'Import a file'}
            </button>
            <input ref={upload} type="file" hidden accept=".md,.markdown,.txt,.docx" onChange={(e) => (void importFile(e.target.files?.[0]), (e.target.value = ''))} />
            <span role="status" className="min-w-0 [overflow-wrap:anywhere]">{note || 'Markdown, plain text or Word'}</span>
            {words > 0 && <span className="tabular-nums">{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span>}
            <span className="flex-1" />
            <button type="button" disabled={busy || over || !pasted.trim()} onClick={() => void use()} className={`h-8 rounded-full bg-[#17121A] px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-40 ${PRESS}`}>
              {busy ? 'Reading your words…' : 'Use these words'}
            </button>
          </div>
          {(over || error) && <p role="alert" className="text-xs text-problem-ink">{over ? 'Use up to 100,000 characters.' : error}</p>}
        </div>
      )}
    </div>
  )
}
