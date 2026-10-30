import { z } from 'zod'
import { BLOCK_KINDS, MEDIA_PLAY, PLACEHOLDER_STYLES, ENTER_PRESETS } from '../../types'
import { section, block, style, speed, blockMotion, space } from './shared'
import { SHADER_IDS } from '../../treatments/shaders'

const sectionSpace = z.enum(['none', 'tight', 'default', 'roomy'])

/** Phones (≤760px): spacing and hiding that differ from desktop. */
const mobile = z
  .object({
    style: z
      .object({
        padding: space.nullable().optional(),
        above: space.nullable().optional(),
        below: space.nullable().optional(),
        gap: space.nullable().optional(),
      })
      .optional()
      .describe('Spacing on phones; null goes back to the desktop value'),
    hidden: z.boolean().optional().describe('Hide it on phones only; it stays in the markup and the content file'),
  })
  .nullable()
  .describe('Phone widths (760px and below) only. null clears every phone change. Check the result with review (it measures at 1280 and 390).')

/** Commands that change one block, or every block of a kind. */
export const BLOCK_COMMANDS = {
  set_block: {
    description:
      'Change one block: its look (a variant id from get_options, or null for the original), its style and spacing, its motion, or hide it (hidden: everywhere; mobile.hidden: on phones only). mobile sets spacing just for phones. reset clears all changes.',
    input: z.object({
      section,
      block,
      look: z.string().nullable().optional(),
      style: style.optional(),
      motion: blockMotion.optional(),
      hidden: z.boolean().optional(),
      mobile: mobile.optional(),
      reset: z.boolean().optional(),
    }),
    write: true,
  },
  use_look_for_all: {
    description: 'Make a block’s current look and style the default for every block of its kind on the page (e.g. all buttons).',
    input: z.object({ section, block }),
    write: true,
  },
  set_look_for_all: {
    description: 'Set or clear the page-wide default look for a kind of block directly.',
    input: z.object({ kind: z.enum(BLOCK_KINDS), look: z.string().nullable().optional(), style: style.optional(), clear: z.boolean().optional() }),
    write: true,
  },
  set_section_spacing: {
    description: 'A section’s top and bottom padding relative to the style guide, and optionally different on phones (mobile; null goes back to the desktop spacing).',
    input: z.object({
      section,
      top: sectionSpace.optional(),
      bottom: sectionSpace.optional(),
      mobile: z.object({ top: sectionSpace.nullable().optional(), bottom: sectionSpace.nullable().optional() }).nullable().optional(),
    }),
    write: true,
  },
  set_section_surface: {
    description:
      'The band a section sits on, from the style guide’s own colors: page (as it is), soft (the surface color), inverse (light ↔ dark) or brand (the primary color). Alternating bands gives a page rhythm.',
    input: z.object({ section, surface: z.enum(['page', 'soft', 'inverse', 'brand']) }),
    write: true,
  },
  set_image: {
    description:
      'Fill an image block: a placeholder drawn from the palette (it re-themes with the style guide): simple ones (mesh, shapes, arch, waves, grid, portrait) or generative ones with dials (grain-gradient, dither, halftone, topo, flow, blocks, ascii, op-art, marble; see list_treatments surface "fill" for their dials). Or a live WebGL shader (shader: mesh-gradient, grain-flow, dithering, liquid-metal, fluted-glass, god-rays), also from the palette with dials; it moves, and exports ship /mx-shaders.js with a poster for reduced motion and browsers without WebGL. Or remove to go back to the clip’s own art. For a UI mockup use set_mock. Always set alt text for real pictures.',
    input: z.object({
      section,
      block,
      placeholder: z.enum(PLACEHOLDER_STYLES).optional(),
      shader: z.enum(SHADER_IDS).optional().describe('A live WebGL shader instead of a placeholder (list_treatments surface "fill" lists its dials and presets)'),
      preset: z.string().optional().describe('Shaders: a preset id from list_treatments; params given alongside override it'),
      seed: z.number().int().optional().describe('Another seed draws a different version of the same style'),
      params: z.record(z.string(), z.any()).optional().describe('Generative placeholders and shaders: dials by name (list_treatments); colors are palette roles or hex'),
      alt: z.string().optional(),
      fit: z.enum(['cover', 'contain']).optional(),
      remove: z.boolean().optional(),
    }),
    write: true,
  },
  set_media: {
    description:
      'Put moving media in an image block from a link: an .mp4/.webm video, a .lottie/.json animation, or a YouTube/Vimeo page (shows a poster and loads the player on click). Also sets when it plays (autoplay, hover, inview, click, scrub for Lotties), loop and lightbox. Reduced motion never autoplays.',
    input: z.object({
      section,
      block,
      url: z.string().url().optional().describe('Omit to change playback of what’s already there'),
      play: z.enum(MEDIA_PLAY).optional(),
      loop: z.boolean().optional(),
      lightbox: z.boolean().optional(),
      alt: z.string().optional(),
      thumbnail: z.string().url().nullable().optional().describe('An image URL shown before it plays and as the lightbox cover; null goes back to automatic'),
    }),
    write: true,
  },
  set_icon: {
    description:
      'Choose the icon in an icon block by name (see get_options for the names), or null for the clip’s own. It’s drawn in the style guide’s icon set (token icon.set, e.g. "phosphor:duotone"; set it with set_token).',
    input: z.object({ section, block, name: z.string().nullable() }),
    write: true,
  },
  set_section_motion: {
    description: 'A section’s motion: "captured" (as clipped), "none", or "preset" with an entrance, optionally staggering its blocks and playing on scroll.',
    input: z.object({
      section,
      mode: z.enum(['captured', 'preset', 'none']),
      enter: z.enum(ENTER_PRESETS).optional(),
      stagger: z.boolean().optional(),
      on_scroll: z.boolean().optional(),
      speed: speed.optional(),
    }),
    write: true,
  },
  set_link: {
    description:
      'Where a link or button goes. "section": another section on this page (target = section id, position or type; it scrolls there). "page": another page of the site (target "/about"; the packet asks the builder to make it). "url": a web address (new_tab defaults to true). "email" / "phone": mailto and tel. "none": deliberately nowhere. "auto": back to the default, where words that name a section ("Pricing", "FAQ") lead to it.',
    input: z.object({
      section,
      block,
      to: z.enum(['section', 'page', 'url', 'email', 'phone', 'none', 'auto']),
      target: z.string().optional(),
      new_tab: z.boolean().optional(),
    }),
    write: true,
  },
  set_banner: {
    description: 'Navs only: show an announcement banner above the nav (a strip of short messages, a ticker by default) or remove it. Its messages are the notices list (edit_list / set_list); its looks are Inverted, Quiet, Accent and Still (set_block on the banner).',
    input: z.object({ section, on: z.boolean() }),
    write: true,
  },
} as const
