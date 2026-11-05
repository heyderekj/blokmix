// The commands anyone can run on a mix: the app's own controls, a prompt, or an
// agent over MCP. Pure zod, so the MCP bridge can list them without the app.
//
// Sections are referred to by id, by position (1 = top) or by type ("pricing") on
// the open page (or the one `page` names), by anchor, or as "/about#team".
// Blocks are referred to by id ("b3") or by label ("Pricing · Plan 2 · Button").

import { z } from 'zod'
import { PAGE_COMMANDS } from './page'
import { BLOCK_COMMANDS } from './blocks'
import { NOTE_COMMANDS } from './notes'
import { VERSION_COMMANDS } from './versions'
import { SITE_COMMANDS } from './site'
import { TREATMENT_COMMANDS } from './treatments'
import { COLLECTION_COMMANDS } from './collections'
import { LIBRARY_COMMANDS } from './library'
import { START_COMMANDS } from './start'
import { SKIN_COMMANDS } from './skins'

export const COMMANDS = { ...PAGE_COMMANDS, ...SITE_COMMANDS, ...BLOCK_COMMANDS, ...TREATMENT_COMMANDS, ...NOTE_COMMANDS, ...VERSION_COMMANDS, ...COLLECTION_COMMANDS, ...LIBRARY_COMMANDS, ...START_COMMANDS, ...SKIN_COMMANDS } as const

export type CommandName = keyof typeof COMMANDS
export type CommandInput<N extends CommandName> = z.infer<(typeof COMMANDS)[N]['input']>

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** The commands as tool definitions (MCP and the Claude API use the same shape). */
export function toolDefinitions(): ToolDefinition[] {
  return (Object.entries(COMMANDS) as [CommandName, (typeof COMMANDS)[CommandName]][]).map(([name, c]) => ({
    name,
    description: c.description,
    input_schema: z.toJSONSchema(c.input) as Record<string, unknown>,
  }))
}
