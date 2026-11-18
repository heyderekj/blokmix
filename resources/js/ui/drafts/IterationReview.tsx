import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, ChevronDown, Columns2, Plug, Send, Upload } from 'lucide-react'
import { useStore } from '@/state/store'
import { openMixId, api } from '@/lib/mixSync'
import { canEdit, useAccount } from '@/lib/account'
import { stageReturn, watchReturnInbox, decideReturn, reviewReturn, sendChanges, handoffPacket } from '@/lib/iterations'
import { changeLabel, type Bundle } from '@/core/iterations'
import { packetInputFor } from '@/lib/packet'
import { referenceHtml } from '@/core/export/reference-html'
import { pickFile } from '@/lib/pickFile'
import { canShip } from '@/state/shipping'
import type { VersionNode } from '@/core/types'
import { Dropdown } from '../controls/Dropdown'
import { VisualChangePreview } from './VisualChangePreview'
import { SharedRecipes } from './SharedRecipes'

export function useReturns(mix: string) {
  const editor = useAccount((s) => canEdit(s.role) && !s.archived)
  useEffect(() => {
    if (mix === 'local' || !editor) return
    let closed = false
    let cursor = 0
    let fetching = false
    const inbox = watchReturnInbox(mix)
    const pull = async () => {
      if (document.hidden || fetching) return
      fetching = true
      try {
        const res = await api<{ cursor: number; items: Bundle[] }>('GET', '/api/mixes/' + mix + '/returns?after=' + cursor)
        if (closed || mix !== openMixId() || res.status !== 200) return
        inbox.receive(res.body.items)
        cursor = res.body.cursor
      } finally {
        fetching = false
      }
    }
    const refresh = () => {
      void pull().catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      closed = true
      inbox.close()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [mix, editor])
}

export function IterationActions() {
  const [message, setMessage] = useState('')
  const [copy, setCopy] = useState('')
  const [sending, setSending] = useState(false)
  const editable = useAccount((s) => canEdit(s.role) && !s.archived)
  const sent = useStore((s) => (s.head ? s.versions[s.head] : undefined))
  function download() {
    if (!sent || !canShip('Downloading the handoff')) return
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(handoffPacket(sent))], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = sent.letter + '.handoff.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setMessage((e as Error).message)
      setCopy('')
    }
  }
  const hosted = openMixId() !== 'local'
  async function send() {
    if (!canShip('Sending your changes')) return
    setSending(true)
    try {
      const prompt = await sendChanges()
      setMessage(prompt)
      setCopy(prompt)
    } catch (e) {
      setMessage((e as Error).message)
      setCopy('')
    } finally {
      setSending(false)
    }
  }
  if (!editable) return null
  return (
    <>
      <details className="draft-tools">
        <summary>
          <Plug size={16} /> Agent tools <ChevronDown size={15} className="ml-auto" />
        </summary>
        <div className="grid gap-3 px-3 pb-3 text-sm">
          <div className="flex flex-wrap gap-2 [&>button]:min-h-9 [&>button]:rounded-lg [&>button]:border [&>button]:border-border [&>button]:px-3">
            <button disabled={sending} onClick={() => void send()} className="draft-primary">
              <Send size={14} /> {sending ? 'Preparing…' : 'Send my changes'}
            </button>
            <button
              onClick={() =>
                pickFile('.json', async (f) => {
                  try {
                    if (f.size > 60000) throw Error('Choose a return smaller than 60 KB.')
                    const letter = stageReturn(JSON.parse(await f.text()), true)
                    setCopy('')
                    setMessage('Returned to ' + letter)
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })
              }
            >
              <Upload size={14} className="mr-1 inline" /> Bring into Blokmix
            </button>
            {sent?.handoff && <button onClick={download}>Download handoff</button>}
            {hosted && (
              <button
                onClick={() => {
                  setCopy(location.origin + '/api/mcp')
                  setMessage(
                    'Add ' +
                      location.origin +
                      '/api/mcp as a connector in your AI app and sign in to Blokmix. Then choose Send my changes.',
                  )
                }}
              >
                Connect your AI
              </button>
            )}
          </div>
          {message && (
            <div role="status" className="break-words rounded bg-white p-2">
              {message}{' '}
              {copy && (
                <button
                  className="underline"
                  onClick={() => navigator.clipboard.writeText(copy).catch(() => setMessage(message + ' Select the text to copy it.'))}
                >
                  Copy
                </button>
              )}
            </div>
          )}
        </div>
      </details>
      {hosted && <SharedRecipes />}
    </>
  )
}

export function VersionPreview({ version, page }: { version: VersionNode; page?: string }) {
  const html = useMemo(
    () => referenceHtml(packetInputFor(useStore.getState(), { version, targets: [] }).page, { pageId: page }),
    [version, page],
  )
  return <iframe sandbox="" title={version.title} srcDoc={html} className="h-[42vh] w-full rounded border bg-white" />
}

export function Comparison({ left, right, close }: { left: VersionNode; right: VersionNode; close: () => void }) {
  const [path, setPath] = useState('/')
  const paths = [...new Set([...left.snapshot.site.pages, ...right.snapshot.site.pages].map((p) => p.path))]
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={close}
      aria-label="Version comparison"
      className="m-auto max-h-[92dvh] w-[96vw] max-w-[1600px] overflow-auto rounded-2xl bg-background p-4 text-foreground shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="draft-title mr-auto">Version comparison</h2>
        <Dropdown label="Compare page" value={path} options={paths.map((p) => ({ v: p, label: p }))} onChange={setPath} />
        <button className="draft-secondary" onClick={close}>
          Close
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[left, right].map((v, i) => {
          const page = v.snapshot.site.pages.find((p) => p.path === path)
          return (
            <div key={i}>
              <strong className="mb-2 block text-sm">
                {i === 1 && left.id === right.id ? 'Agent proposal' : v.letter} · {v.title}
              </strong>
              {page ? <VersionPreview version={v} page={page.id} /> : <p>Page absent</p>}
            </div>
          )
        })}
      </div>
    </dialog>,
    document.body,
  )
}

