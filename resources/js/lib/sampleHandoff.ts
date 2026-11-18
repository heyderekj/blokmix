import { composeSite } from '@/core/compose'
import { packetFiles } from '@/core/export/packet'
import { resolveGuide } from '@/core/guide'
import { library } from '@/data/library'
import { buildSeed } from '@/state/seed'

/** Use the built-in demo alone so the download never depends on an open mix or its uploads. */
export function sampleHandoffFiles() {
  const { mixName, site, content, guide: guideState } = buildSeed(library)
  const guide = resolveGuide(guideState)
  const page = composeSite({ site, guide, content, library, title: content.brand, page: guideState })

  return packetFiles({
    mixName,
    page,
    guide,
    guideState,
    library,
    targets: ['astro', 'next'],
    notes: ['Keep the sections in order and make the primary action easy to find on mobile.'],
  }, { mcp: false })
}
