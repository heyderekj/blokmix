import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Check, Copy, EyeOff, ExternalLink, Globe, Link2, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '@/state/store'
import { useSave } from '@/lib/mixSync'
import { canEdit, useAccount } from '@/lib/account'
import { loadPublication, publishMix, unpublishMix, usePublication, type PublishStep } from '@/lib/publish'
import { localMixState, saveLocalMix } from '@/lib/localMix'
import { sourceVersion } from '@/lib/packet'
import { draftList } from '@/core/drafts'
import { router } from '@inertiajs/react'

/**
 * The mix on blok.page: an unlisted snapshot anyone with the link can open, at blok.page/<code>/<name>. Publishing again
 * updates the same address. Owners and editors publish; viewers see the link.
 */
export function PublishPanel() {
  const mixId = useSave((s) => s.mixId)
  const mixName = useStore((s) => s.mixName)
  const versions = useStore((s) => s.versions)
  const drafts = useStore((s) => s.drafts)
  const draftId = useStore((s) => s.draftId)
  const notes = useStore((s) => s.notes)
  const others = draftList(drafts).filter((d) => d.id !== draftId && d.body)
  const role = useAccount((s) => s.role)
  const paidPlan = useAccount((s) => s.paid)
  const { pub, loaded } = usePublication()
  const [name, setName] = useState('')
  const [source, setSource] = useState<string>('working')
  const [busy, setBusy] = useState<'publish' | 'unpublish' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState<PublishStep | null>(null)
  const editable = canEdit(role)

  const snapshots = useMemo(() => Object.values(versions).filter((v) => v.kind === 'snapshot').sort((a, b) => a.createdAt - b.createdAt), [versions])

  useEffect(() => {
    if (mixId === 'local') return
    void loadPublication().catch(() => undefined)
  }, [mixId])
  // Start from what's published (its name and source), or the mix's own name.
  useEffect(() => {
    setName(pub?.slug ?? slugify(mixName ?? ''))
    setSource(pub?.version && versions[pub.version] ? pub.version : 'working')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.code, loaded])

  if (mixId === 'local') return <SaveLocalFirst />

  const live = pub?.live ? pub : null
  // The address up to the name: blok.page/<code>/ (the code stays when you unpublish, so it shows then too).
  const prefix = pub ? pub.url.replace(/^https?:\/\//, '').replace(/[^/]+\/$/, '') : 'blok.page/'
  const run = async (what: 'publish' | 'unpublish') => {
    setBusy(what)
    setError(null)
    try {
      if (what === 'publish') {
        await publishMix({ version: source === 'working' ? null : sourceVersion({ versions, drafts, draftId, notes }, source), name, onStep: setStep })
        useStore.getState().showFlash(live ? 'Updated on blok.page' : 'Published to blok.page')
      } else {
        await unpublishMix()
        useStore.getState().showFlash('Unpublished')
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setBusy(null)
      setStep(null)
    }
  }
  const copy = async () => {
    if (!live) return
    try {
      await navigator.clipboard.writeText(live.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      useStore.getState().showFlash('Couldn’t copy. Select the address, then copy.')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2.5">
        <div className="flex min-h-5 items-center justify-between gap-3 px-0.5 text-[12px]">
          {live ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Live
              {live.publishedAt && <span className="font-normal text-zinc-500">· updated {timeAgo(live.publishedAt)}</span>}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Globe size={13} className="text-zinc-400" /> Its own page, at a link you can send
            </span>
          )}
          {live && (
            <span className="shrink-0 text-zinc-500">
              {live.pages.length === 1 ? 'One page' : `${live.pages.length} pages`}
              {live.version && versions[live.version] ? ` · ${versions[live.version].letter}` : ''}
            </span>
          )}
        </div>

        {/* The address is the field: the fixed part, then the name you can change. */}
        <div className="flex h-11 items-center rounded-xl bg-white pl-3 pr-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_2px_rgb(24_24_27)]">
          <span className="shrink-0 text-[14px] text-zinc-400">
            {prefix}
            {!pub && <span className="tracking-widest">····/</span>}
          </span>
          {editable ? (
            <input
              value={name}
              onChange={(e) => setName(slugify(e.target.value))}
              onBlur={() => setName((n) => n.replace(/^-+|-+$/g, ''))}
              maxLength={60}
              spellCheck={false}
              aria-label="Name in the address"
              placeholder="your-site"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-300"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-zinc-900">{live?.slug ?? ''}</span>
          )}
          {live && (
            <>
              <IconButton label={copied ? 'Copied' : 'Copy address'} onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </IconButton>
              <IconButton label="Open in a new tab" onClick={() => window.open(live.url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink size={16} />
              </IconButton>
            </>
          )}
        </div>

        {busy === 'publish' && step && <PublishProgress step={step} />}
        {editable && (snapshots.length > 0 || others.length > 0) && busy !== 'publish' && (
          <label className="flex items-center gap-2 px-0.5 text-[12.5px] text-zinc-500">
            From
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-8 min-w-0 flex-1 cursor-pointer rounded-lg bg-white px-2 text-[13px] text-zinc-900 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] outline-none"
            >
              <option value="working">{drafts[draftId]?.name ?? 'The mix'}, as it is now</option>
              {others.map((d) => (
                <option key={d.id} value={`draft:${d.id}`}>
                  {d.name}
                </option>
              ))}
              {snapshots.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.letter}
                  {v.title ? `: ${v.title}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="rounded-lg bg-problem/10 px-2.5 py-2 text-[12.5px] text-pretty text-problem">{error}</p>}
        {editable && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('publish')}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[13px] font-semibold text-white transition-[scale,opacity] duration-150 active:scale-[0.97] disabled:cursor-default disabled:opacity-60"
            >
              {busy === 'publish' && <Loader2 size={14} className="animate-spin" />}
              {busy === 'publish' ? 'Publishing…' : live ? 'Update' : 'Publish'}
            </button>
            {live && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('unpublish')}
                className="h-9 cursor-pointer rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97] disabled:opacity-60"
              >
                {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
              </button>
            )}
          </div>
        )}
      </section>
      {!editable && !live && <p className="px-1 text-[13px] text-zinc-500">This mix isn’t published. Its owner or an editor can publish it.</p>}

      <ul className="flex flex-col gap-2 border-t border-zinc-950/6 px-1 pt-3 text-[12.5px] text-zinc-600">
        <Fact icon={EyeOff}>Search engines won’t index it</Fact>
        <Fact icon={Link2}>Anyone with the link can see it</Fact>
        <Fact icon={RefreshCw}>Updating keeps the same address</Fact>
        {!paidPlan && <Fact icon={BadgeCheck}>On Free, a small “Made with Blokmix” badge</Fact>}
      </ul>
    </div>
  )
}

/** While the server saves (the long part), say what it's doing in turn, then wait on the last line. */
const SAVING = ['Putting each page in place', 'Hanging the pictures', 'Linking the pages together', 'Almost there']

/** What publishing is doing right now, with a bar that moves the whole way through. */
function PublishProgress({ step }: { step: PublishStep }) {
  const [since, setSince] = useState(() => Date.now())
  const [, setTick] = useState(0)
  useEffect(() => {
    setSince(Date.now())
  }, [step.stage])
  useEffect(() => {
    if (step.stage !== 'save') return
    const t = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [step.stage])
  const saving = (Date.now() - since) / 1000
  let label: string
  let done: number
  switch (step.stage) {
    case 'compose':
      label = 'Laying out your pages'
      done = 0.06
      break
    case 'posters':
      label = step.count === 1 ? 'Painting a still of the moving background' : `Painting stills of ${step.count} moving backgrounds`
      done = 0.14
      break
    case 'pack':
      label = `Packing ${step.pages === 1 ? 'one page' : `${step.pages} pages`}${step.files ? ` and ${step.files} ${step.files === 1 ? 'picture' : 'pictures'}` : ''}`
      done = 0.22
      break
    case 'upload':
      label = `Sending it to blok.page · ${Math.round(step.progress * 100)}% of ${megabytes(step.bytes)}`
      done = 0.25 + step.progress * 0.4
      break
    case 'save':
      label = SAVING[Math.min(SAVING.length - 1, Math.floor(saving / 4))]
      // Eases toward the end without claiming to get there: the server says when it has.
      done = 0.65 + 0.32 * (1 - Math.exp(-saving / 12))
      break
  }
  return (
    <div className="flex flex-col gap-1.5 px-0.5" role="status" aria-live="polite">
      <span key={label} className="flex items-center gap-2 text-[12.5px] text-zinc-600 motion-safe:animate-[sw-fade_200ms_cubic-bezier(0.23,1,0.32,1)]">
        <Loader2 size={13} className="shrink-0 animate-spin text-zinc-400" />
        {label}…
      </span>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-950/6">
        <div className="h-full rounded-full bg-zinc-900 transition-[width] duration-500 ease-out" style={{ width: `${Math.round(done * 100)}%` }} />
      </div>
    </div>
  )
}

function megabytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Fact({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={14} className="mt-[2px] shrink-0 text-zinc-400" />
      <span className="text-pretty">{children}</span>
    </li>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-zinc-600 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
    >
      {children}
    </button>
  )
}

/** What the address can hold: lowercase letters, digits and dashes, as the server makes it. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-')
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

/** A mix kept only in this browser can't be published until it's one of your mixes: one click does that. */
function SaveLocalFirst() {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const save = async () => {
    const state = localMixState()
    if (!state) return setProblem('There’s nothing saved in this browser yet. Make a change, then try again.')
    setBusy(true)
    setProblem(null)
    const out = await saveLocalMix(state)
    if ('short' in out) return router.visit(`/${out.short}`)
    setBusy(false)
    setProblem(out.problem)
  }
  return (
    <div className="grid gap-3 px-4 py-5">
      <p className="text-[13px] text-pretty text-zinc-600">This mix lives only in this browser. Save it to your mixes to publish it (this browser keeps its copy).</p>
      <button type="button" disabled={busy} onClick={save} className="btn-lit btn-ink flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold active:scale-[0.97]">
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save to your mixes
      </button>
      {problem && <p className="text-[12px] text-problem-ink">{problem}</p>}
    </div>
  )
}

