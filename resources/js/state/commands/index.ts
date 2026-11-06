import { COMMANDS, toolDefinitions, type CommandName } from '@/core/commands/schema'
import { useCollections } from '../collections'
import { useStore } from '../store'
import { canEdit, useAccount } from '@/lib/account'
import { CommandError, findBlock, findSection } from './refs'
import { TYPE_LABEL } from '@/core/content'
import { PackRefusal, strictly } from '../plan'
import { contractRefusal } from '@/core/contract'
import * as read from './read'
import * as review from './review'
import * as notes from './notes'
import * as versions from './versions'
import * as blocks from './blocks'
import * as words from './words'
import * as pageCmds from './page'
import * as siteCmds from './site'
import * as treatments from './treatments'
import * as collectionCmds from './collections'
import * as libraryCmds from './library'
import * as start from './start'
import * as skins from './skins'
import * as jev from './jev'

export { CommandError, describeNote } from './refs'

const READ = { ...read.read, ...pageCmds.textStyleRead, ...siteCmds.read, ...treatments.read, ...notes.read, ...versions.read, ...collectionCmds.read, ...skins.read }
const WRITE = { ...pageCmds.write, ...siteCmds.write, ...blocks.write, ...treatments.write, ...words.write, ...notes.write, ...versions.write, ...collectionCmds.write, ...skins.write, ...jev.write }

/**
 * Runs the commands in core/commands/schema.ts against the live mix. Every
 * write is validated, goes through the same store actions as the app's own
 * controls, and lands as one undo step, so an agent's change is as easy to
 * take back as yours.
 */
export type Caller = 'you' | 'agent'

/**
 * Commands that need a moment first (measuring a page, composing a packet).
 * `prepare` does the waiting; `apply` then runs like any other command, so a
 * write still lands as one undo step. Their callers get a Promise.
 */
export interface AsyncCommand<P = unknown> {
  prepare: (input: never) => Promise<P>
  apply: (input: never, prepared: P) => unknown
}
// Modules export `later` maps of async commands; merge them here.
const ASYNC: Record<string, AsyncCommand> = { ...review.later, ...versions.later, ...libraryCmds.later, ...start.later, ...jev.later } as Record<string, AsyncCommand>

/** What a viewer can still do: leave and answer marks. */
const MARKS = new Set(['add_note', 'update_note', 'reply_note'])

export function runCommand(name: string, raw: unknown, by: Caller = 'agent'): unknown {
  // An agent hears what needs a mix pack; you get the buy sheet.
  if (by !== 'agent') return run(name, raw, by)
  const refused = (e: unknown) => {
    throw e instanceof PackRefusal ? new CommandError(e.message) : e
  }
  try {
    const out = strictly(() => run(name, raw, by))
    return out instanceof Promise ? out.catch(refused) : out
  } catch (e) {
    return refused(e)
  }
}

function run(name: string, raw: unknown, by: Caller): unknown {
  if (!(name in COMMANDS)) throw new CommandError(`Unknown command "${name}". Known: ${Object.keys(COMMANDS).join(', ')}`)
  const cmd = COMMANDS[name as CommandName]
  const parsed = cmd.input.safeParse(raw ?? {})
  if (!parsed.success) throw new CommandError(`Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`)
  const input = parsed.data as Record<string, unknown>
  // An agent answers to the contract; you own it, so your own controls don't.
  if (cmd.write && by === 'agent') {
    const refusal = contractRefusal(useStore.getState().contract, name, input)
    if (refusal) throw new CommandError(refusal)
    // A locked section is hands off for agents too, apart from leaving marks on it.
    if (input.section !== undefined && !MARKS.has(name) && findSection(input.section as string | number, input.page as string | undefined).locked) {
      throw new CommandError(`This section is locked, so ${name} can’t change it. Leave a note, or ask whoever owns this mix to unlock it.`)
    }
  }
  if (cmd.write && useAccount.getState().archived && !MARKS.has(name))
    throw new CommandError(`This mix is archived: you can leave marks (${[...MARKS].join(', ')}), not ${name}. Its owner can bring it back from the mixes page or the top bar.`)
  if (cmd.write && !canEdit(useAccount.getState().role) && !MARKS.has(name))
    throw new CommandError(`You can view this mix and leave marks (${[...MARKS].join(', ')}), not ${name}. Ask its owner to make you an editor.`)
  const later = ASYNC[name]
  if (later) {
    return later.prepare(input as never).then((prepared) => {
      const apply = () => (by === 'agent' ? strictly(() => later.apply(input as never, prepared)) : later.apply(input as never, prepared))
      return cmd.write ? asOneStep(name, input, by, apply) : apply()
    })
  }
  if (!cmd.write) return READ[name as keyof typeof READ](input as never)
  return asOneStep(name, input, by, () => WRITE[name as keyof typeof WRITE](input as never))
}

