// The font library: a curated set of free fonts, organised by vibe the way
// "Usable Google Fonts" sorts them, from Google Fonts, Fontshare (the Indian
// Type Foundry's free library) and Fontsource (open-source fonts that aren't on
// Google, served by jsDelivr). It includes the open-source families studios
// and tool makers publish (Vercel's Geist, GitHub's Mona Sans and Monaspace,
// IBM Plex, iA Writer…), the ones designers keep recommending. Every one is
// free for commercial use (SIL OFL, or the ITF Free Font License) and loads
// from its provider, on the canvas and in exported sites alike.

import type { FontSource } from './types'

export type FontVibe = 'studio' | 'display' | 'sans' | 'serif' | 'humanist' | 'rounded' | 'mono' | 'script' | 'hand' | 'retro'
export type FontRole = 'display' | 'body' | 'mono'
export type FontProvider = 'google' | 'fontshare' | 'fontsource'

export const VIBES: { id: FontVibe; label: string; hint: string }[] = [
  { id: 'studio', label: 'Studios & open source', hint: 'Families studios and tool makers give away: Geist, Mona Sans, Plex, iA Writer…' },
  { id: 'display', label: 'Interesting display', hint: 'Headlines with character' },
  { id: 'sans', label: 'Sans for body', hint: 'Clean, workhorse text' },
  { id: 'serif', label: 'Serifs', hint: 'Editorial and bookish' },
  { id: 'humanist', label: 'Humanist', hint: 'Warm and friendly' },
  { id: 'rounded', label: 'Rounded', hint: 'Soft and playful' },
  { id: 'mono', label: 'Mono & support', hint: 'Code, labels, data' },
  { id: 'script', label: 'Script', hint: 'Signatures and flourishes; use sparingly' },
  { id: 'hand', label: 'Hand-done', hint: 'Marker, pen and crafty' },
  { id: 'retro', label: 'Retro & web', hint: 'Pixels, bubbles and loud fun' },
]

export interface LibraryFont {
  family: string
  provider: FontProvider
  vibes: FontVibe[]
  /** What it's good for; body fonts also work for headings. */
  role: FontRole
  weights: number[]
  /** Fontshare's or Fontsource's id ("general-sans", "commit-mono"); Google needs none. */
  slug?: string
  /** Who made it, for the studio and open-source families. */
  maker?: string
}

const g = (family: string, vibes: FontVibe[], role: FontRole, weights: number[]): LibraryFont => ({ family, provider: 'google', vibes, role, weights })
const fs = (family: string, slug: string, vibes: FontVibe[], role: FontRole, weights: number[]): LibraryFont => ({ family, provider: 'fontshare', slug, vibes, role, weights })
const src = (family: string, slug: string, vibes: FontVibe[], role: FontRole, weights: number[]): LibraryFont => ({ family, provider: 'fontsource', slug, vibes, role, weights })
const W = (...w: number[]) => w

