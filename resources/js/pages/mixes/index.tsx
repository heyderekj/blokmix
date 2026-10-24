import { useMemo, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import { CloudUpload, MessageSquare, Plus, Trash2, Upload, Users } from 'lucide-react'
import { readMixFile } from '@/lib/mixFile'
import { importClips } from '@/lib/userClips'
import { pickFile } from '@/lib/pickFile'
import type { GuideState, SectionType, Site, Slot, Status, VersionNode } from '@/core/types'
import { STORAGE_KEY } from '@/state/store'
import { api, type ServerMix } from '@/lib/mixSync'
import { Wordmark } from '@/ui/brand/Wordmark'
import { LiftedBlock, Slot as BlockSlot } from '@/ui/auth/AuthCard'
import { StatusRing } from '@/ui/frames/FrameHeader'
import { MixThumb } from '@/ui/mixes/MixThumb'

interface SavedMix {
  id: string
  /** Its address: blokmix.com/{short}. */
  short: string
  name: string
  updated_at: string
  versions: number
  role: 'owner' | 'editor' | 'viewer'
  /** Who owns it (for the ones shared with you). */
  owner: string | null
  pages: number
  /** The first page's sections, top to bottom, to draw it small. */
  sections: SectionType[]
  guide: GuideState | null
  heads: { letter: string; status: Status }[]
  /** Open marks (notes not yet resolved). */
  marks: number
}

const ROLE_NOTE = { owner: null, editor: 'you can edit', viewer: 'you can view' } as const

interface LocalMix {
  name: string
  pages: number
  versions: number
  sections: SectionType[]
  guide: GuideState | null
  state: Record<string, unknown>
}

/** The mix kept in this browser before mixes were saved here, if there is one. */
function readLocal(): LocalMix | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('mixtape:v1')
    const state = raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }).state : null
    if (!state) return null
    const site = state.site as Site | undefined
    const first = site?.pages[0]
    return {
      name: String(state.mixName ?? state['tape' + 'Name'] ?? 'Untitled mix'),
      pages: site?.pages.length ?? ((state.slots as Slot[] | undefined)?.length ? 1 : 0),
      versions: Object.keys((state.versions as Record<string, VersionNode>) ?? {}).length,
      sections: [
        ...(first?.show.nav && site?.shared.nav ? [site.shared.nav.type] : []),
        ...(first?.slots ?? (state.slots as Slot[] | undefined) ?? []).map((sl) => sl.type),
        ...(first?.show.footer && site?.shared.footer ? [site.shared.footer.type] : []),
      ],
      guide: (state.guide as GuideState | undefined) ?? null,
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

/**
 * Every mix you can open, as a gallery of small boards on the brand's dotted paper: each card draws its first page in
 * its own style guide, with its versions' status rings. The first tile starts a new mix; the ones shared with you and
 * the one kept only in this browser follow.
 */
export default function MixesIndex({ mixes }: { mixes: SavedMix[] }) {
  const auth = usePage<{ auth: { user: { name: string } | null; owner?: boolean } }>().props.auth
  const user = auth?.user
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
    const res = await api<ServerMix & { short: string }>('POST', '/api/mixes', { name: mixName ?? local.name, data, versions: versions ?? {} })
    setMoving(false)
    if (res.status === 201) router.visit(`/${res.body.short}`)
  }

  const importFile = () =>
    pickFile('.json,application/json', async (f) => {
      setProblem(null)
      try {
        const file = await readMixFile(f)
        setMoving(true)
        // Its captured clips join your account first, so the mix opens with every section.
        await importClips(file.clips ?? [])
        const res = await api<ServerMix & { short: string }>('POST', '/api/mixes', { name: file.name, data: file.data, versions: file.versions })
        setMoving(false)
        if (res.status === 201) router.visit(`/${res.body.short}`)
        else setProblem('Couldn’t save that mix. Try again.')
      } catch (e) {
        setMoving(false)
        setProblem(e instanceof Error ? e.message : String(e))
      }
    })

  return (
    <div className="min-h-full" style={{ background: '#FBF8F9', backgroundImage: 'radial-gradient(#DDD2D9 1.2px, transparent 1.3px)', backgroundSize: '24px 24px' }}>
      <Head title="Mixes" />
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex-1 text-[#17121A]">
          <Wordmark height={18} />
        </span>
        {user && (
          <>
            {auth.owner && (
              <Link href="/waitlist" className={QUIET}>
                <Users size={15} /> Waitlist
              </Link>
            )}
            <span className="truncate text-[13px] text-zinc-500 max-sm:hidden">{user.name}</span>
            <button type="button" onClick={() => router.post('/logout')} className={QUIET}>
              Sign out
            </button>
          </>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[30px] font-bold tracking-tight text-[#17121A]">Your mixes</h1>
          <button type="button" disabled={moving} onClick={importFile} className={QUIET + ' h-10 px-4 text-[13.5px] font-semibold'}>
            <Upload size={15} /> Import a mix file
          </button>
        </div>

        {problem && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{problem}</p>}

        <ul className={GRID}>
          <li className="animate-rise">
            <NewMix />
          </li>
          {mine.map((m, i) => (
            <li key={m.id} className="animate-rise" style={{ animationDelay: `${(i + 1) * 40}ms` }}>
              <MixCard mix={m} onDelete={() => remove(m)} />
            </li>
          ))}
        </ul>

        {shared.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[13px] font-semibold text-[#6B5F68]">Shared with you</h2>
            <ul className={GRID + ' !mt-4'}>
              {shared.map((m) => (
                <li key={m.id}>
                  <MixCard mix={m} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {local && (
          <section className="mt-14">
            <h2 className="text-[13px] font-semibold text-[#6B5F68]">Only in this browser</h2>
            <ul className={GRID + ' !mt-4'}>
              <li>
                <Card href="/local" name={local.name} sections={local.sections} guide={local.guide} meta={[plural(local.pages, 'page'), plural(local.versions, 'version')]} quiet>
                  <button
                    type="button"
                    disabled={moving}
                    onClick={() => void saveLocal()}
                    className="btn-quiet flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    <CloudUpload size={14} /> {moving ? 'Saving…' : 'Save to your mixes'}
                  </button>
                </Card>
              </li>
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

const QUIET =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50'
const GRID = 'mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'
const CARD =
  'group/card relative flex h-full flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_24px_48px_-28px_rgb(23_18_26/0.3)] transition-[translate,box-shadow,scale] duration-200 active:scale-[0.99] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(23_18_26/0.1),0_30px_56px_-26px_rgb(23_18_26/0.4)]'

/** The first tile: a slot in the paper with the pink block lifted out of it, like the sign-in page. */
function NewMix() {
  return (
    <button
      type="button"
      onClick={() => router.post('/mixes')}
      className="group/new relative grid h-full min-h-[260px] w-full cursor-pointer place-items-center rounded-[22px] border-2 border-dashed border-[#E4D9DF] transition-[border-color,background-color,scale] duration-200 active:scale-[0.99] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#FF69B4]/60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/60"
    >
      <span className="grid justify-items-center gap-4">
        <span className="relative block size-[64px]">
          <BlockSlot size={64} className="left-0 top-0" />
          <LiftedBlock size={64} className="left-[6px] top-[-14px] transition-transform duration-300 group-hover/new:-translate-y-1 group-hover/new:rotate-[-4deg]" />
        </span>
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#17121A]">
          <Plus size={16} strokeWidth={2.4} /> New mix
        </span>
      </span>
    </button>
  )
}

function MixCard({ mix: m, onDelete }: { mix: SavedMix; onDelete?: () => void }) {
  const meta = [plural(m.versions, 'version'), ...(m.pages > 1 ? [plural(m.pages, 'page')] : []), `edited ${ago(m.updated_at)}`]
  if (m.role !== 'owner') meta.splice(0, 0, `Shared by ${m.owner ?? 'someone'}`, ROLE_NOTE[m.role]!)
  return (
    <Card href={`/${m.short}`} name={m.name} sections={m.sections} guide={m.guide} meta={m.role === 'owner' ? meta : meta.slice(0, 2)}>
      {m.heads.length > 0 && (
        <span className="flex -space-x-1.5">
          {m.heads.slice(0, 6).map((h) => (
            <span key={h.letter} className="rounded-full ring-2 ring-white">
              <StatusRing letter={h.letter} status={h.status} small />
            </span>
          ))}
          {m.heads.length > 6 && <span className="grid size-7 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-500 ring-2 ring-white">+{m.heads.length - 6}</span>}
        </span>
      )}
      {m.marks > 0 && (
        <span className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-[#6B5F68]" title={`${plural(m.marks, 'open mark')}`}>
          <MessageSquare size={13} /> {m.marks}
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          title="Delete this mix"
          aria-label={`Delete ${m.name}`}
          onClick={onDelete}
          className="!absolute right-3 top-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 text-zinc-500 opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] backdrop-blur transition-[opacity,color,scale] duration-150 hover:text-red-600 focus-visible:opacity-100 active:scale-[0.97] group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      )}
    </Card>
  )
}

/** A mix as a card: its page drawn small on a soft tile, then its name, a quiet line of facts and whatever it adds. */
function Card({ href, name, sections, guide, meta, quiet, children }: { href: string; name: string; sections: SectionType[]; guide: GuideState | null; meta: string[]; quiet?: boolean; children?: React.ReactNode }) {
  return (
    <div className={CARD}>
      {/* The whole card opens the mix; its buttons sit above this link. */}
      <Link href={href} aria-label={`Open ${name}`} className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF69B4]" />
      <span className={`pointer-events-none block p-3 pb-0 ${quiet ? 'opacity-80' : ''}`}>
        <span className="block aspect-[16/10] overflow-hidden rounded-[14px] bg-[#F3EDF0] p-3 pb-0">
          <span className="block size-full overflow-hidden rounded-t-[8px] shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_10px_24px_-14px_rgb(23_18_26/0.35)]">
            <MixThumb sections={sections} guide={guide} />
          </span>
        </span>
      </span>
      <span className="pointer-events-none flex flex-1 flex-col gap-3 p-4 pt-3.5 [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10">
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-semibold text-[#17121A]">{name}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-[#6B5F68]">{meta.join(' · ')}</span>
        </span>
        {children && <span className="mt-auto flex min-h-7 items-center gap-2">{children}</span>}
      </span>
    </div>
  )
}
