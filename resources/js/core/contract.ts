// The contract: what you always want kept and where you'd like to be surprised. It's the one thing a skin swap and an
// agent both answer to. Each area is Keep, Tweak or Surprise, plus your own lines; the packet writes it out as CONTRACT.md.
// Pure, so the board, its commands and the exports read the same rules.

import type { TokenGroup, TokenKey } from './types'
import { TOKEN_GROUP_OF } from './tokens'

export const CONTRACT_AREAS = ['color', 'type', 'shape', 'space', 'motion', 'looks', 'sections', 'pictures', 'layout', 'words'] as const
export type ContractArea = (typeof CONTRACT_AREAS)[number]

export const CONTRACT_SETTINGS = ['keep', 'tweak', 'surprise'] as const
export type ContractSetting = (typeof CONTRACT_SETTINGS)[number]

export interface Contract {
  /** Only what differs from Tweak, the default. */
  areas: Partial<Record<ContractArea, ContractSetting>>
  /** Your own lines: "Always keep the two-column hero". */
  keep: string[]
  /** Your own lines: "Surprise me with the footer". */
  surprise: string[]
}

export const AREA_LABEL: Record<ContractArea, { name: string; words: string }> = {
  color: { name: 'Color', words: 'The palette' },
  type: { name: 'Type', words: 'Fonts and the type scale' },
  shape: { name: 'Shape', words: 'Corners, lines, card shadows, icons' },
  space: { name: 'Spacing', words: 'The spacing scale and section padding' },
  motion: { name: 'Motion', words: 'Timing and easing' },
  looks: { name: 'Block looks', words: 'Buttons, cards, badges, text styles and effects' },
  sections: { name: 'Sections', words: 'Bands, backdrops and section motion' },
  pictures: { name: 'Pictures', words: 'What empty pictures show' },
  layout: { name: 'Layout', words: 'Which sections, in what order and arrangement' },
  words: { name: 'Words', words: 'The copy' },
}

export const SETTING_LABEL: Record<ContractSetting, string> = { keep: 'Keep', tweak: 'Tweak', surprise: 'Surprise' }

/** The areas a skin changes. Layout and words are never a skin's business. */
export const STYLE_AREAS = ['color', 'type', 'shape', 'space', 'motion', 'looks', 'sections', 'pictures'] as const satisfies readonly ContractArea[]
export type StyleArea = (typeof STYLE_AREAS)[number]

export const emptyContract = (): Contract => ({ areas: {}, keep: [], surprise: [] })

/** A contract read from anywhere (the server, a mix file, an agent): unknown areas and settings drop, Tweak is left out. */
export function cleanContract(raw: unknown): Contract {
  const c = (raw ?? {}) as Partial<Contract>
  const areas: Contract['areas'] = {}
  for (const area of CONTRACT_AREAS) {
    const v = c.areas?.[area]
    if (v === 'keep' || v === 'surprise') areas[area] = v
  }
  const lines = (x: unknown) => (Array.isArray(x) ? x.filter((l): l is string => typeof l === 'string').map((l) => l.trim()).filter(Boolean) : [])
  return { areas, keep: lines(c.keep), surprise: lines(c.surprise) }
}

export const settingOf = (c: Contract | undefined, area: ContractArea): ContractSetting => c?.areas?.[area] ?? 'tweak'
export const isKept = (c: Contract | undefined, area: ContractArea) => settingOf(c, area) === 'keep'
export const areaOfToken = (key: TokenKey): TokenGroup => TOKEN_GROUP_OF[key]

export const areasSetTo = (c: Contract | undefined, setting: ContractSetting): ContractArea[] => CONTRACT_AREAS.filter((a) => settingOf(c, a) === setting)

export const isEmptyContract = (c: Contract | undefined) => !c || (!Object.keys(c.areas ?? {}).length && !c.keep?.length && !c.surprise?.length)

