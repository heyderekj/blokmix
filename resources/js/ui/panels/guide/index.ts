import type { ComponentType } from 'react'
import type { GuideVariant } from '@/lib/labs'
import { GuideSpecimen } from './GuideSpecimen'
import { GuideDesk } from './GuideDesk'
import { GuideBoard } from './GuideBoard'
import { GuideDecisions } from './GuideDecisions'

/** Style guide directions being tried in labs (/labs/style-guide). */
export const GUIDE_VARIANTS: Record<Exclude<GuideVariant, 'now'>, ComponentType> = {
  a: GuideSpecimen,
  b: GuideDesk,
  c: GuideBoard,
  d: GuideDecisions,
}

export const GUIDE_VARIANT_LABEL: Record<GuideVariant, string> = {
  now: 'Now',
  a: 'A · Specimen',
  b: 'B · Mixing desk',
  c: 'C · Board',
  d: 'D · Decisions first',
}
