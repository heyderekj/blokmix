import { Head, Link } from '@inertiajs/react'
import { ArrowRight, FileText, Layers } from 'lucide-react'
import { allSlots } from '@/core/site'
import { useStore } from '@/state/store'
import { LogoTile } from '@/ui/shell/Logo'

interface ServerMix {
  id: string
  name: string
  updated_at: string
}

/**
 * Every mix you can open. Mixes saved on the server list here once storage
 * lands; until then the one mix is the one in this browser.
 */
export default function MixesIndex({ mixes }: { mixes: ServerMix[] }) {
  const name = useStore((s) => s.mixName)
  const site = useStore((s) => s.site)
  const versions = useStore((s) => Object.keys(s.versions).length)
  const sections = allSlots(site).length

  return (
    <div className="min-h-full bg-zinc-50">
      <Head title="Mixes" />
      <header className="flex items-center gap-2.5 px-6 py-5">
        <LogoTile size={30} />
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Blokmix</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-balance text-zinc-900">Your mixes</h1>

        <section className="mt-8">
          <h2 className="text-[12px] font-semibold text-zinc-400">In this browser</h2>
          <Link
            href="/mixes/local"
            className="group mt-3 flex cursor-pointer items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.12)] transition-[box-shadow,scale] duration-200 active:scale-[0.99] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_16px_32px_-12px_rgb(0_0_0/0.18)]"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-key-soft">
              <Layers size={20} className="text-key-ink" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-zinc-900">{name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <FileText size={12} /> {site.pages.length} {site.pages.length === 1 ? 'page' : 'pages'}
                </span>
                <span>·</span>
                <span>{sections} sections</span>
                <span>·</span>
                <span>{versions ? `${versions} ${versions === 1 ? 'version' : 'versions'}` : 'no versions yet'}</span>
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </section>

        {mixes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[12px] font-semibold text-zinc-400">Saved</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {mixes.map((m) => (
                <li key={m.id}>
                  <Link href={`/mixes/${m.id}`} className="flex cursor-pointer items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] active:scale-[0.99]">
                    <span className="text-[14px] font-medium text-zinc-900">{m.name}</span>
                    <span className="text-[12px] text-zinc-400">{new Date(m.updated_at).toLocaleDateString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
