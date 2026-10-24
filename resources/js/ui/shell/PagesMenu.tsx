import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, FileText, MoreHorizontal, PanelBottom, PanelTop, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Page, SectionType } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { MixMark } from '../brand/MixMark'
import { PAGE_TEMPLATES, pageOf, type PageTemplate } from '@/core/site'
import { useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { toggleSheet } from './TopBar'

/** The open page's name in the top bar; opens the Pages panel. Hidden while the site has one page and nothing else to say. */
export function PageSwitch() {
  const site = useStore((s) => s.site)
  const page = pageOf(
    site,
    useStore((s) => s.ui.pageId),
  )
  const open = useStore((s) => s.ui.sheet === 'pages')
  return (
    <button
      type="button"
      onClick={() => toggleSheet('pages')}
      aria-expanded={open}
      title="Pages"
      className="flex h-8 items-center gap-1 rounded-lg px-1.5 text-[14px] font-medium text-zinc-500 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
    >
      <FileText size={14} className="text-zinc-400" />
      <span className="max-w-[140px] truncate">{page.title}</span>
      <ChevronDown size={13} className={`text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

/** Every page of the site: open one, rename it, show or hide the shared nav and footer on it, add one from a template. */
export function PagesPanel() {
  const site = useStore((s) => s.site)
  const here = pageOf(
    site,
    useStore((s) => s.ui.pageId),
  )
  const [adding, setAdding] = useState(false)
  return (
    <div className="p-1.5">
      <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-zinc-400">
        <span>Pages</span>
        <span className="font-medium">Nav and footer are shared</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {site.pages.map((p) => (
          <PageRow key={p.id} page={p} open={p.id === here.id} only={site.pages.length === 1} hasNav={!!site.shared.nav} hasFooter={!!site.shared.footer} />
        ))}
      </ul>
      <div className="mx-2.5 my-1 h-px bg-zinc-950/6" />
      {adding ? (
        <AddPage onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium text-zinc-700 transition-[background-color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-[0.97]"
        >
          <Plus size={16} className="text-zinc-500" /> Add page
        </button>
      )}
    </div>
  )
}

function PageRow({ page, open, only, hasNav, hasFooter }: { page: Page; open: boolean; only: boolean; hasNav: boolean; hasFooter: boolean }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const st = useStore.getState
  const run = (name: string, input: Record<string, unknown>) => {
    try {
      runCommand(name, input, 'you')
    } catch (e) {
      st().showFlash(e instanceof Error ? e.message : String(e))
    }
  }
  if (renaming) return <RenameRow page={page} onDone={() => setRenaming(false)} />
  return (
    <li className={`group rounded-lg ${open ? 'bg-zinc-950/[0.05]' : 'hover:bg-zinc-950/[0.03]'}`}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={() => {
            st().openPage(page.id)
            st().setUi({ sheet: 'none' })
          }}
          onDoubleClick={() => setRenaming(true)}
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[13.5px] ${open ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>{page.title}</span>
            {page.path !== '/' && <span className="block truncate font-mono text-[11px] text-zinc-400">{page.path}</span>}
          </span>
        </button>
        {hasNav && (
          <ChromeToggle
            on={page.show.nav}
            icon={PanelTop}
            label={page.show.nav ? 'Hide the site nav on this page' : 'Show the site nav on this page'}
            onClick={() => run('update_page', { page: page.id, nav: !page.show.nav })}
          />
        )}
        {hasFooter && (
          <ChromeToggle
            on={page.show.footer}
            icon={PanelBottom}
            label={page.show.footer ? 'Hide the site footer on this page' : 'Show the site footer on this page'}
            onClick={() => run('update_page', { page: page.id, footer: !page.show.footer })}
          />
        )}
        <button
          type="button"
          title="More"
          aria-label={`More for ${page.title}`}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
      {menu && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <Chip icon={Pencil} label="Rename" onClick={() => (setMenu(false), setRenaming(true))} />
          <Chip
            icon={Copy}
            label="Duplicate"
            onClick={() => {
              setMenu(false)
              st().duplicatePage(page.id)
            }}
          />
          {!only && (
            <Chip
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => {
                setMenu(false)
                run('remove_page', { page: page.id })
                st().showFlash(`Deleted ${page.title}`, { undo: true })
              }}
            />
          )}
        </div>
      )}
    </li>
  )
}

function ChromeToggle({ on, icon: Icon, label, onClick }: { on: boolean; icon: typeof PanelTop; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 active:scale-[0.97] ${on ? 'text-zinc-600' : 'text-zinc-300'}`}
    >
      <Icon size={15} strokeWidth={on ? 2 : 1.75} />
    </button>
  )
}

function Chip({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.08)] transition-[background-color,scale] duration-150 hover:bg-zinc-50 active:scale-[0.97] ${danger ? 'text-red-600' : 'text-zinc-700'}`}
    >
      <Icon size={12} /> {label}
    </button>
  )
}

function RenameRow({ page, onDone }: { page: Page; onDone: () => void }) {
  const [title, setTitle] = useState(page.title)
  const [path, setPath] = useState(page.path)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.select(), [])
  const save = () => {
    if (title.trim() && (title.trim() !== page.title || path !== page.path))
      runCommand(
        'update_page',
        {
          page: page.id,
          title: title.trim(),
          ...(page.path === '/' ? {} : { path }),
        },
        'you',
      )
    onDone()
  }
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') onDone()
  }
  return (
    <li className="flex flex-col gap-1 rounded-lg bg-zinc-950/[0.04] p-1.5">
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={keys}
        aria-label="Page title"
        className="h-8 rounded-md bg-white px-2 text-[13px] font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/15"
      />
      <div className="flex gap-1">
        <input
          value={path}
          disabled={page.path === '/'}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={keys}
          aria-label="Page path"
          title={page.path === '/' ? 'The home page stays at /' : undefined}
          className="h-8 min-w-0 flex-1 rounded-md bg-white px-2 font-mono text-[12px] text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-900/15 disabled:opacity-60"
        />
        <button type="button" onClick={save} className="h-8 cursor-pointer rounded-md bg-zinc-900 px-3 text-[12px] font-semibold text-white transition-[scale] duration-150 active:scale-[0.97]">
          Save
        </button>
      </div>
    </li>
  )
}

/** A new page from a template: its sections are picked to suit it, under the shared nav and footer. */
function AddPage({ onDone }: { onDone: () => void }) {
  const add = (template: PageTemplate) => {
    const t = PAGE_TEMPLATES[template]
    const path = template === 'blank' ? '/new-page' : `/${template}`
    runCommand('add_page', { path, template, ...(template === 'blank' ? { title: t.title } : {}) }, 'you')
    useStore.getState().setUi({ sheet: 'none' })
    onDone()
  }
  return (
    <div className="px-1.5 pb-1">
      <div className="px-1 pb-1.5 pt-1 text-[11px] font-semibold text-zinc-400">Start from</div>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(PAGE_TEMPLATES) as PageTemplate[]).map((k) => {
          const types = PAGE_TEMPLATES[k].types as readonly SectionType[]
          // The page it makes, as the Working mix mark draws a page: shared nav, its sections, shared footer; its main section in pink.
          const page: SectionType[] = ['nav', ...types, 'footer']
          const main = types.length ? page.indexOf(types.find((t) => t !== 'header' && t !== 'cta') ?? types[0]) : null
          return (
            <button
              key={k}
              type="button"
              onClick={() => add(k)}
              title={types.length ? types.map((t) => TYPE_LABEL[t]).join(' · ') : 'Just the nav and footer'}
              className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-white p-2 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.07)] transition-[background-color,box-shadow,scale] duration-150 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_6px_14px_-8px_rgb(0_0_0/0.25)]"
            >
              <MixMark types={page} active={main} edited={false} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-zinc-800">{k === 'blank' ? 'Blank' : PAGE_TEMPLATES[k].title}</span>
                <span className="block truncate text-[11.5px] text-zinc-400">{types.length ? `${types.length} sections` : 'Nav and footer'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
