import { type CommandInput } from '@/core/commands/schema'
import { SOURCE_PREFIX } from '@/core/guide'
import { pageView } from '@/core/site'
import type { SectionType } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { library } from '@/data/library'
import {
  filterSites,
  findSite,
  inspiredOf,
  layoutName,
  listSites,
  pickPage,
  planClip,
  registerSiteSource,
  sectionClipState,
  type LibrarySite,
  type LibrarySiteSummary,
} from '@/lib/siteLibrary'
import { useStore } from '../store'
import { CommandError, findPage } from './refs'
import type { AsyncCommand } from './index'

/** Library lookups happen in `prepare`; a missing site or a server that can't be reached is the caller's error. */
async function site(ref: string): Promise<LibrarySite> {
  try {
    return await findSite(ref, library)
  } catch (e) {
    throw new CommandError(e instanceof Error ? e.message : String(e))
  }
}

export function describeLibrarySite(s: LibrarySite) {
  return {
    slug: s.slug,
    name: s.name,
    url: s.url,
    industry: s.industry,
    tags: s.tags,
    personality: s.personality,
    pages: [...s.pages]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        path: p.path,
        title: p.title,
        sections: [...p.sections]
          .sort((a, b) => a.order - b.order)
          .filter((x) => x.status !== 'hidden')
          .map((x) => {
            const state = sectionClipState(library, x)
            return {
              order: x.order,
              type: x.type,
              layout: state.clippable ? state.clipId : null,
              layoutName: state.clippable ? layoutName(library, state.clipId) : null,
              status: x.status,
              clippable: state.clippable,
              ...(state.clippable ? {} : { note: state.note }),
              ...(x.hint ? { hint: x.hint } : {}),
            }
          }),
      })),
  }
}

/** Add a site page's matched layouts to the mix, in page order, crediting the site. Shared by the UI and agents. */
function clipFromSite(i: CommandInput<'clip_from_site'>, s: LibrarySite) {
  if (!i.all && !i.sections?.length) throw new CommandError('Say which sections (their order on the site’s page, from get_library_site) or all: true')
  const page = pickPage(s, i.page)
  if (!page) throw new CommandError(`${s.name} has no page “${i.page}”. Pages: ${s.pages.map((p) => p.path).join(', ')}`)
  const plan = planClip(library, page, i.all ? 'all' : i.sections!)
  if (!plan.slots.length)
    throw new CommandError(`Nothing on ${s.name} ${page.path} to clip${plan.skipped.length ? `: ${plan.skipped.map((x) => `${x.order} ${x.type} (${x.reason})`).join('; ')}` : ''}`)

  const inspiredBy = inspiredOf(s, page)
  const st = useStore.getState()
  const explicit = !i.all
  let pageId: string
  let own: number // the index into the page's own sections (not the shared nav and footer) to insert at
  if (i.newPage) {
    const title = page.path === '/' ? s.name : page.title
    pageId = st.addPage({ path: page.path === '/' ? `/${s.slug}` : page.path, title })
    own = 0
  } else {
    const target = findPage()
    pageId = target.id
    const view = pageView(st.site, pageId)
    const navShown = view[0]?.id === st.site.shared.nav?.id && !!st.site.shared.nav
    if (i.at !== undefined) own = Math.max(0, i.at - 1 - (navShown ? 1 : 0))
    else {
      const focused = st.ui.focusedSlotId
      const k = target.slots.findIndex((x) => x.id === focused)
      own = k >= 0 ? k + 1 : focused && focused === st.site.shared.nav?.id ? 0 : target.slots.length
    }
    own = Math.min(own, target.slots.length)
  }

  const added: { order: number; type: SectionType; layout: string; id: string }[] = []
  const skipped = [...plan.skipped]
  for (const x of plan.slots) {
    const now = useStore.getState()
    const chrome = x.type === 'nav' || x.type === 'footer' ? x.type : null
    if (chrome) {
      const shared = now.site.shared[chrome]
      if (shared) {
        // One nav and one footer for the whole site: a pick you asked for by name swaps the shared one's layout.
        if (!explicit) {
          skipped.push({ order: x.order, type: x.type, reason: `Kept this mix’s ${chrome} (ask for section ${x.order} to swap it)` })
          continue
        }
        now.setClip(shared.id, x.clipId)
        now.setInspiredBy(shared.id, inspiredBy)
        added.push({ order: x.order, type: x.type, layout: x.clipId, id: shared.id })
        continue
      }
      now.addSlot(x.type, x.clipId, chrome === 'nav' ? 0 : Number.MAX_SAFE_INTEGER, pageId, { inspiredBy })
      const made = useStore.getState().site.shared[chrome]
      if (made) added.push({ order: x.order, type: x.type, layout: x.clipId, id: made.id })
      continue
    }
    const pg = now.site.pages.find((p) => p.id === pageId)!
    const offset = now.site.shared.nav && pg.show.nav ? 1 : 0
    now.addSlot(x.type, x.clipId, own + offset, pageId, { inspiredBy })
    const id = useStore.getState().ui.focusedSlotId
    if (id) added.push({ order: x.order, type: x.type, layout: x.clipId, id })
    own++
  }
  const after = useStore.getState()
  const view = pageView(after.site, pageId)
  const where = after.site.pages.find((p) => p.id === pageId)!
  return {
    site: s.name,
    from: page.path,
    page: where.path,
    added: added.map((a) => ({ section: a.id, position: view.findIndex((v) => v.id === a.id) + 1, type: a.type, layout: a.layout, from: a.order })),
    skipped,
    inspiredBy,
  }
}

function useSiteStyle(i: CommandInput<'use_site_style'>, s: LibrarySite) {
  const source = registerSiteSource(library, s)
  const groups = i.groups ?? [...TOKEN_GROUPS]
  useStore.getState().promoteSite(source, groups, !!i.adopt)
  return { site: s.name, candidates: useStore.getState().guide.candidates.filter((c) => c.clipId === `${SOURCE_PREFIX}${source.id}`).map((c) => c.id), groups, adopted: !!i.adopt }
}

const summary = (x: LibrarySiteSummary) => ({
  slug: x.slug,
  name: x.name,
  url: x.url,
  industry: x.industry,
  tags: x.tags,
  palette: x.palette,
  pages: x.pages,
  sections: x.sections,
  matched: x.matched,
  needsLayout: x.needsLayout,
})

export const later = {
  list_library_sites: {
    prepare: async () => {
      try {
        return await listSites()
      } catch (e) {
        throw new CommandError(e instanceof Error ? e.message : String(e))
      }
    },
    apply: (i: CommandInput<'list_library_sites'>, sites: LibrarySiteSummary[]) => ({ sites: filterSites(sites, i).map(summary) }),
  } satisfies AsyncCommand<LibrarySiteSummary[]>,
  get_library_site: {
    prepare: (i: CommandInput<'get_library_site'>) => site(i.site),
    apply: (_i: CommandInput<'get_library_site'>, s: LibrarySite) => describeLibrarySite(s),
  } satisfies AsyncCommand<LibrarySite>,
  clip_from_site: {
    prepare: (i: CommandInput<'clip_from_site'>) => site(i.site),
    apply: clipFromSite,
  } satisfies AsyncCommand<LibrarySite>,
  use_site_style: {
    prepare: (i: CommandInput<'use_site_style'>) => site(i.site),
    apply: useSiteStyle,
  } satisfies AsyncCommand<LibrarySite>,
}