/** One undo step for the whole command, however many store updates it makes. */
function asOneStep(name: string, input: Record<string, unknown>, by: Caller, run: () => unknown): unknown {
  // (Notes are part of the undoable state, so an agent's marks are one ⌘Z away too.)
  const t = useStore.temporal.getState()
  const s = useStore.getState()
  const collectionsBefore = useCollections.getState().bySlug
  const before = { site: s.site, guide: s.guide, content: s.content, contract: s.contract, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head }
  // Worded before it runs, so a removed section can still be named.
  const toast = by === 'agent' ? summary(name, input) : ''
  t.pause()
  let result: unknown
  try {
    result = run()
  } finally {
    t.resume()
  }
  const after = useStore.getState()
  if (after.site !== before.site || after.guide !== before.guide || after.content !== before.content || after.contract !== before.contract || after.versions !== before.versions || after.notes !== before.notes) {
    useStore.temporal.setState((x) => ({ pastStates: [...x.pastStates, before].slice(-100), futureStates: [] }))
    if (by === 'agent') after.showFlash(toast, { undo: true })
  } else if (by === 'agent' && useCollections.getState().bySlug !== collectionsBefore) after.showFlash(toast, { undo: 'collections' })
  return result
}

export const tools = toolDefinitions

/** A section in words for a toast ("Pricing", "the About page’s Team"), or null when it can't be found. */
function sectionWord(ref: unknown): string | null {
  if (ref === undefined) return null
  try {
    return TYPE_LABEL[findSection(ref as string | number).type]
  } catch {
    return null
  }
}

/** A block in words ("the button", "the headline"): the last part of its label, lowercased. */
function blockWord(sectionRef: unknown, ref: unknown): string {
  try {
    const label = findBlock(findSection(sectionRef as string | number), String(ref)).label
    return `the ${label.split(' · ').pop()!.toLowerCase()}`
  } catch {
    return 'a block'
  }
}

/**
 * What an agent just did, as a plain sentence with its name: "Claude moved Pricing up", "Claude added a FAQ
 * section", "Claude put your words on the page". Never ids or command names.
 */
export function summary(name: string, input: Record<string, unknown>): string {
  const who = useStore.getState().agent?.name || 'Your agent'
  const sec = sectionWord(input.section)
  const inSec = sec ? ` in ${sec}` : ''
  const said = (() => {
    switch (name) {
      case 'set_block':
        return `restyled ${blockWord(input.section, input.block)}${inSec}`
      case 'set_words':
        return `rewrote the words${inSec}`
      case 'add_block':
        return `added a ${String(input.kind) === 'image' ? 'picture' : String(input.kind)}${inSec}`
      case 'set_brand':
        return `renamed the site ${String(input.name)}`
      case 'set_brand_color':
        return input.color ? 'changed the brand color' : 'forgot the brand color'
      case 'set_logo':
        return input.remove ? 'took the logo away' : 'set the logo'
      case 'word_options':
        return `suggested other words${inSec}`
      case 'add_section':
        return `added a ${TYPE_LABEL[input.type as keyof typeof TYPE_LABEL] ?? 'new'} section`
      case 'remove_section':
        return `removed ${sec ?? 'a section'}`
      case 'move_section':
        return `moved ${sec ?? 'a section'}`
      case 'swap_section':
        return `tried another ${sec ?? 'section'} layout`
      case 'add_page':
        return `added the ${input.path} page`
      case 'add_note':
        return `left a note${sec ? ` on ${sec}` : ''}`
      case 'update_note':
        return `marked note ${String(input.note).replace(/^n/i, '')} ${String(input.status).replace('_', ' ')}`
      case 'reply_note':
        return `replied to note ${String(input.note).replace(/^n/i, '')}`
      case 'edit_list':
      case 'set_list':
        return `changed the list${inSec}`
      case 'set_image':
      case 'set_media':
      case 'set_mock':
        return `changed a picture${inSec}`
      case 'find_subject':
        return `kept the photo’s subject in frame${inSec}`
      case 'set_section_surface':
        return `changed the background${inSec}`
      case 'set_section_backdrop':
        return `put a backdrop behind ${sec ?? 'a section'}`
      case 'set_section_width':
        return `changed how wide ${sec ?? 'a section'} runs`
      case 'set_dial':
        return `turned the ${String(input.dial)} dial`
      case 'set_tone':
        return `made the page ${input.tone}`
      case 'set_token':
        return 'changed the style guide'
      case 'set_palette':
        return 'changed the colors'
      case 'apply_skin':
        return 'put a new skin on'
      case 'surprise_me':
        return 'mixed up the look'
      case 'place_links':
        return 'pointed buttons where their words lead'
      case 'pour_words':
        return 'put your words on the page'
      case 'page_from_words':
        return 'made a page from your words'
      case 'prepare_build':
        return `started building ${input.version}`
      case 'publish':
        return 'published to blok.page'
      case 'unpublish':
        return 'took the page off blok.page'
      case 'report_build':
        return input.done ? `finished building ${input.build}` : input.preview_url ? `put up a preview of ${input.build}` : `${input.step ?? 'updated'} (${input.build})`
      case 'import_review_marks':
        return `brought back ${(input.marks as unknown[]).length} review notes`
      case 'clip_from_site':
        return `clipped ${input.all ? 'a page' : 'sections'} from ${input.site}`
      case 'use_site_style':
        return `added ${input.site}’s look to the style guide`
      case 'apply_start':
        return 'started the page over'
      default:
        return `changed ${sec ?? 'the page'}`
    }
  })()
  return `${who} ${said}`
}
