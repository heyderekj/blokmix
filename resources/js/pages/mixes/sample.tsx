import { Head } from '@inertiajs/react'
import { Download } from 'lucide-react'
import { zipFiles } from '@/core/export/zip'
import { sampleHandoffFiles } from '@/lib/sampleHandoff'
import { Wordmark } from '@/ui/brand/Wordmark'

function downloadSample() {
  const name = 'blokmix-sample-handoff'
  const zip = zipFiles(sampleHandoffFiles(), name)
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function SampleHandoff() {
  return (
    <>
      <Head title="Sample handoff" />
      <main className="grid min-h-dvh place-items-center bg-well px-4 py-12">
        <section className="w-full max-w-md rounded-[22px] bg-lift p-7 shadow-[0_24px_48px_-24px_rgb(23_18_26/0.28)] ring-1 ring-zinc-950/5 sm:p-9">
          <a href="/" aria-label="Blokmix home" className="inline-flex text-zinc-900"><Wordmark height={24} mono /></a>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900">Try a sample handoff</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">Give your agent a two-page sample site with build notes, design tokens, and starter projects for Astro and Next.js.</p>
          <button type="button" onClick={downloadSample} className="btn-block mt-5 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold">
            <Download size={16} aria-hidden /> Download free sample
          </button>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">Unzip the download, open the folder in your coding agent, and give it <code>PROMPT.astro.md</code> or <code>PROMPT.next.md</code>.</p>
        </section>
      </main>
    </>
  )
}