/** Which areas a command writes to, so an agent hears when the contract says Keep. Commands not named here touch no kept area. */
export function areasOfCommand(name: string, input: Record<string, unknown>): ContractArea[] {
  switch (name) {
    case 'set_token': {
      const group = TOKEN_GROUP_OF[input.key as TokenKey]
      return group ? [group] : []
    }
    case 'add_brand_colour':
    case 'set_tone':
      return ['color']
    case 'set_dial': {
      // Each dial moves a few tokens: spacing and width are space, type and weight are type, roundness is shape.
      const dial = String(input.dial)
      return dial === 'spacing' || dial === 'width' ? ['space'] : dial === 'roundness' ? ['shape'] : ['type']
    }
    case 'set_effect':
    case 'apply_look':
    case 'use_look_for_all':
    case 'set_look_for_all':
    case 'update_text_style':
    case 'set_text_style':
      return ['looks']
    case 'set_block':
      return input.look !== undefined || input.style !== undefined ? ['looks'] : []
    case 'set_section_surface':
    case 'set_section_width':
    case 'set_section_backdrop':
    case 'set_section_spacing':
    case 'set_section_motion':
      return ['sections']
    case 'set_slider':
    case 'add_section':
    case 'swap_section':
    case 'edit_list':
    case 'set_list':
    case 'clip_from_site':
      return ['layout']
    case 'set_words':
    case 'word_options':
      return ['words']
    case 'set_mock':
    case 'set_image':
    case 'set_media':
      return ['pictures']
    case 'use_site_style':
      return [...STYLE_AREAS]
    case 'start_from_starter':
    case 'apply_start':
      return [...STYLE_AREAS, 'layout']
    default:
      return []
  }
}

/** Why an agent can't run a command, in plain words, or null when the contract lets it. */
export function contractRefusal(c: Contract | undefined, name: string, input: Record<string, unknown>): string | null {
  const kept = areasOfCommand(name, input).filter((a) => isKept(c, a))
  if (!kept.length) return null
  const list = kept.map((a) => AREA_LABEL[a].name).join(', ')
  return `The contract says Keep for ${list}, so ${name} can’t change ${kept.length > 1 ? 'them' : 'it'}. Ask whoever owns this mix to set ${kept.length > 1 ? 'those areas' : 'that area'} to Tweak or Surprise first.`
}

const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join('\n')
const areaLine = (a: ContractArea) => `- **${AREA_LABEL[a].name}** (${AREA_LABEL[a].words.toLowerCase()})`

/** The contract as Markdown: what the person wants kept, what they'd like to be surprised by, and what's in between. */
export function contractMarkdown(c: Contract | undefined, skin?: { name: string } | null): string {
  const contract = c ?? emptyContract()
  const keep = areasSetTo(contract, 'keep')
  const surprise = areasSetTo(contract, 'surprise')
  const tweak = areasSetTo(contract, 'tweak')
  const parts = [
    '# Contract',
    '',
    'What the person who made this mix always wants kept, and where they’d like to be surprised. It outranks the defaults in BLOKMIX.md. A section’s own notes and keep settings are more specific and win over it.',
  ]
  if (skin) parts.push('', `The current skin is **${skin.name}**: the style guide’s values in tokens.css come from it, plus any changes made since.`)
  parts.push('', '## Always keep', '', 'Never change these. If the work seems to need it, ask first.', '')
  if (keep.length || contract.keep.length) parts.push(...(keep.length ? [keep.map(areaLine).join('\n')] : []), ...(contract.keep.length ? [bullets(contract.keep)] : []))
  else parts.push('Nothing named yet. Treat everything below as open only to the extent it says.')
  parts.push('', '## Surprise me', '', 'Have a point of view here. Propose something the person wouldn’t have asked for, new values included, and say what you changed and why. Keep it accessible and consistent with the rest of the page.', '')
  if (surprise.length || contract.surprise.length) parts.push(...(surprise.length ? [surprise.map(areaLine).join('\n')] : []), ...(contract.surprise.length ? [bullets(contract.surprise)] : []))
  else parts.push('Nothing named. Don’t add surprises.')
  if (tweak.length) parts.push('', '## Refine within the style guide', '', 'Adjust these freely, using only the tokens in tokens.css.', '', tweak.map(areaLine).join('\n'))
  return `${parts.join('\n')}\n`
}
