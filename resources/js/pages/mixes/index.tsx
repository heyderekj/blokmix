import { useMemo, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import { ArrowRight, CloudUpload, Layers, Plus, Trash2, Upload } from 'lucide-react'
import { readMixFile } from '@/lib/mixFile'
import { pickFile } from '@/lib/pickFile'
import type { Site, Slot, VersionNode } from '@/core/types'
import { STORAGE_KEY } from '@/state/store'
import { api, type ServerMix } from '@/lib/mixSync'
import { Wordmark } from '@/ui/brand/Wordmark'

interface SavedMix {
  id: string
  name: string
  updated_at: string
  versions: number
  role: 'owner' | 'editor' | 'viewer'
}

const ROLE_NOTE = { owner: null, editor: 'you can edit', viewer: 'you can view' } as const

interface LocalMix {
  name: string
  pages: number
  versions: number
  state: Record<string, unknown>
}

/** The mix kept in this browser before mixes were saved here, if there is one. */
function readLocal(): LocalMix | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('mixtape:v1')
    const state = raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }).state : null
    if (!state) return null
    const site = state.site as Site | undefined
    return {
      name: String(state.mixName ?? state['tape' + 'Name'] ?? 'Untitled mix'),
      pages: site?.pages.length ?? ((state.slots as Slot[] | undefined)?.length ? 1 : 0),
      versions: Object.keys((state.versions as Record<string, VersionNode>) ?? {}).length,
      state,
    }
  } catch {
    return null
  }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

/** Every mix you can open: the ones saved here, and the one still kept only in this browser. */
export default function MixesIndex({ mixes }: { mixes: SavedMix[] }) {
  const user = usePage<{ auth: { user: { name: string } | null } }>().props.auth?.user
  const local = useMemo(readLocal, [])
  const [moving, setMoving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const mine = mixes.filter((m) => m.role === 'owner')
  const shared = mixes.filter((m) => m.role !== 'owner')

  /** Delete a mix you own, after asking. */
  const remove = async (m: SavedMix) => {
    if (!window.confirm(`Delete “${m.name}” and its versions for everyone it’s shared with? This can’t be undone.`)) return
    const res = await api('DELETE', `/api/mixes/${m.id}`)
    if (res.status === 204) router.reload({ only: ['mixes'] })
  }

  /** Copy the browser's mix to the server (the browser keeps its copy) and open it. */
  const saveLocal = async () => {
    if (!local) return
    setMoving(true)
    const { mixName, versions, ui: _ui, camera: _camera, ...data } = local.state
    void _ui
    void _camera
    const res = await api<ServerMix>('POST', '/api/mixes', { name: mixName ?? local.name, data, versions: versions ?? {} })
    setMoving(false)
    if (res.status === 201) router.visit(`/mixes/${res.body.id}`)
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <Head title="Mixes" />
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex-1 text-zinc-900">
          <Wordmark height={18} />
        </span>
        {user && (
          <>
            <span className="truncate text-[13px] text-zinc-500 max-sm:hidden">{user.name}</span>
            <button
              type="button"
              onClick={() => router.post('/logout')}
              className="h-9 cursor-pointer rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
            >
              Sign out
            </button>
          </>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight text-balance text-zinc-900">Your mixes</h1>
          <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={moving}
            onClick={() =>
              pickFile('.json,application/json', async (f) => {
                setProblem(null)
                try {
                  const file = await readMixFile(f)
                  setMoving(true)
                  const res = await api<ServerMix>('POST', '/api/mixes', { name: file.name, data: file.data, versions: file.versions })
                  setMoving(false)
                  if (res.status === 201) router.visit(`/mixes/${res.body.id}`)
                  else setProblem('Couldn’t save that mix. Try again.')
                } catch (e) {
                  setMoving(false)
                  setProblem(e instanceof Error ? e.message : String(e))
                }
              })
            }
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-zinc-700 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97] disabled:opacity-50"
          >
            <Upload size={15} /> Import
          </button>
          <button
            type="button"
            onClick={() => router.post('/mixes')}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[13.5px] font-semibold text-white transition-[scale,background-color] duration-150 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-800"
          >
            <Plus size={15} strokeWidth={2.4} /> New mix
          </button>
          </div>
        </div>

        {problem && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{problem}</p>}

        {mixes.length > 0 ? (
          <>
            <MixList title={null} mixes={mine} onDelete={remove} />
            {shared.length > 0 && <MixList title="Shared with you" mixes={shared} />}
          </>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-950/10 px-5 py-8 text-center text-[13.5px] text-zinc-500">
            No saved mixes yet. Start a new one{local ? ', or save the one in this browser below' : ''}.
          </p>
        )}

        {local && (
          <section className="mt-12">
            <h2 className="text-[12px] font-semibold text-zinc-400">Only in this browser</h2>
            <div className="mt-3 flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <MixCard href="/mixes/local" name={local.name} meta={[plural(local.pages, 'page'), plural(local.versions, 'version')]} quiet />
              </div>
              <button
                type="button"
                disabled={moving}
                onClick={saveLocal}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-white px-4 text-[13px] font-semibold text-zinc-800 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-[scale,background-color] duration-150 active:scale-[0.97] disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-50"
              >
                <CloudUpload size={15} /> {moving ? 'Saving…' : 'Save to your mixes'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function MixList({ title, mixes, onDelete }: { title: string | null; mixes: SavedMix[]; onDelete?: (m: SavedMix) => void }) {
  if (!mixes.length) return null
  return (
    <section className="mt-8">
      {title && <h2 className="mb-3 text-[12px] font-semibold text-zinc-400">{title}</h2>}
      <ul className="flex flex-col gap-2">
        {mixes.map((m) => (
          <li key={m.id} className="group/mix relative">
            <MixCard href={`/mixes/${m.id}`} name={m.name} meta={[plural(m.versions, 'version'), `edited ${ago(m.updated_at)}`, ...(ROLE_NOTE[m.role] ? [ROLE_NOTE[m.role]!] : [])]} />
            {onDelete && (
              <button
                type="button"
                title="Delete this mix"
                aria-label={`Delete ${m.name}`}
                onClick={() => onDelete(m)}
                className="absolute right-12 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-zinc-400 opacity-0 transition-[opacity,background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-red-600 focus-visible:opacity-100 active:scale-[0.97] group-hover/mix:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function MixCard({ href, name, meta, quiet }: { href: string; name: string; meta: string[]; quiet?: boolean }) {
  return (
    <Link
      href={href}
      className="group flex h-full cursor-pointer items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.12)] transition-[box-shadow,scale] duration-200 active:scale-[0.99] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_16px_32px_-12px_rgb(0_0_0/0.18)]"
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${quiet ? 'bg-zinc-100' : 'bg-key-soft'}`}>
        <Layers size={19} className={quiet ? 'text-zinc-500' : 'text-key-ink'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-zinc-900">{name}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-zinc-500">{meta.join(' · ')}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}
