import { z } from 'zod'
import { PAGE_TEMPLATES, type PageTemplate } from '../../site'

export const page = z.string().describe('A page: its path ("/about"), title ("About") or id. Default: the page open on the canvas')

/** The site's pages. The nav and footer are shared by every page; each page can hide them. */
export const SITE_COMMANDS = {
  rename_mix: { description: 'Rename the mix (the name on the board, your mixes list and exports).', input: z.object({ name: z.string().trim().min(1).max(120) }), write: true },
  list_pages: {
    description: 'List the site’s pages in order: path, title, how many sections, and whether each shows the shared nav and footer. Which page is open on the canvas.',
    input: z.object({}),
    write: false,
  },
  add_page: {
    description:
      'Add a page and open it. A template fills it with sections that suit it (about, contact, pricing, blog); blank starts empty. It shows the shared nav and footer unless you say otherwise.',
    input: z.object({
      path: z.string().describe('"/about"; made unique if taken'),
      title: z.string().optional(),
      template: z.enum(Object.keys(PAGE_TEMPLATES) as [PageTemplate, ...PageTemplate[]]).optional(),
      nav: z.boolean().optional().describe('Show the shared nav (default true)'),
      footer: z.boolean().optional().describe('Show the shared footer (default true)'),
    }),
    write: true,
  },
  update_page: {
    description: 'Rename a page, change its path, or show or hide the shared nav and footer on it.',
    input: z.object({ page, title: z.string().min(1).optional(), path: z.string().optional(), nav: z.boolean().optional(), footer: z.boolean().optional() }),
    write: true,
  },
  remove_page: { description: 'Delete a page and its own sections. The last page can’t be removed.', input: z.object({ page }), write: true },
  move_page: { description: 'Move a page in the site’s order (1 = first).', input: z.object({ page, to: z.number().int().min(1) }), write: true },
} as const
