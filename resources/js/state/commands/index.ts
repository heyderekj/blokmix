import { COMMANDS, toolDefinitions, type CommandName } from '@/core/commands/schema'
import { useCollections } from '../collections'
import { useStore } from '../store'
import { canEdit, useAccount } from '@/lib/account'
import { CommandError } from './refs'
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

export { CommandError, describeNote } from './refs'

const READ = { ...read.read, ...siteCmds.read, ...treatments.read, ...notes.read, ...versions.read, ...collectionCmds.read }
const WRITE = { ...pageCmds.write, ...siteCmds.write, ...blocks.write, ...treatments.write, ...words.write, ...notes.write, ...versions.write, ...collectionCmds.write }

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
const ASYNC: Record<string, AsyncCommand> = { ...review.later, ...versions.later, ...libraryCmds.later, ...start.later } as Record<string, AsyncCommand>

/** What a viewer can still do: leave and answer marks. */
const MARKS = new Set(['add_note', 'update_note', 'reply_note'])

export function runCommand(name: string, raw: unknown, by: Caller = 'agent'): unknown {
  if (!(name in COMMANDS)) throw new CommandError(`Unknown command "${name}". Known: ${Object.keys(COMMANDS).join(', ')}`)
  const cmd = COMMANDS[name as CommandName]
  const parsed = cmd.input.safeParse(raw ?? {})
  if (!parsed.success) throw new CommandError(`Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`)
  const input = parsed.data as Record<string, unknown>
  if (cmd.write && !canEdit(useAccount.getState().role) && !MARKS.has(name))
    throw new CommandError(`You can view this mix and leave marks (${[...MARKS].join(', ')}), not ${name}. Ask its owner to make you an editor.`)
  const later = ASYNC[name]
  if (later) {
    return later.prepare(input as never).then((prepared) => {
      const apply = () => later.apply(input as never, prepared)
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
  const before = { site: s.site, guide: s.guide, content: s.content, versions: s.versions, notes: s.notes, branchFrom: s.branchFrom, head: s.head }
  t.pause()
  let result: unknown
  try {
    result = run()
  } finally {
    t.resume()
  }
  const after = useStore.getState()
  if (after.site !== before.site || after.guide !== before.guide || after.content !== before.content || after.versions !== before.versions || after.notes !== before.notes) {
    useStore.temporal.setState((x) => ({ pastStates: [...x.pastStates, before].slice(-100), futureStates: [] }))
    if (by === 'agent') after.showFlash(`Agent: ${summary(name, input)}`, { undo: true })
  } else if (by === 'agent' && useCollections.getState().bySlug !== collectionsBefore) after.showFlash(`Agent: ${summary(name, input)}`, { undo: 'collections' })
  return result
}

export const tools = toolDefinitions

function summary(name: string, input: Record<string, unknown>): string {
  const sec = input.section !== undefined ? ` ${input.section}` : ''
  switch (name) {
    case 'set_block':
      return String(input.block).includes(' · ') ? `changed ${input.block}` : `changed ${input.block}${sec ? ` in${sec}` : ''}`
    case 'set_words':
      return `rewrote${sec}`
    case 'add_section':
      return `added a ${input.type}`
    case 'add_page':
      return `added ${input.path}`
    case 'add_note':
      return `left a ${String(input.kind).replace('-', ' ')} note${sec ? ` on${sec}` : ''}`
    case 'update_note':
      return `marked N${String(input.note).replace(/^n/i, '')} ${String(input.status).replace('_', ' ')}`
    case 'prepare_build':
      return `started building ${input.version}`
    case 'report_build':
      return input.done ? `finished ${input.build}` : input.preview_url ? `put ${input.build}’s preview up` : `${input.build}: ${input.step ?? 'updated'}`
    case 'import_review_marks':
      return `brought back ${(input.marks as unknown[]).length} review marks`
    case 'clip_from_site':
      return `clipped ${input.all ? 'a page' : 'sections'} from ${input.site}`
    case 'use_site_style':
      return `added ${input.site}’s look to the style guide`
    case 'apply_start':
      return `started over from a ${input.vibe} start`
    case 'reply_note':
      return `replied on N${String(input.note).replace(/^n/i, '')}`
    default:
      return `${name.replace(/_/g, ' ')}${sec}`
  }
}
