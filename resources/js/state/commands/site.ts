import type { Page } from '@/core/types'
import { type CommandInput } from '@/core/commands/schema'
import { PAGE_TEMPLATES, pageView } from '@/core/site'
import { useStore } from '../store'
import { CommandError, findPage, clean } from './refs'

function describePage(p: Page) {
  const st = useStore.getState()
  return {
    id: p.id,
    path: p.path,
    title: p.title,
    sections: pageView(st.site, p.id).length,
    nav: p.show.nav && !!st.site.shared.nav,
    footer: p.show.footer && !!st.site.shared.footer,
    open: findPage().id === p.id,
  }
}

/** The site's pages: listing, adding from a template, renaming, showing the shared nav and footer, order. */
export const read = {
  list_pages: () => {
    const st = useStore.getState()
    return { pages: st.site.pages.map(describePage), shared: { nav: st.site.shared.nav?.id ?? null, footer: st.site.shared.footer?.id ?? null } }
  },
}

export const write = {
  add_page: (i: CommandInput<'add_page'>) => {
    const st = useStore.getState()
    const t = PAGE_TEMPLATES[i.template ?? 'blank']
    const id = st.addPage({ path: i.path, title: i.title ?? (i.template && i.template !== 'blank' ? t.title : undefined), show: clean({ nav: i.nav, footer: i.footer }) })
    for (const type of t.types) useStore.getState().addSlot(type, undefined, Number.MAX_SAFE_INTEGER, id)
    useStore.getState().focusSlot(null)
    return describePage(findPage(id))
  },
  update_page: (i: CommandInput<'update_page'>) => {
    const p = findPage(i.page)
    useStore.getState().updatePage(p.id, { title: i.title, path: i.path, show: clean({ nav: i.nav, footer: i.footer }) })
    return describePage(findPage(p.id))
  },
  remove_page: (i: CommandInput<'remove_page'>) => {
    const st = useStore.getState()
    const p = findPage(i.page)
    if (st.site.pages.length < 2) throw new CommandError('A site needs at least one page')
    st.removePage(p.id)
    return { removed: p.path, pages: useStore.getState().site.pages.map((x) => x.path) }
  },
  move_page: (i: CommandInput<'move_page'>) => {
    const p = findPage(i.page)
    useStore.getState().movePage(p.id, i.to - 1)
    return { pages: useStore.getState().site.pages.map((x) => x.path) }
  },
}