export const FONT_LIBRARY: LibraryFont[] = [
  // Interesting display
  g('Bricolage Grotesque', ['display'], 'display', W(400, 600, 800)),
  g('Fraunces', ['display', 'serif'], 'display', W(300, 400, 600, 800)),
  g('Instrument Serif', ['display', 'serif'], 'display', W(400)),
  g('DM Serif Display', ['display', 'serif'], 'display', W(400)),
  g('Playfair Display', ['display', 'serif'], 'display', W(400, 600, 800)),
  g('Bodoni Moda', ['display', 'serif'], 'display', W(400, 600, 800)),
  g('Young Serif', ['display', 'serif'], 'display', W(400)),
  g('Gloock', ['display', 'serif'], 'display', W(400)),
  g('Syne', ['display'], 'display', W(400, 600, 800)),
  g('Space Grotesk', ['display', 'sans'], 'display', W(300, 400, 500, 700)),
  g('Unbounded', ['display'], 'display', W(300, 400, 600, 800)),
  g('Big Shoulders Display', ['display'], 'display', W(400, 600, 800)),
  g('Familjen Grotesk', ['display', 'sans'], 'display', W(400, 500, 700)),
  g('Darker Grotesque', ['display'], 'display', W(400, 600, 800)),
  g('Schibsted Grotesk', ['display', 'sans'], 'display', W(400, 600, 800)),
  g('Anton', ['display'], 'display', W(400)),
  g('Archivo Black', ['display'], 'display', W(400)),
  g('Bebas Neue', ['display'], 'display', W(400)),
  g('Oswald', ['display'], 'display', W(300, 400, 600)),
  g('Abril Fatface', ['display', 'serif'], 'display', W(400)),
  g('Krona One', ['display'], 'display', W(400)),
  g('Tilt Warp', ['display', 'rounded'], 'display', W(400)),
  g('Chivo', ['display', 'sans'], 'display', W(300, 400, 700, 900)),
  fs('Clash Display', 'clash-display', ['display'], 'display', W(400, 500, 600, 700)),
  fs('Cabinet Grotesk', 'cabinet-grotesk', ['display'], 'display', W(400, 500, 700, 800)),
  fs('Clash Grotesk', 'clash-grotesk', ['display', 'sans'], 'display', W(400, 500, 600)),
  fs('Zodiak', 'zodiak', ['display', 'serif'], 'display', W(400, 700)),
  fs('Boska', 'boska', ['display', 'serif'], 'display', W(400, 500, 700)),
  fs('Gambarino', 'gambarino', ['display', 'serif'], 'display', W(400)),
  fs('Tanker', 'tanker', ['display'], 'display', W(400)),
  fs('Chillax', 'chillax', ['display', 'rounded'], 'display', W(400, 500, 600)),
  fs('Panchang', 'panchang', ['display'], 'display', W(400, 600, 800)),
  fs('Melodrama', 'melodrama', ['display', 'serif'], 'display', W(400, 600)),
  fs('Bespoke Serif', 'bespoke-serif', ['display', 'serif'], 'display', W(400, 500, 700)),

  // Sans for body
  g('Inter', ['sans'], 'body', W(400, 500, 600, 700)),
  g('Geist', ['sans'], 'body', W(400, 500, 600, 700)),
  g('Manrope', ['sans'], 'body', W(400, 500, 700)),
  g('Plus Jakarta Sans', ['sans'], 'body', W(400, 500, 700)),
  g('DM Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Figtree', ['sans', 'humanist'], 'body', W(400, 500, 700)),
  g('Onest', ['sans'], 'body', W(400, 500, 700)),
  g('Outfit', ['sans', 'display'], 'body', W(400, 500, 700)),
  g('Public Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Work Sans', ['sans'], 'body', W(400, 500, 700)),
  g('IBM Plex Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Instrument Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Albert Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Hanken Grotesk', ['sans'], 'body', W(400, 500, 700)),
  g('Sora', ['sans', 'display'], 'body', W(400, 600, 700)),
  g('Urbanist', ['sans'], 'body', W(400, 500, 700)),
  g('Lexend', ['sans'], 'body', W(400, 500, 700)),
  g('Red Hat Display', ['sans', 'display'], 'body', W(400, 500, 700)),
  g('Archivo', ['sans', 'display'], 'body', W(400, 500, 700, 800, 900)),
  g('Be Vietnam Pro', ['sans'], 'body', W(400, 500, 700)),
  fs('Satoshi', 'satoshi', ['sans'], 'body', W(400, 500, 700)),
  fs('General Sans', 'general-sans', ['sans'], 'body', W(400, 500, 600)),
  fs('Switzer', 'switzer', ['sans'], 'body', W(400, 500, 600)),
  fs('Supreme', 'supreme', ['sans'], 'body', W(400, 500, 700)),
  fs('Synonym', 'synonym', ['sans'], 'body', W(400, 500, 600)),
  fs('Author', 'author', ['sans', 'humanist'], 'body', W(400, 500, 600)),
  fs('Plein', 'plein', ['sans'], 'body', W(400, 500, 700)),

  // Serifs
  g('Newsreader', ['serif'], 'body', W(400, 500, 600)),
  g('Literata', ['serif'], 'body', W(400, 500, 700)),
  g('Source Serif 4', ['serif'], 'body', W(400, 600, 700)),
  g('Lora', ['serif'], 'body', W(400, 500, 700)),
  g('Crimson Pro', ['serif'], 'body', W(400, 500, 700)),
  g('EB Garamond', ['serif'], 'body', W(400, 500, 700)),
  g('Cormorant Garamond', ['serif', 'display'], 'body', W(400, 500, 700)),
  g('Libre Caslon Text', ['serif'], 'body', W(400, 700)),
  g('Libre Baskerville', ['serif'], 'body', W(400, 700)),
  g('Spectral', ['serif'], 'body', W(400, 500, 700)),
  g('Merriweather', ['serif'], 'body', W(400, 700)),
  g('Piazzolla', ['serif'], 'body', W(400, 500, 700)),
  g('Besley', ['serif'], 'body', W(400, 500, 700)),
  g('Gelasio', ['serif'], 'body', W(400, 500, 700)),
  g('Alegreya', ['serif'], 'body', W(400, 500, 700)),
  g('PT Serif', ['serif'], 'body', W(400, 700)),
  fs('Erode', 'erode', ['serif'], 'body', W(400, 500, 600)),
  fs('Sentient', 'sentient', ['serif'], 'body', W(400, 500, 700)),
  fs('Gambetta', 'gambetta', ['serif'], 'body', W(400, 500, 600)),
  fs('Rowan', 'rowan', ['serif'], 'body', W(400, 500, 600)),

  // Humanist
  g('Source Sans 3', ['humanist', 'sans'], 'body', W(400, 600, 700)),
  g('Open Sans', ['humanist', 'sans'], 'body', W(400, 600, 700)),
  g('Fira Sans', ['humanist', 'sans'], 'body', W(400, 500, 700)),
  g('Alegreya Sans', ['humanist'], 'body', W(400, 500, 700)),
  g('Commissioner', ['humanist', 'sans'], 'body', W(400, 500, 700)),
  g('Atkinson Hyperlegible', ['humanist'], 'body', W(400, 700)),
  g('Mulish', ['humanist', 'sans'], 'body', W(400, 600, 700)),
  g('Karla', ['humanist', 'sans'], 'body', W(400, 500, 700)),
  g('Cabin', ['humanist'], 'body', W(400, 500, 700)),

  // Rounded
  g('Nunito', ['rounded'], 'body', W(400, 600, 800)),
  g('Quicksand', ['rounded'], 'body', W(400, 500, 700)),
  g('Varela Round', ['rounded'], 'body', W(400)),
  g('Fredoka', ['rounded', 'display'], 'display', W(400, 500, 600)),
  g('Baloo 2', ['rounded', 'display'], 'display', W(400, 600, 800)),
  g('Comfortaa', ['rounded'], 'display', W(400, 700)),
  g('Rubik', ['rounded', 'sans'], 'body', W(400, 500, 700)),
  fs('Pally', 'pally', ['rounded', 'display'], 'display', W(400, 500, 700)),
  fs('Bonny', 'bonny', ['rounded', 'display'], 'display', W(400, 500, 700)),

  // Mono & support
  g('JetBrains Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('IBM Plex Mono', ['mono'], 'mono', W(400, 500, 600)),
  g('Space Mono', ['mono', 'retro'], 'mono', W(400, 700)),
  g('DM Mono', ['mono'], 'mono', W(400, 500)),
  g('Geist Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Fira Code', ['mono'], 'mono', W(400, 500, 700)),
  g('Martian Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Red Hat Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Azeret Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Spline Sans Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Xanh Mono', ['mono', 'display'], 'mono', W(400)),
  g('Major Mono Display', ['mono', 'retro'], 'display', W(400)),

  // Script
  g('Caveat', ['script', 'hand'], 'display', W(400, 600, 700)),
  g('Dancing Script', ['script'], 'display', W(400, 700)),
  g('Pacifico', ['script', 'retro'], 'display', W(400)),
  g('Allura', ['script'], 'display', W(400)),
  g('Great Vibes', ['script'], 'display', W(400)),
  g('Sacramento', ['script'], 'display', W(400)),
  g('Yellowtail', ['script', 'retro'], 'display', W(400)),
  g('Satisfy', ['script'], 'display', W(400)),
  g('Kaushan Script', ['script'], 'display', W(400)),
  g('Courgette', ['script'], 'display', W(400)),
  g('Rochester', ['script'], 'display', W(400)),
  g('Style Script', ['script'], 'display', W(400)),

  // Hand-done
  g('Kalam', ['hand'], 'display', W(400, 700)),
  g('Gochi Hand', ['hand'], 'display', W(400)),
  g('Patrick Hand', ['hand'], 'display', W(400)),
  g('Shadows Into Light', ['hand'], 'display', W(400)),
  g('Indie Flower', ['hand'], 'display', W(400)),
  g('Reenie Beanie', ['hand'], 'display', W(400)),
  g('Permanent Marker', ['hand'], 'display', W(400)),
  g('Rock Salt', ['hand'], 'display', W(400)),
  g('Gaegu', ['hand', 'rounded'], 'display', W(400, 700)),
  g('Darumadrop One', ['hand', 'retro'], 'display', W(400)),
  g('Hammersmith One', ['hand', 'sans'], 'display', W(400)),

  // Retro & web
  g('VT323', ['retro', 'mono'], 'display', W(400)),
  g('Press Start 2P', ['retro'], 'display', W(400)),
  g('Silkscreen', ['retro'], 'display', W(400, 700)),
  g('Pixelify Sans', ['retro'], 'display', W(400, 600, 700)),
  g('Bagel Fat One', ['retro', 'rounded'], 'display', W(400)),
  g('Monoton', ['retro'], 'display', W(400)),
  g('Bungee', ['retro'], 'display', W(400)),
  g('Slackey', ['retro'], 'display', W(400)),
  g('Fontdiner Swanky', ['retro'], 'display', W(400)),
  g('Lobster', ['retro', 'script'], 'display', W(400)),
  g('Shrikhand', ['retro', 'display'], 'display', W(400)),
  g('Chango', ['retro'], 'display', W(400)),
  g('Bowlby One', ['retro', 'display'], 'display', W(400)),
  g('Rampart One', ['retro'], 'display', W(400)),
  g('Righteous', ['retro', 'display'], 'display', W(400)),

  // Studios & open source: families studios, companies and tool makers publish for everyone
  g('Mona Sans', ['sans', 'display'], 'body', W(400, 500, 700)),
  g('Hubot Sans', ['display', 'sans'], 'display', W(400, 600, 800)),
  g('IBM Plex Serif', ['serif'], 'body', W(400, 500, 700)),
  g('Fira Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Inconsolata', ['mono'], 'mono', W(400, 600, 700)),
  g('Recursive', ['sans', 'mono'], 'body', W(400, 600, 800)),
  g('Overpass', ['sans'], 'body', W(400, 600, 800)),
  g('Overpass Mono', ['mono'], 'mono', W(400, 600)),
  g('Ubuntu Sans', ['sans', 'humanist'], 'body', W(400, 500, 700)),
  g('Ubuntu Sans Mono', ['mono'], 'mono', W(400, 500, 700)),
  g('Source Code Pro', ['mono'], 'mono', W(400, 500, 700)),
  g('DM Serif Text', ['serif'], 'body', W(400)),
  g('Charis SIL', ['serif'], 'body', W(400, 700)),
  g('Gentium Book Plus', ['serif'], 'body', W(400, 700)),
  g('Andada Pro', ['serif'], 'body', W(400, 600, 800)),
  g('STIX Two Text', ['serif'], 'body', W(400, 600, 700)),
  g('Cascadia Code', ['mono'], 'mono', W(400, 600, 700)),
  g('Funnel Display', ['display'], 'display', W(400, 600, 800)),
  g('Funnel Sans', ['sans'], 'body', W(400, 500, 700)),
  g('Host Grotesk', ['sans'], 'body', W(400, 500, 700)),
  src('Commit Mono', 'commit-mono', ['mono'], 'mono', W(400, 700)),
  src('iA Writer Quattro', 'ia-writer-quattro', ['mono', 'sans'], 'body', W(400, 700)),
  src('iA Writer Duo', 'ia-writer-duo', ['mono'], 'mono', W(400, 700)),
  src('Monaspace Neon', 'monaspace-neon', ['mono'], 'mono', W(400, 700)),
  src('Monaspace Argon', 'monaspace-argon', ['mono'], 'mono', W(400, 700)),
  src('Cooper Hewitt', 'cooper-hewitt', ['sans', 'display'], 'body', W(400, 700)),
  src('Geist Pixel', 'geist-pixel', ['retro', 'mono'], 'display', W(400)),
  src('Cal Sans', 'cal-sans', ['display'], 'display', W(400)),
  src('Fragment Mono', 'fragment-mono', ['mono'], 'mono', W(400)),
]

/** Who made the studio and open-source families: the "Studios & open source" collection. */
const MAKERS: Record<string, string> = {
  Inter: 'Rasmus Andersson',
  Geist: 'Vercel',
  'Geist Mono': 'Vercel',
  'Geist Pixel': 'Vercel',
  'Mona Sans': 'GitHub',
  'Hubot Sans': 'GitHub',
  'Monaspace Neon': 'GitHub Next',
  'Monaspace Argon': 'GitHub Next',
  'IBM Plex Sans': 'IBM',
  'IBM Plex Serif': 'IBM',
  'IBM Plex Mono': 'IBM',
  'Fira Sans': 'Mozilla',
  'Fira Mono': 'Mozilla',
  'Fira Code': 'Mozilla',
  'Source Sans 3': 'Adobe',
  'Source Serif 4': 'Adobe',
  'Source Code Pro': 'Adobe',
  Overpass: 'Red Hat',
  'Overpass Mono': 'Red Hat',
  'Red Hat Display': 'Red Hat',
  'Red Hat Mono': 'Red Hat',
  'Ubuntu Sans': 'Canonical',
  'Ubuntu Sans Mono': 'Canonical',
  'Cascadia Code': 'Microsoft',
  'JetBrains Mono': 'JetBrains',
  'iA Writer Quattro': 'iA',
  'iA Writer Duo': 'iA',
  'Commit Mono': 'Eigil Nikolajsen',
  'Cal Sans': 'Cal.com',
  'Cooper Hewitt': 'Cooper Hewitt Museum',
  'Fragment Mono': 'Wei Huang',
  'Work Sans': 'Wei Huang',
  'Public Sans': 'US Web Design System',
  Recursive: 'Arrow Type',
  'Space Grotesk': 'Florian Karsten',
  'Space Mono': 'Colophon',
  'DM Sans': 'Colophon',
  'DM Mono': 'Colophon',
  'DM Serif Text': 'Colophon',
  'DM Serif Display': 'Colophon',
  'Instrument Sans': 'Instrument',
  'Instrument Serif': 'Instrument',
  Literata: 'TypeTogether',
  Spectral: 'Production Type',
  Alegreya: 'Huerta Tipográfica',
  'Alegreya Sans': 'Huerta Tipográfica',
  'Andada Pro': 'Huerta Tipográfica',
  Piazzolla: 'Huerta Tipográfica',
  'Charis SIL': 'SIL',
  'Gentium Book Plus': 'SIL',
  'STIX Two Text': 'STIX',
  'Atkinson Hyperlegible': 'Braille Institute',
  'Funnel Display': 'NONO',
  'Funnel Sans': 'NONO',
  'Host Grotesk': 'Element Type',
  'Bricolage Grotesque': 'Mathieu Triay',
  'Martian Mono': 'Evil Martians',
  Figtree: 'Erik Kennedy',
  Inconsolata: 'Raph Levien',
}
for (const f of FONT_LIBRARY) {
  if (f.provider === 'fontshare') f.maker = 'Indian Type Foundry'
  const m = MAKERS[f.family]
  if (m) {
    f.maker = m
    if (!f.vibes.includes('studio')) f.vibes.unshift('studio')
  }
}

export const PROVIDER_LABEL: Record<FontProvider, string> = { google: 'Google Fonts', fontshare: 'Fontshare', fontsource: 'Fontsource' }
export const PROVIDER_LICENSE: Record<FontProvider, string> = { google: 'SIL Open Font License', fontshare: 'ITF Free Font License', fontsource: 'SIL Open Font License' }

const plus = (s: string) => s.replace(/ /g, '+')

/** The font as the token and loaders know it. */
export function fontSource(f: LibraryFont): FontSource {
  const w = [...f.weights].sort((a, b) => a - b)
  if (f.provider === 'fontshare') return { family: f.family, css2: '', provider: 'fontshare', fontshare: `${f.slug}@${w.join(',')}` }
  if (f.provider === 'fontsource') return { family: f.family, css2: '', provider: 'fontsource', fontsource: `${f.slug}@${w.join(',')}` }
  return { family: f.family, css2: w.length === 1 && w[0] === 400 ? plus(f.family) : `${plus(f.family)}:wght@${w.join(';')}` }
}

export const LIBRARY_FONTS: FontSource[] = FONT_LIBRARY.map(fontSource)

export function findLibraryFont(family: string): LibraryFont | undefined {
  const f = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  return FONT_LIBRARY.find((x) => x.family.toLowerCase() === f)
}

/** A full font stack for a family: the family first, then a fallback that fits its kind. */
export function fontStack(family: string, role: FontRole): string {
  const lib = findLibraryFont(family)
  const kind = lib?.vibes.includes('mono') || role === 'mono' ? 'ui-monospace, monospace' : lib?.vibes.includes('serif') ? 'Georgia, serif' : lib?.vibes.includes('script') || lib?.vibes.includes('hand') ? 'cursive' : 'system-ui, sans-serif'
  return `'${lib?.family ?? family}', ${kind}`
}

/** Search the library. */
export function searchFonts(o: { query?: string; vibe?: FontVibe; role?: FontRole; provider?: FontProvider } = {}): LibraryFont[] {
  const q = o.query?.trim().toLowerCase()
  return FONT_LIBRARY.filter(
    (f) =>
      (!q || f.family.toLowerCase().includes(q)) &&
      (!o.vibe || f.vibes.includes(o.vibe)) &&
      (!o.provider || f.provider === o.provider) &&
      // Body text wants a body (or mono) face; anything goes for headings.
      (!o.role || o.role === 'display' || (o.role === 'mono' ? f.vibes.includes('mono') : f.role !== 'display')),
  )
}
