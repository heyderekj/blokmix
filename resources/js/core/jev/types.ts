// Jev (TypeSafe's System One model) as Blokmix speaks to it: one state, many typed
// questions, answered in parallel. The wire format is TypeSafe's own
// (https://api.typesafe.ai/openapi.json, POST /v1/systemone); nothing here calls it.
//
// Jev never writes. It picks one of the options we give it, rates something on a
// rubric we wrote, says how likely a statement is, or boxes a thing in a picture.
// That is the whole contract: Blokmix only ever places, picks and checks real things.

/** What an option means: a plain line, or what it covers, what it isn't, and examples. */
export type Criterion = string | null | { what: string; not_for?: string; examples?: string[]; [key: string]: unknown }

/** A question's wording: a sentence, or the sentence with the context it needs in named fields. */
export type Instructions = string | Record<string, unknown>

export interface ChoiceQuestion {
  type: 'choice'
  instructions: Instructions
  /** Option name → what it means. The names are what comes back. At most 255. */
  criteria: Record<string, Criterion>
}

export interface ScoreQuestion {
  type: 'score'
  instructions: Instructions
  /** Levels, lowest first; the answer's score is their probability-weighted position. At most 10. */
  criteria: (string | Record<string, unknown>)[]
}

export interface NoulQuestion {
  type: 'noul'
  instructions: Instructions
  criteria?: { true?: Criterion; false?: Criterion }
}

export interface BoxQuestion {
  type: 'box'
  instructions: Instructions
}

export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion | BoxQuestion

/** An image, written into the state or a question by its reference (an opaque, unique string). */
export interface JevAsset {
  type: 'image'
  format: 'jpg' | 'png'
  data_base64: string
}

export type JevModel = 'jev-latest' | 'jev-preview'

export interface JevRequest {
  /** jev-preview for Box questions. */
  model?: JevModel
  state: unknown
  questions: Record<string, Question>
  assets?: Record<string, JevAsset>
}

export interface ChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export interface ScoreAnswer {
  type: 'score'
  score: number
  confidence: number
  legend: Record<string, unknown>
  /** Keyed by level index as a string ("0", "1"…). */
  probabilities: Record<string, number>
}

export interface NoulAnswer {
  type: 'noul'
  noul: number
}

export interface BoxAnswer {
  type: 'box'
  box: { top: number; bottom: number; left: number; right: number }
  confidence: number | null
}

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer | BoxAnswer

export interface JevResponse {
  model: string
  answers: Record<string, Answer>
  usage: { input_tokens: number; output_tokens: number }
}

/** What a request needs from the server: images or Box questions need TypeSafe's opt-in header. */
export function needsImages(req: Pick<JevRequest, 'questions' | 'assets'>): boolean {
  return !!(req.assets && Object.keys(req.assets).length) || Object.values(req.questions).some((q) => q.type === 'box')
}
