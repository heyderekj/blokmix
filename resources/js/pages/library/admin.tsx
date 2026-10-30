import { useEffect, useMemo, useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, ExternalLink, Eye, EyeOff, Search, Trash2 } from 'lucide-react'
import { Wordmark } from '@/ui/brand/Wordmark'
import { confirmAction } from '@/ui/shell/Confirm'
import { api } from '@/lib/mixSync'

type SiteStatus = 'draft' | 'published'
type SectionStatus = 'matched' | 'needs_layout' | 'hidden'

interface SiteCard {
  slug: string
  name: string
  url: string
  industry: string | null
  tags: string[]
  palette: Record<string, string>
  thumb: string | null
  status: SiteStatus
  pages: number
  sections: number
  matched: number
  needsLayout: number
  updated_at: string
}

interface Section {
  id: number
  order: number
  type: string
  box: { y: number; h: number }
  layoutId: string | null
  score: number | null
  status: SectionStatus
  screenshot: string | null
}

interface Page {
  id: number
  path: string
  title: string | null
  screenshot: string | null
  width: number
  height: number
  sections: Section[]
}

interface Site extends Omit<SiteCard, 'palette' | 'pages' | 'sections' | 'matched' | 'needsLayout'> {
  pages: Page[]
}

const STATUS_LABEL: Record<SectionStatus, string> = { matched: 'Matched', needs_layout: 'Needs a layout', hidden: 'Hidden' }
const STATUS_TONE: Record<SectionStatus, string> = {
  matched: 'bg-emerald-50 text-emerald-700',
  needs_layout: 'bg-amber-50 text-amber-700',
  hidden: 'bg-zinc-100 text-zinc-500',
}
const BOX_TONE: Record<SectionStatus, string> = {
  matched: 'border-emerald-500/70 bg-emerald-500/5',
  needs_layout: 'border-amber-500/80 bg-amber-500/10',
  hidden: 'border-zinc-400/60 bg-zinc-900/25',
}

const QUIET =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50'
const FIELD =
  'h-9 min-w-0 rounded-lg bg-white px-2.5 text-[13px] text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus:ring-2 focus:ring-[#FF69B4]/45'

/** The site library, for the people who run Blokmix: every captured site, and one site's pages to curate. */
export default function LibraryAdmin({ sites, site, types }: { sites: SiteCard[]; site: Site | null; types: string[] }) {
  return (
    <div className="min-h-full bg-zinc-50">
      <Head title={site ? `${site.name} · Library` : 'Library'} />
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex-1 text-zinc-900">
          <Wordmark height={18} />
        </span>
        <Link href={site ? '/library/admin' : '/'} className={QUIET}>
          <ArrowLeft size={15} /> {site ? 'All sites' : 'Your mixes'}
        </Link>
      </header>
      {site ? <SiteView key={site.slug} site={site} types={types} /> : <SiteList sites={sites} />}
    </div>
  )
}

function SiteList({ sites }: { sites: SiteCard[] }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sites
    return sites.filter((s) => [s.name, s.url, s.industry ?? '', ...s.tags].some((t) => t.toLowerCase().includes(q)))
  }, [sites, query])
  const published = sites.filter((s) => s.status === 'published').length

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-8">
      <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">Site library</h1>
      <p className="mt-1 text-[13.5px] text-zinc-500">
        {sites.length === 1 ? '1 site' : `${sites.length} sites`} · {published} published. Upload bundles with the library CLI.
      </p>

      {sites.length > 0 ? (
        <>
          <label className="mt-8 flex h-11 items-center gap-2 rounded-xl bg-white px-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] focus-within:ring-2 focus-within:ring-[#FF69B4]/45">
            <Search size={15} className="text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a site, industry or tag"
              aria-label="Find a site"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>
          <ul className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.12)]">
            {shown.map((s) => (
              <li key={s.slug} className="border-t border-zinc-950/5 first:border-t-0">
                <Link href={`/library/admin/${s.slug}`} className="flex items-center gap-3.5 px-4 py-3 transition-colors duration-150 hover:bg-zinc-950/[0.02]">
                  <span className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                    {s.thumb && <img src={s.thumb} alt="" loading="lazy" className="size-full object-cover object-top" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-zinc-900">{s.name}</span>
                      <StatusPill status={s.status} />
                    </span>
                    <span className="block truncate text-[12px] text-zinc-500">
                      {s.industry ?? 'No industry'} · {s.pages === 1 ? '1 page' : `${s.pages} pages`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-zinc-500">
                    <span className="text-emerald-700">{s.matched} matched</span>
                    {s.needsLayout > 0 && <span className="block text-amber-700">{s.needsLayout} need a layout</span>}
                  </span>
                </Link>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-6 text-center text-[13.5px] text-zinc-500">No site matches “{query}”.</li>}
          </ul>
        </>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-950/10 px-5 py-8 text-center text-[13.5px] text-zinc-500">
          No sites yet. Bundles uploaded with the library CLI show up here as drafts.
        </p>
      )}
    </main>
  )
}

function StatusPill({ status }: { status: SiteStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}
    >
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  )
}