function valueLabel(value: unknown): string {
  if (value == null) return 'None'
  if (typeof value !== 'object') return String(value)
  const entry = value as { recipe?: { title?: string }; clipId?: string; alt?: string; asset?: string; style?: string }
  return entry.recipe?.title ?? entry.clipId ?? entry.alt ?? entry.asset ?? entry.style ?? 'Updated settings'
}

export function ReviewItem({ base, bundle }: { base: VersionNode; bundle: Bundle }) {
  const [preview, showPreview] = useState(false)
  const [workingPreview, showWorkingPreview] = useState(false)
  const [error, setError] = useState('')
  const [initial] = useState(() => reviewReturn(base, bundle))
  const [selected, select] = useState(() => new Set(initial.rows.flatMap((r, i) => (r.conflict || r.issue ? [] : [i]))))
  useStore((s) => s.site)
  useStore((s) => s.content)
  useStore((s) => s.contract)
  useStore((s) => s.guide)
  const editor = useAccount((s) => canEdit(s.role) && !s.archived)
  const review = reviewReturn(base, bundle, selected)
  const decide = (chosen: Set<number> | null) => {
    if (chosen && initial.workingKey !== review.workingKey) {
      setError('The draft changed during review. Reopen the review to compare again.')
      return
    }
    try {
      decideReturn(base.id, bundle.id, chosen)
      useStore.getState().showFlash(chosen ? 'Changes accepted' : 'Return dismissed', { undo: true })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div className="mt-5">
      {bundle.preview && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <button className="draft-secondary" aria-expanded={workingPreview} onClick={() => showWorkingPreview(!workingPreview)}>
            {workingPreview ? 'Hide' : 'Show'} working preview
          </button>
          <a className="draft-back" target="_blank" rel="noreferrer" href={bundle.preview}>
            Open preview <ArrowUpRight size={14} />
          </a>
          {workingPreview && (
            <iframe
              className="h-56 w-full rounded-xl border border-border"
              title="Returned implementation"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              src={bundle.preview}
            />
          )}
        </div>
      )}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="draft-subtitle !mb-0">Proposed changes</h3>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {selected.size} of {bundle.changes.length} selected
        </span>
      </div>
      <div className="draft-changes">
        {bundle.changes.map((c, i) => {
          const r = review.rows[i]
          const name = changeLabel(c).replace(/([a-z])([A-Z])/g, '$1 $2')
          return (
            <div key={i} className="draft-change-row">
              <label className="draft-change">
                <input
                  type="checkbox"
                  disabled={!!r.issue || !editor}
                  checked={selected.has(i)}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) next.add(i)
                    else next.delete(i)
                    select(next)
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[15px] leading-snug">{name.charAt(0).toUpperCase() + name.slice(1)}</strong>
                    {r.conflict && <span className="draft-conflict">Edited in your draft</span>}
                  </span>
                  {r.conflict ? (
                    <span className="draft-values">
                      <span>
                        <small>Your draft</small>
                        {valueLabel(r.here)}
                      </span>
                      <span>
                        <small>Agent proposal</small>
                        {valueLabel(r.incoming)}
                      </span>
                    </span>
                  ) : (
                    !r.issue &&
                    c.kind !== 'add' && <span className="mt-1 block text-sm text-muted-foreground">{valueLabel(r.incoming)}</span>
                  )}
                  {r.issue && <span className="block text-sm text-problem-ink">{r.issue}</span>}
                </span>
              </label>
              {c.kind !== 'word' && (
                <VisualChangePreview
                  change={c}
                  before={base}
                  after={{ ...base, snapshot: review.proposed }}
                  mode="proposal"
                  initiallyOpen={i === bundle.changes.findIndex((change) => change.kind !== 'word')}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editor && (
          <button className="draft-primary" disabled={!selected.size} onClick={() => decide(selected)}>
            <Check size={15} /> Use selected changes
          </button>
        )}
        <button className="draft-secondary" onClick={() => showPreview(true)}>
          <Columns2 size={15} /> Compare with {base.letter}
        </button>
        {editor && (
          <button className="draft-back ml-auto" onClick={() => decide(null)}>
            Dismiss
          </button>
        )}
      </div>
      {bundle.preview && (
        <button
          className="draft-back mt-3"
          onClick={() =>
            navigator.clipboard
              .writeText(
                'Make the component at ' +
                  bundle.preview +
                  ' editable in Blokmix. Submit a return for version ' +
                  base.id +
                  ' with a native layout and visual controls.',
              )
              .catch(() => setError('Clipboard unavailable.'))
          }
        >
          Ask AI to make this editable
        </button>
      )}
      {error && (
        <p className="mt-3 text-sm text-problem-ink" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <Comparison left={base} right={{ ...base, title: bundle.summary, snapshot: review.proposed }} close={() => showPreview(false)} />
      )}
    </div>
  )
}
