import { useEffect, useMemo, useRef, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import { Archive, ArchiveRestore, ArrowLeft, Copy, CloudUpload, Library, Lock, MessageSquare, Palette, Pencil, Plus, Search, Trash2, Upload, Users, X } from 'lucide-react'
import { readMixFile } from '@/lib/mixFile'
import { importClips } from '@/lib/userClips'
import { pickFile } from '@/lib/pickFile'
import type { GuideState, SectionType, Site, Slot, Status, VersionNode } from '@/core/types'
import { STORAGE_KEY } from '@/state/store'
import { api, type ServerMix } from '@/lib/mixSync'
import { confirmAction } from '@/ui/shell/Confirm'
import { listGuides, type SavedGuide } from '@/lib/styleGuides'
import { Wordmark } from '@/ui/brand/Wordmark'
import { LiftedBlock, Slot as BlockSlot } from '@/ui/auth/AuthCard'
import { StatusRing } from '@/ui/frames/FrameHeader'
import { MixThumb } from '@/ui/mixes/MixThumb'
import { resolveGuide } from '@/core/guide'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { library, starters } from '@/data/library'
import { buildStarter, type Starter } from '@/core/starters'
import { starterOpen } from '@/core/library'
import { listSites, loadSite, mixFromSitePage, planClip, type LibraryPage, type LibrarySite, type LibrarySiteSummary } from '@/lib/siteLibrary'
import { StartFlow } from '@/ui/start/StartFlow'
import { mixFromStart } from '@/lib/start'

interface SavedMix {
  id: string
  /** Its address: blokmix.com/{short}. */
  short: string
  name: string
  created_at: string
  updated_at: string
  versions: number
  role: 'owner' | 'editor' | 'viewer'
  /** The first page's main heading, set in the mix's display font on its card. */
  heading: string | null
  /** Who owns it (for the ones shared with you). */
  owner: string | null
  pages: number
  /** The first page's sections, top to bottom, to draw it small. */
  sections: SectionType[]
  guide: GuideState | null
  heads: { letter: string; status: Status }[]
  /** Open marks (notes not yet resolved). */
  marks: number
  /** Archived: kept, read-only, and not one of your open mixes. */
  archived: boolean
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
/**
 * Your plan (config/blokmix.php `plans`): what it includes (null is unlimited; mixes are how many can be open at once)
 * and what you've used, the mix packs you've bought, and whether one can be bought here now.
 */
interface Plan {
  name: 'free' | 'paid'
  limits: { mixes: number | null; clips: number | null; upload_mb: number | null }
  usage: { mixes: number; clips: number; uploads: number }
  packs: number
  pack: { mixes: number; price_usd: number }
  buy: boolean
  receipts: boolean
}
/** Why there's no room for another open mix (the server says the same). */
const mixFull = (p: Plan) =>
  p.name === 'free'
    ? `Free has one mix. Archive it, or get a mix pack: ${p.pack.mixes} mixes for $${p.pack.price_usd}, once.`
    : `Your mix packs hold ${p.limits.mixes} mixes. Archive one, or add a pack: ${p.pack.mixes} more for $${p.pack.price_usd}.`
const buyPack = () => router.post('/api/billing/checkout')

export default function MixesIndex({ mixes }: { mixes: SavedMix[] }) {
  const auth = usePage<{ auth: { user: { name: string } | null; owner?: boolean; plan?: Plan | null } }>().props.auth
  const user = auth?.user
  const plan = auth?.plan ?? null
  // Starting, copying, importing or saving a mix makes one you own; Free has room for one, each pack three more.
  const full = !!plan && plan.limits.mixes !== null && plan.usage.mixes >= plan.limits.mixes
  const MIX_FULL = plan ? mixFull(plan) : ''
  // What a new mix can start from follows your plan (the guided start, starters, sites).
  library.paid = plan?.name !== 'free'
  const bought = useBought(plan)
  const local = useMemo(readLocal, [])
  const [moving, setMoving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('edited')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...mixes].filter((m) => !q || m.name.toLowerCase().includes(q)).sort(SORTS[sort].by)
  }, [mixes, query, sort])
  const mine = shown.filter((m) => m.role === 'owner' && !m.archived)
  const archived = shown.filter((m) => m.role === 'owner' && m.archived)
  const shared = shown.filter((m) => m.role !== 'owner')
  useDisplayFonts(mixes)

  /** A copy you own, with its versions and uploads; it shows up first in the gallery. */
  const duplicate = async (m: SavedMix) => {
    setProblem(null)
    if (full) return setProblem(MIX_FULL)
    const res = await api<{ message?: string }>('POST', `/api/mixes/${m.id}/duplicate`)
    if (res.status === 201) router.reload({ only: ['mixes', 'auth'] })
    else setProblem(res.body?.message ?? 'Couldn’t copy that mix. Try again.')
  }

  /** Archive a mix you own (it frees one of your mixes), or bring one back when there's room. */
  const archive = async (m: SavedMix, on: boolean) => {
    setProblem(null)
    if (!on && full) return setProblem(MIX_FULL)
    const res = await api<{ message?: string }>('POST', `/api/mixes/${m.id}/${on ? 'archive' : 'unarchive'}`)
    if (res.status === 200) router.reload({ only: ['mixes', 'auth'] })
    else setProblem(res.body?.message ?? 'Couldn’t do that. Try again.')
  }

  /** Delete a mix you own, after asking. */
  const remove = async (m: SavedMix) => {
    const ok = await confirmAction({
      title: `Delete “${m.name}”?`,
      body: 'Its versions and uploads go too, for everyone it’s shared with. This can’t be undone.',
      confirm: 'Delete mix',
    })
    if (!ok) return
    const res = await api('DELETE', `/api/mixes/${m.id}`)
    if (res.status === 204) router.reload({ only: ['mixes', 'auth'] })
  }

  /** Copy the browser's mix to the server (the browser keeps its copy) and open it. */
  const saveLocal = async () => {
    if (!local) return
    setProblem(null)
    if (full) return setProblem(MIX_FULL)
    setMoving(true)
    const { mixName, versions, ui: _ui, camera: _camera, ...data } = local.state
    void _ui
    void _camera
    const res = await api<ServerMix & { short: string; message?: string }>('POST', '/api/mixes', { name: mixName ?? local.name, data, versions: versions ?? {} })
    setMoving(false)
    if (res.status === 201) router.visit(`/${res.body.short}`)
    else setProblem(res.body?.message ?? 'Couldn’t save that mix. Try again.')
  }

  // New mix opens the guided start; the start you pick becomes the mix, the others its versions.
  const [guided, setGuided] = useState(false)
  const startGuided = () => (full ? setProblem(MIX_FULL) : (setProblem(null), setGuided(true)))
  const saveStart: Parameters<typeof StartFlow>[0]['onDone'] = async (input, starts, chosen) => {
    const { mixName, versions, ...data } = mixFromStart(input, starts, chosen)
    setMoving(true)
    const res = await api<ServerMix & { short: string; message?: string }>('POST', '/api/mixes', { name: mixName, data, versions })
    if (res.status === 201) return router.visit(`/${res.body.short}`)
    setMoving(false)
    setGuided(false)
    setProblem(res.body?.message ?? 'Couldn’t save that mix. Try again.')
  }

  const importFile = () =>
    pickFile('.json,application/json', async (f) => {
      setProblem(null)
      // Checked first, so a refused import doesn't leave its clips behind.
      if (full) return setProblem(MIX_FULL)
      try {
        const file = await readMixFile(f)
        setMoving(true)
        // Its captured clips join your account first, so the mix opens with every section.
        await importClips(file.clips ?? [])
        const res = await api<ServerMix & { short: string; message?: string }>('POST', '/api/mixes', { name: file.name, data: file.data, versions: file.versions })
        setMoving(false)
        if (res.status === 201) router.visit(`/${res.body.short}`)
        else setProblem(res.body?.message ?? 'Couldn’t save that mix. Try again.')
      } catch (e) {
        setMoving(false)
        setProblem(e instanceof Error ? e.message : String(e))
      }
    })

  return (
    <div className="min-h-full" style={{ background: '#FBF8F9', backgroundImage: 'radial-gradient(#DDD2D9 1.2px, transparent 1.3px)', backgroundSize: '24px 24px' }}>
      <Head title="Mixes" />
      {guided && (
        <StartFlow
          busy={moving}
          onClose={() => setGuided(false)}
          onBlank={() => router.post('/mixes', {}, { onError: (e) => (setGuided(false), e.mix && setProblem(e.mix)) })}
          onDone={saveStart}
        />
      )}
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
            {auth.owner && (
              <Link href="/library/admin" className={QUIET}>
                <Library size={15} /> Library
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
          <div>
            <h1 className="text-[30px] font-bold tracking-tight text-[#17121A]">Your mixes</h1>
            {plan && <PlanLine plan={plan} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 w-56 items-center gap-2 rounded-full bg-white px-3.5 shadow-[0_0_0_1px_rgb(23_18_26/0.08)] focus-within:ring-2 focus-within:ring-[#FF69B4]/45 max-sm:w-full">
              <Search size={15} className="shrink-0 text-zinc-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a mix"
                aria-label="Find a mix"
                className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </label>
            <label className="relative flex h-10 items-center rounded-full bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08)] focus-within:ring-2 focus-within:ring-[#FF69B4]/45">
              <span className="sr-only">Sort mixes</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-4 pr-8 text-[13.5px] font-medium text-zinc-700 outline-none"
              >
                {(Object.keys(SORTS) as Sort[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k].label}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 size-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </label>
            <button type="button" disabled={moving} onClick={importFile} className={QUIET + ' h-10 px-4 text-[13.5px] font-semibold'}>
              <Upload size={15} /> Import
            </button>
          </div>
        </div>

        {bought && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
            {bought === 'arrived' ? `Thank you! Your mix pack is here: ${plan?.limits.mixes ?? 'more'} mixes, and every layout and control.` : 'Thank you! Your mix pack shows up here as soon as Polar confirms it.'}
          </p>
        )}
        {problem && (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
            {problem}
            {problem === MIX_FULL && plan?.buy && (
              <button type="button" onClick={buyPack} className="cursor-pointer font-semibold underline underline-offset-2">
                Get a mix pack
              </button>
            )}
          </p>
        )}

        {query && !shown.length && <p className="mt-8 text-[14px] text-[#6B5F68]">No mixes match “{query}”.</p>}

        <ul className={GRID}>
          {!query && (
            <li className="animate-rise">
              <NewMix mixes={mine} full={full ? MIX_FULL : null} onRefused={setProblem} onGuided={startGuided} />
            </li>
          )}
          {mine.map((m, i) => (
            <li key={m.id} className="animate-rise" style={{ animationDelay: `${(i + 1) * 40}ms` }}>
              <MixCard mix={m} onDelete={() => remove(m)} onDuplicate={() => duplicate(m)} onArchive={() => archive(m, true)} />
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[13px] font-semibold text-[#6B5F68]">Archived</h2>
            <p className="mt-1 text-[12.5px] text-[#6B5F68]">Kept as they are, read-only, and not counted. Bring one back when you have room.</p>
            <ul className={GRID + ' !mt-4'}>
              {archived.map((m) => (
                <li key={m.id}>
                  <MixCard mix={m} onDelete={() => remove(m)} onDuplicate={() => duplicate(m)} onArchive={() => archive(m, false)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {shared.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[13px] font-semibold text-[#6B5F68]">Shared with you</h2>
            <ul className={GRID + ' !mt-4'}>
              {shared.map((m) => (
                <li key={m.id}>
                  <MixCard mix={m} onDuplicate={() => duplicate(m)} />
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
                <Card href="/local" name={local.name} sections={local.sections} guide={local.guide} versions={local.versions} meta={[plural(local.pages, 'page'), plural(local.versions, 'version')]} quiet>
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

type Sort = 'edited' | 'created' | 'name'
const SORTS: Record<Sort, { label: string; by: (a: SavedMix, b: SavedMix) => number }> = {
  edited: { label: 'Last edited', by: (a, b) => b.updated_at.localeCompare(a.updated_at) },
  created: { label: 'Newest', by: (a, b) => b.created_at.localeCompare(a.created_at) },
  name: { label: 'Name', by: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) },
}

/** Load each mix's display font (from the font library), once, so its card's heading is set in it. */
function useDisplayFonts(mixes: SavedMix[]) {
  const hrefs = useMemo(() => {
    const out = new Set<string>()
    for (const m of mixes) {
      const d = m.guide ? resolveGuide(m.guide).tokens['font.display'] : undefined
      if (!d || !m.heading) continue
      const tokens = { 'font.display': d, 'font.body': d, 'font.mono': d } as Parameters<typeof fontsForTokens>[0]
      for (const h of fontHrefs(fontsForTokens(tokens, []))) out.add(h)
    }
    return [...out]
  }, [mixes])
  useEffect(() => {
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [hrefs])
}

const QUIET =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50'
const GRID = 'mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'
const CARD_BUTTON =
  'grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 text-zinc-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] backdrop-blur transition-[color,scale] duration-150 active:scale-[0.97]'
const CARD =
  'group/card relative flex h-full flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_24px_48px_-28px_rgb(23_18_26/0.3)] transition-[translate,box-shadow,scale] duration-200 active:scale-[0.99] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(23_18_26/0.1),0_30px_56px_-26px_rgb(23_18_26/0.4)]'

/** The first tile: a slot in the paper with the pink block lifted out of it, like the sign-in page. It starts a mix in the
 * neutral style; "Start from…" starts one from a starter mix (its pages and sample style guide), a saved guide or another
 * mix's (the new mix keeps its own copy). */
function NewMix({ mixes, full, onRefused, onGuided }: { mixes: SavedMix[]; full: string | null; onRefused: (why: string) => void; onGuided: () => void }) {
  const [picking, setPicking] = useState(false)
  const [saved, setSaved] = useState<SavedGuide[] | null>(null)
  useEffect(() => {
    if (picking && saved === null) void listGuides().then(setSaved)
  }, [picking, saved])
  const start = (guide?: GuideState) => {
    if (full) return onRefused(full)
    router.post('/mixes', guide ? { guide: guide as unknown as Record<string, string> } : {}, { onError: (e) => e.mix && onRefused(e.mix) })
  }
  const startStarter = (starter: Starter) => {
    if (full) return onRefused(full)
    if (!starterOpen(library, starter)) return onRefused(`“${starter.name}” uses layouts in a mix pack. Free starts from the starters without a lock, or the guided start.`)
    const { mixName, site, guide } = buildStarter(library, starter)
    router.post('/mixes', { name: mixName, site, guide } as unknown as Record<string, string>, { onError: (e) => e.mix && onRefused(e.mix) })
  }
  const startSite = (site: LibrarySite, page: LibraryPage) => {
    if (full) return onRefused(full)
    const { mixName, site: built, guide } = mixFromSitePage(library, site, page)
    if (!built.pages[0].slots.length && !built.shared.nav && !built.shared.footer) return onRefused(`${site.name} ${page.path} has no sections with a layout yet`)
    router.post('/mixes', { name: mixName, site: built, guide } as unknown as Record<string, string>, { onError: (e) => e.mix && onRefused(e.mix) })
  }
  const styled = mixes.filter((m) => m.guide && Object.keys(m.guide.base ?? {}).length)

  if (picking)
    return (
      <div className="relative flex h-full min-h-[260px] w-full flex-col rounded-[22px] bg-white p-3 shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_24px_48px_-28px_rgb(23_18_26/0.3)]">
        <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
          <span className="text-[14px] font-semibold text-[#17121A]">Start from</span>
          <button type="button" onClick={() => setPicking(false)} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700">
            <X size={14} />
          </button>
        </div>
        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <SitePicker onPick={startSite} />
          {starters.length > 0 && <PickHeading>Starter mixes</PickHeading>}
          {starters.map((s) => (
            <StarterRow key={s.id} starter={s} onPick={() => startStarter(s)} />
          ))}
          <PickHeading>Style guides</PickHeading>
          <GuideRow name="Neutral" note="Blokmix’s plain starting style" onPick={() => start()} />
          {saved === null ? (
            <li className="px-2 py-2 text-[12px] text-zinc-400">Loading your style guides…</li>
          ) : (
            saved.map((g) => <GuideRow key={`s${g.id}`} name={g.name} note="Saved style guide" guide={g.guide} onPick={() => start(g.guide)} />)
          )}
          {styled.map((m) => (
            <GuideRow key={m.id} name={m.name} note="This mix’s style guide" guide={m.guide!} onPick={() => start(m.guide!)} />
          ))}
        </ul>
      </div>
    )

  return (
    <div className="group/new relative grid h-full min-h-[260px] w-full place-items-center rounded-[22px] border-2 border-dashed border-[#E4D9DF] transition-[border-color,background-color] duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#FF69B4]/60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/60">
      <button type="button" onClick={onGuided} aria-label="New mix" className="absolute inset-0 cursor-pointer rounded-[20px] transition-[scale] duration-200 active:scale-[0.99]" />
      <span className="pointer-events-none grid justify-items-center gap-4">
        <span className="relative block size-[64px]">
          <BlockSlot size={64} className="left-0 top-0" />
          <LiftedBlock size={64} className="left-[6px] top-[-14px] transition-transform duration-300 group-hover/new:-translate-y-1 group-hover/new:rotate-[-4deg]" />
        </span>
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#17121A]">
          <Plus size={16} strokeWidth={2.4} /> New mix
        </span>
        {full && <span className="-mt-2 text-[12.5px] text-[#6B5F68]">No room for another: archive one, or add a pack</span>}
      </span>
      {!full && <button
        type="button"
        onClick={() => setPicking(true)}
        className="absolute bottom-4 left-1/2 flex h-8 -translate-x-1/2 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium text-[#6B5F68] transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-[#17121A] active:scale-[0.97]"
      >
        <Palette size={14} /> Start from…
      </button>}
    </div>
  )
}

/** "Start from a site": a library site's page, as its matched layouts under the site's look (never its words or pictures). */
function SitePicker({ onPick }: { onPick: (site: LibrarySite, page: LibraryPage) => void }) {
  const [sites, setSites] = useState<LibrarySiteSummary[] | null>(null)
  const [open, setOpen] = useState<LibrarySite | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  useEffect(() => {
    listSites().then(setSites, () => setSites([]))
  }, [])
  if (!sites?.length) return null
  if (open)
    return (
      <>
        <li className="flex items-center gap-1 px-1 pb-1 pt-0.5">
          <button type="button" onClick={() => setOpen(null)} aria-label="All sites" className="grid size-6 cursor-pointer place-items-center rounded-full text-zinc-500 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97]">
            <ArrowLeft size={13} />
          </button>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#6B5F68]/70">{open.name}: pick a page</span>
        </li>
        {[...open.pages]
          .sort((a, b) => a.order - b.order)
          .map((p) => {
            const n = planClip(library, p, 'all').slots.length
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!n}
                  onClick={() => onPick(open, p)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/[0.04] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[#17121A]">
                      {p.title} <span className="font-normal text-[#6B5F68]">{p.path}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-[#6B5F68]">{n ? `${n} ${n === 1 ? 'layout' : 'layouts'} in its order, in its style` : 'No layouts matched yet'}</span>
                  </span>
                </button>
              </li>
            )
          })}
      </>
    )
  return (
    <>
      <PickHeading>Start from a site</PickHeading>
      {sites.map((s) => (
        <li key={s.slug}>
          <button
            type="button"
            onClick={async () => {
              setLoading(s.slug)
              const site = await loadSite(s.slug, library).catch(() => null)
              setLoading(null)
              if (site) setOpen(site)
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/[0.04] active:scale-[0.98]"
          >
            <span className="flex h-7 w-12 shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
              {['bg', 'text', 'primary', 'accent'].map((k) => (
                <i key={k} className="flex-1" style={{ background: s.palette?.[k] ?? '#e4e4e7' }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-[#17121A]">{s.name}</span>
              <span className="block truncate text-[11.5px] text-[#6B5F68]">{loading === s.slug ? 'Opening…' : [s.industry, `${s.matched} layouts matched`].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        </li>
      ))}
    </>
  )
}

function PickHeading({ children }: { children: string }) {
  return <li className="px-2 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B5F68]/70 first:pt-0.5">{children}</li>
}

/** A starter mix to start from: its first page drawn small in its own style guide, its name and what it holds. */
function StarterRow({ starter, onPick }: { starter: Starter; onPick: () => void }) {
  const { site, guide } = useMemo(() => buildStarter(library, starter), [starter])
  const sections = useMemo(
    () => [site.shared.nav?.type, ...site.pages[0].slots.map((s) => s.type), site.shared.footer?.type].filter(Boolean) as SectionType[],
    [site],
  )
  const font = resolveGuide(guide).tokens['font.display']
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/[0.04] active:scale-[0.98]">
        <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
          <MixThumb sections={sections} guide={guide} />
          {!starterOpen(library, starter) && (
            <span className="absolute inset-0 grid place-items-center bg-white/55 text-zinc-700" title="Uses layouts in a mix pack">
              <Lock size={13} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-[#17121A]" style={{ fontFamily: font }}>
            {starter.name}
          </span>
          <span className="line-clamp-2 text-[11.5px] leading-snug text-[#6B5F68]">{starter.description}</span>
        </span>
      </button>
    </li>
  )
}

/** A style guide to start from: its colors, its name in its display font, and where it comes from. */
function GuideRow({ name, note, guide, onPick }: { name: string; note: string; guide?: GuideState; onPick: () => void }) {
  const t = guide ? resolveGuide(guide).tokens : null
  const swatch = t ? [t['color.bg'], t['color.text'], t['color.primary'], t['color.accent']] : ['#ffffff', '#18181b', '#e4e4e7', '#a1a1aa']
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,scale] duration-150 hover:bg-zinc-950/[0.04] active:scale-[0.98]">
        <span className="flex h-7 w-12 shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
          {swatch.map((c, i) => (
            <i key={i} className="flex-1" style={{ background: c }} />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-[#17121A]" style={t ? { fontFamily: t['font.display'] } : undefined}>
            {name}
          </span>
          <span className="block truncate text-[11.5px] text-[#6B5F68]">{note}</span>
        </span>
      </button>
    </li>
  )
}

function MixCard({ mix: m, onDelete, onDuplicate, onArchive }: { mix: SavedMix; onDelete?: () => void; onDuplicate?: () => void; onArchive?: () => void }) {
  const meta = [...(m.archived ? ['Archived'] : []), plural(m.versions, 'version'), ...(m.pages > 1 ? [plural(m.pages, 'page')] : []), `edited ${ago(m.updated_at)}`]
  if (m.role !== 'owner') meta.splice(0, 0, `Shared by ${m.owner ?? 'someone'}`, ROLE_NOTE[m.role]!)
  return (
    <Card href={`/${m.short}`} name={m.name} id={m.role === 'viewer' ? undefined : m.id} heading={m.heading} sections={m.sections} guide={m.guide} versions={m.heads.length} meta={m.role === 'owner' ? meta : meta.slice(0, 2)} quiet={m.archived}>
      {m.heads.length > 0 && !m.archived && (
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
      <span className="!absolute right-3 top-3 z-10 flex gap-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100">
        {onDuplicate && (
          <button type="button" title="Duplicate" aria-label={`Duplicate ${m.name}`} onClick={onDuplicate} className={CARD_BUTTON + ' hover:text-zinc-900'}>
            <Copy size={15} />
          </button>
        )}
        {onArchive && (
          <button
            type="button"
            title={m.archived ? 'Bring back (it counts as one of your mixes again)' : 'Archive (kept read-only, and frees one of your mixes)'}
            aria-label={`${m.archived ? 'Bring back' : 'Archive'} ${m.name}`}
            onClick={onArchive}
            className={CARD_BUTTON + ' hover:text-zinc-900'}
          >
            {m.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          </button>
        )}
        {onDelete && (
          <button type="button" title="Delete this mix" aria-label={`Delete ${m.name}`} onClick={onDelete} className={CARD_BUTTON + ' hover:text-red-600'}>
            <Trash2 size={15} />
          </button>
        )}
      </span>
    </Card>
  )
}

/** A mix as a card: its page drawn small on a soft tile, then its name, a quiet line of facts and whatever it adds. */
function Card({
  href,
  name,
  id,
  heading,
  sections,
  guide,
  meta,
  quiet,
  versions = 0,
  children,
}: {
  href: string
  name: string
  /** Set when you may rename it (owners and editors of a saved mix). */
  id?: string
  heading?: string | null
  sections: SectionType[]
  guide: GuideState | null
  meta: string[]
  quiet?: boolean
  versions?: number
  children?: React.ReactNode
}) {
  return (
    <div className={CARD}>
      {/* The whole card opens the mix; its buttons sit above this link. */}
      <Link href={href} aria-label={`Open ${name}`} className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF69B4]" />
      <span className={`pointer-events-none block p-3 pb-0 ${quiet ? 'opacity-80 saturate-50' : ''}`}>
        <Stage versions={versions}>
          <MixThumb sections={sections} guide={guide} heading={heading} />
        </Stage>
      </span>
      <span className="pointer-events-none flex flex-1 flex-col gap-3 p-4 pt-3.5 [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10">
        <span className="min-w-0">
          {id ? <Name id={id} name={name} /> : <span className="block truncate text-[15.5px] font-semibold text-[#17121A]">{name}</span>}
          <span className="mt-0.5 block truncate text-[12.5px] text-[#6B5F68]">{meta.join(' · ')}</span>
        </span>
        {children && <span className="mt-auto flex min-h-7 items-center gap-2">{children}</span>}
      </span>
    </div>
  )
}

/**
 * The preview, drawn the way blokmix.com draws the app: a pink dotted stage, the mix's page as a frame lifted off it,
 * its saved versions as frames fanned behind (up to two), and the brand's pink block dropped on a corner. On hover the
 * fan opens a little and the block bobs.
 */
function Stage({ versions, children }: { versions: number; children: React.ReactNode }) {
  const behind = Math.min(versions, 2)
  return (
    <span
      className="relative block aspect-[16/10] overflow-hidden rounded-[14px]"
      style={{ background: '#FFF2F8', backgroundImage: 'radial-gradient(rgb(255 105 180 / 0.32) 1px, transparent 1.3px)', backgroundSize: '14px 14px' }}
    >
      {Array.from({ length: behind }, (_, i) => (
        <span
          key={i}
          className={`absolute inset-x-[14%] bottom-[-12%] top-[16%] rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.06),0_10px_20px_-12px_rgb(23_18_26/0.3)] transition-[rotate,translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            i
              ? 'translate-x-2.5 translate-y-1.5 rotate-[5deg] group-hover/card:translate-x-4 group-hover/card:rotate-[8deg]'
              : '-translate-x-2.5 translate-y-1 -rotate-[4deg] group-hover/card:-translate-x-4 group-hover/card:-rotate-[7deg]'
          }`}
        >
          <span className="absolute inset-x-3 top-3 block h-1.5 w-1/3 rounded-full bg-[#F3EDF0]" />
        </span>
      ))}
      <span className="absolute inset-x-[14%] bottom-[-12%] top-[10%] overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(23_18_26/0.08),0_18px_32px_-14px_rgb(194_24_91/0.35)] transition-[translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/card:-translate-y-1">
        {children}
      </span>
      <span
        aria-hidden
        className="absolute left-[7%] top-[7%] block size-[22px] -rotate-[12deg] rounded-[6px] transition-[rotate,translate] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover/card:-translate-y-1.5 group-hover/card:-rotate-[2deg]"
        style={{ background: 'linear-gradient(160deg, #FF8CC6, #FF5CB0 60%)', boxShadow: 'inset 0 -3px 0 #C2185B, 0 8px 14px -6px rgb(194 24 91 / 0.6)' }}
      />
    </span>
  )
}

/** The card's name: click (or the pencil) to rename it in place; Enter or leaving saves, Escape puts it back. */
function Name({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setValue(name), [name])
  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const save = async () => {
    setEditing(false)
    const next = value.trim()
    if (!next || next === name) return setValue(name)
    const res = await api('PATCH', `/api/mixes/${id}/name`, { name: next })
    if (res.status === 200) router.reload({ only: ['mixes'] })
    else setValue(name)
  }

  return editing ? (
    <input
      ref={input}
      value={value}
      maxLength={120}
      aria-label="Mix name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setValue(name)
          setEditing(false)
        }
      }}
      className="pointer-events-auto relative z-10 -mx-1.5 block w-[calc(100%+12px)] rounded-lg bg-[#F3EDF0] px-1.5 text-[15.5px] font-semibold text-[#17121A] outline-none ring-2 ring-[#FF69B4]/45"
    />
  ) : (
    <button
      type="button"
      title="Rename"
      onClick={() => setEditing(true)}
      className="group/name -mx-1.5 flex max-w-[calc(100%+12px)] cursor-text items-center gap-1.5 rounded-lg px-1.5 text-left text-[15.5px] font-semibold text-[#17121A] transition-colors duration-150 hover:bg-[#F3EDF0]"
    >
      <span className="truncate">{value}</span>
      <Pencil size={13} className="shrink-0 text-zinc-400 opacity-0 transition-opacity duration-150 group-hover/name:opacity-100 [@media(hover:none)]:opacity-100" />
    </button>
  )
}

/**
 * What's used of what your plan includes (mixes open, clips and uploads; unlimited ones left out), the packs you've
 * bought, and getting one (or, once you have, their receipts at Polar).
 */
function PlanLine({ plan }: { plan: Plan }) {
  const { limits: l, usage: u, pack } = plan
  const mb = u.uploads / (1024 * 1024)
  const parts = [
    l.mixes !== null && `${u.mixes} of ${l.mixes} ${l.mixes === 1 ? 'mix' : 'mixes'}`,
    l.clips !== null && `${u.clips} of ${l.clips} clips`,
    l.upload_mb !== null && `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} of ${l.upload_mb >= 1024 ? `${l.upload_mb / 1024} GB` : `${l.upload_mb} MB`}`,
  ].filter(Boolean)
  const label = plan.name === 'free' ? 'Free' : plan.packs ? `${plan.packs} mix ${plan.packs === 1 ? 'pack' : 'packs'}` : 'Unlimited'
  const link = 'cursor-pointer font-semibold text-[#C2185B] underline-offset-2 hover:underline'
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[#6B5F68]">
      <span className="font-semibold text-[#17121A]">{label}</span>
      {parts.length > 0 && <span>· {parts.join(' · ')}</span>}
      {l.mixes !== null && (plan.buy ? (
        <button type="button" onClick={buyPack} className={link}>
          · {plan.name === 'free' ? `Get a mix pack, $${pack.price_usd}` : 'Add a pack'}
        </button>
      ) : (
        <span>· Mix packs ({pack.mixes} mixes, ${pack.price_usd} once) are coming soon</span>
      ))}
      {plan.receipts && (
        <a href="/api/billing/receipts" className={link}>
          · Receipts
        </a>
      )}
    </p>
  )
}

/** Back from Polar's checkout (?bought=1): say thanks, and look again until the webhook has added the pack. */
function useBought(plan: Plan | null): 'waiting' | 'arrived' | null {
  const [packs] = useState(plan?.packs ?? 0)
  const [bought] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bought'))
  const arrived = (plan?.packs ?? 0) > packs
  useEffect(() => {
    if (!bought) return
    if (arrived) return void window.history.replaceState(null, '', window.location.pathname)
    let tries = 0
    const t = window.setInterval(() => (++tries > 10 ? window.clearInterval(t) : router.reload({ only: ['auth'] })), 3000)
    return () => window.clearInterval(t)
  }, [bought, arrived])
  return bought ? (arrived ? 'arrived' : 'waiting') : null
}