function SiteView({ site: initial, types }: { site: Site; types: string[] }) {
  const [site, setSite] = useState(initial)
  const [pageIndex, setPageIndex] = useState(0)
  const [focus, setFocus] = useState<number | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const page = site.pages[pageIndex] ?? site.pages[0]

  useEffect(() => setSite(initial), [initial])

  const patchSite = async (change: Partial<Pick<Site, 'name' | 'industry' | 'tags' | 'status'>>) => {
    const res = await api<Site & { message?: string }>('PATCH', `/api/library/sites/${site.slug}`, change)
    if (res.status === 200) {
      setSite(res.body)
      setProblem(null)
    } else setProblem(res.body?.message ?? 'That didn’t save.')
  }

  const patchSection = async (id: number, change: { layout_id?: string | null; status?: SectionStatus; type?: string }) => {
    const res = await api<Section & { message?: string }>('PATCH', `/api/library/sections/${id}`, change)
    if (res.status !== 200) return setProblem(res.body?.message ?? 'That didn’t save.')
    setProblem(null)
    setSite((s) => ({ ...s, pages: s.pages.map((p) => ({ ...p, sections: p.sections.map((x) => (x.id === id ? res.body : x)) })) }))
  }

  const remove = async () => {
    const ok = await confirmAction({
      title: `Take ${site.name} down?`,
      body: 'Its pages, sections and screenshots are deleted. Upload the bundle again to bring it back.',
      confirm: 'Take down',
    })
    if (!ok) return
    const res = await api('DELETE', `/api/library/sites/${site.slug}`)
    if (res.status === 204) router.visit('/library/admin')
    else setProblem('It couldn’t be taken down.')
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[28px] font-semibold tracking-tight text-zinc-900">{site.name}</h1>
            <StatusPill status={site.status} />
          </div>
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900">
            {site.url} <ExternalLink size={12} />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={remove} className={`${QUIET} hover:text-red-600`}>
            <Trash2 size={15} /> Take down
          </button>
          <button
            type="button"
            onClick={() => patchSite({ status: site.status === 'published' ? 'draft' : 'published' })}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[13.5px] font-semibold text-white transition-[scale,background-color] duration-150 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-800"
          >
            {site.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />} {site.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-medium text-zinc-500">
          Industry
          <input
            key={`i-${site.industry}`}
            defaultValue={site.industry ?? ''}
            onBlur={(e) => e.target.value.trim() !== (site.industry ?? '') && patchSite({ industry: e.target.value.trim() || null })}
            className={`${FIELD} w-44`}
            placeholder="SaaS, Agency…"
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-medium text-zinc-500">
          Tags
          <input
            key={`t-${site.tags.join(',')}`}
            defaultValue={site.tags.join(', ')}
            onBlur={(e) => {
              const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
              if (tags.join(',') !== site.tags.join(',')) patchSite({ tags })
            }}
            className={`${FIELD} flex-1`}
            placeholder="minimal, dark, editorial"
          />
        </label>
      </div>
      {problem && <p className="mt-3 text-[13px] text-red-600">{problem}</p>}

      {site.pages.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {site.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPageIndex(i)}
              className={`h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150 ${i === pageIndex ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-zinc-900'}`}
            >
              {p.title || p.path}
            </button>
          ))}
        </div>
      )}

      {page && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Screenshot page={page} focus={focus} onFocus={setFocus} />
          <ol className="flex flex-col gap-2 self-start lg:sticky lg:top-4">
            {page.sections.map((s) => (
              <li
                key={s.id}
                onMouseEnter={() => setFocus(s.id)}
                onMouseLeave={() => setFocus(null)}
                className={`rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition-shadow duration-150 ${focus === s.id ? 'shadow-[0_0_0_2px_rgb(255_105_180/0.6)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-[12px] tabular-nums text-zinc-400">{s.order + 1}</span>
                  <select value={s.type} onChange={(e) => patchSection(s.id, { type: e.target.value })} className={`${FIELD} w-32 cursor-pointer`} aria-label="Type">
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                  <span className="ml-auto text-[12px] tabular-nums text-zinc-400" title="Match score">
                    {s.score === null ? '–' : s.score.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <input
                    key={`l-${s.layoutId}`}
                    defaultValue={s.layoutId ?? ''}
                    placeholder={`${s.type}.layout-…`}
                    aria-label="Layout id"
                    onBlur={(e) => e.target.value.trim() !== (s.layoutId ?? '') && patchSection(s.id, { layout_id: e.target.value.trim() || null })}
                    className={`${FIELD} flex-1 font-mono text-[12px]`}
                  />
                  <select
                    value={s.status}
                    onChange={(e) => patchSection(s.id, { status: e.target.value as SectionStatus })}
                    className={`${FIELD} w-36 cursor-pointer`}
                    aria-label="Status"
                  >
                    {(Object.keys(STATUS_LABEL) as SectionStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
            {!page.sections.length && <li className="text-[13px] text-zinc-500">No sections found on this page.</li>}
          </ol>
        </div>
      )}
    </main>
  )
}

/** The full-page screenshot with each section's box drawn over it (boxes are in screenshot pixels). */
function Screenshot({ page, focus, onFocus }: { page: Page; focus: number | null; onFocus: (id: number | null) => void }) {
  const [natural, setNatural] = useState(0)
  const height = natural || page.height || 1

  if (!page.screenshot) return <p className="text-[13px] text-zinc-500">This page has no screenshot.</p>
  return (
    <div className="relative self-start overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <img src={page.screenshot} alt="" className="block w-full" onLoad={(e) => setNatural(e.currentTarget.naturalHeight)} />
      {page.sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseEnter={() => onFocus(s.id)}
          onMouseLeave={() => onFocus(null)}
          className={`absolute inset-x-0 cursor-default border-2 text-left transition-[background-color,border-color] duration-150 ${BOX_TONE[s.status]} ${focus === s.id ? 'border-[#FF69B4]' : ''}`}
          style={{ top: `${(s.box.y / height) * 100}%`, height: `${(s.box.h / height) * 100}%` }}
        >
          <span className="absolute left-2 top-2 rounded-md bg-zinc-900/85 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {s.type}
            {s.layoutId ? ` → ${s.layoutId}` : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
