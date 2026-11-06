// Building questions. Keep each one atomic: one judgment a knowledgeable person could
// make in a few seconds. Several judgments go in several questions, combined in code.

import type { BoxQuestion, ChoiceQuestion, Criterion, Instructions, NoulQuestion, ScoreQuestion } from './types'

export const choice = (instructions: Instructions, criteria: Record<string, Criterion>): ChoiceQuestion => ({ type: 'choice', instructions, criteria })

export const score = (instructions: Instructions, levels: ScoreQuestion['criteria']): ScoreQuestion => ({ type: 'score', instructions, criteria: levels })

export const noul = (instructions: Instructions, criteria?: NoulQuestion['criteria']): NoulQuestion => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) })

export const box = (instructions: Instructions): BoxQuestion => ({ type: 'box', instructions })

/** A path into the state, written the way Jev reads it: in backticks. */
export const at = (path: string) => `\`${path}\``
