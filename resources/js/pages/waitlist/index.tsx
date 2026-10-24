import { useMemo, useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Check, Copy, Download, Search, Trash2 } from 'lucide-react'
import { Wordmark } from '@/ui/brand/Wordmark'
import { confirmAction } from '@/ui/shell/Confirm'

interface Person {
  id: number
  email: string
  source: string | null
  created_at: string
}

const SOURCE: Record<string, string> = { hero: 'Top of the page', closing: 'Bottom of the page' }

/** Rows come straight from the table as "Y-m-d H:i:s" in UTC. */
const at = (stamp: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : stamp.replace(' ', 'T') + 'Z')

const joined = (stamp: string) => {
  const s = (Date.now() - at(stamp).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return at(stamp).toLocaleDateString()
}

/** Who joined blokmix.com's waitlist, newest first: find someone, copy every email, export a CSV, or take someone off. */
export default function Waitlist({ people }: { people: Person[] }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.email.includes(q)) : people
  }, [people, query])
  const week = people.filter((p) => Date.now() - at(p.created_at).getTime() < 7 * 86400 * 1000).length

  const copyAll = async () => {
    await navigator.clipboard.writeText(shown.map((p) => p.email).join('\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const remove = async (p: Person) => {
    const ok = await confirmAction({ title: `Take ${p.email} off the waitlist?`, body: 'They won’t hear when Blokmix opens. This can’t be undone.', confirm: 'Take off' })
    if (!ok) return
    router.delete(`/waitlist/${p.id}`, { preserveScroll: true })
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <Head title="Waitlist" />
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex-1 text-zinc-900">
          <Wordmark height={18} />
        </span>
        <Link
          href="/"
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
        >
          <ArrowLeft size={15} /> Your mixes
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">Waitlist</h1>
            <p className="mt-1 text-[13.5px] text-zinc-500">
              {people.length === 1 ? '1 person' : `${people.length} people`} from blokmix.com · {week} this week
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!shown.length}
              onClick={copyAll}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-zinc-700 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97] disabled:opacity-40"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : query ? 'Copy these emails' : 'Copy emails'}
            </button>
            <a
              href="/waitlist/export"
              className="flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[13.5px] font-semibold text-white transition-[scale,background-color] duration-150 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-800"
            >
              <Download size={15} /> Export CSV
            </a>
          </div>
        </div>

        {people.length > 0 ? (
          <>
            <label className="mt-8 flex h-11 items-center gap-2 rounded-xl bg-white px-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] focus-within:ring-2 focus-within:ring-[#FF69B4]/45">
              <Search size={15} className="text-zinc-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an email"
                aria-label="Find an email"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </label>

            <ul className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.12)]">
              {shown.map((p) => (
                <li key={p.id} className="group/row flex items-center gap-3 border-t border-zinc-950/5 px-4 py-3 first:border-t-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-key-soft text-[12px] font-bold uppercase text-key-ink">{p.email[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-zinc-900">{p.email}</span>
                    <span className="block truncate text-[12px] text-zinc-500">
                      {joined(p.created_at)}
                      {p.source ? ` · ${SOURCE[p.source] ?? p.source}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    title="Take off the waitlist"
                    aria-label={`Take ${p.email} off the waitlist`}
                    onClick={() => remove(p)}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 opacity-0 transition-[opacity,background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-red-600 focus-visible:opacity-100 active:scale-[0.97] group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
              {!shown.length && <li className="px-4 py-6 text-center text-[13.5px] text-zinc-500">No one matches “{query}”.</li>}
            </ul>
          </>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-950/10 px-5 py-8 text-center text-[13.5px] text-zinc-500">
            No one yet. People who join on blokmix.com show up here.
          </p>
        )}
      </main>
    </div>
  )
}
