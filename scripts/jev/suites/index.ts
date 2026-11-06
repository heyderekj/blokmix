// The bench's suites, one per thing Jev decides. Each loads labelled cases, builds the same
// request the board or a script would, and judges the answers.

import type { JevRequest, JevResponse } from '../../../resources/js/core/jev'
import type { Judged } from '../metrics'
import { types } from './types'

export interface Suite<C = unknown> {
  name: string
  load: () => Promise<C[]>
  request: (c: C) => JevRequest | Promise<JevRequest>
  judge: (c: C, res: JevResponse | null) => Judged[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each suite has its own case type
export const SUITES: Suite<any>[] = [types]
