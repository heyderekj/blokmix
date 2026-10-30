import { z } from 'zod'
import { TOKEN_GROUPS } from '../../types'

const site = z.string().min(1).describe('A site in the site library: its slug ("fernway") or name')

/**
 * The site library: real websites captured offline, each page split into sections matched to Blokmix's built-in
 * layouts. Clipping from it adds the matched layouts (never the site's words or pictures); its look can join the
 * style guide as candidates.
 */
export const LIBRARY_COMMANDS = {
  list_library_sites: {
    description: 'The sites in the site library: name, address, industry, tags, palette, and how many of their sections have a matching layout.',
    input: z.object({
      industry: z.string().optional().describe('Only sites in this industry'),
      query: z.string().optional().describe('Words to match in the name, address, industry and tags'),
    }),
    write: false,
  },
  get_library_site: {
    description:
      'One site in the library: its pages, and each page’s sections in order with their type, the built-in layout they match and whether they can be clipped ("matched"; "needs_layout" has no layout yet).',
    input: z.object({ site }),
    write: false,
  },
  clip_from_site: {
    description:
      'Add a library site’s matched layouts to the mix, in the page’s order, crediting the site (inspiredBy). Never its words or pictures. Pick sections by their order on the page, or all of them; sections with no layout yet are skipped. One undo step.',
    input: z.object({
      site,
      page: z.string().optional().describe('The site’s page: its path ("/pricing"), title or id. Default: its first page'),
      sections: z.array(z.number().int().min(1)).min(1).optional().describe('Sections by their order on the site’s page (get_library_site lists them)'),
      all: z.boolean().optional().describe('Every section of the page that has a layout'),
      at: z.number().int().min(1).optional().describe('Where on the open page (1 = top). Default: after the focused section, else at the end'),
      newPage: z.boolean().optional().describe('Put them on a new page of their own (named after the site’s page)'),
    }),
    write: true,
  },
  use_site_style: {
    description: 'Add a library site’s look to the style guide as candidates (one per group: color, type, shape, space, motion). adopt also makes it win those groups. One undo step.',
    input: z.object({
      site,
      groups: z.array(z.enum(TOKEN_GROUPS)).min(1).optional().describe('Default: every group'),
      adopt: z.boolean().optional(),
    }),
    write: true,
  },
} as const
