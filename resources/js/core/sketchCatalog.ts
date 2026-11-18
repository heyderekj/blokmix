import type { SamplePhoto } from './types'

export const SKETCH_IDS = ['bread-counter', 'pottery-shelf', 'trail-map', 'print-edition', 'balance-book', 'day-ticket'] as const
export type SketchId = (typeof SKETCH_IDS)[number]
export const isSketch = (id?: string): id is SketchId => SKETCH_IDS.some((v) => v === id)
export const SKETCH_MODES = ['image', 'ui', 'combined'] as const
export type SketchMode = (typeof SKETCH_MODES)[number]
export const MODE_LABEL = { image: 'Image', ui: 'Stylized UI', combined: 'Image + UI' }
export const SKETCH_LABEL = {
  'bread-counter': 'Bakery counter', 'pottery-shelf': 'Pottery shop', 'trail-map': 'Trail guide',
  'print-edition': 'Print studio', 'balance-book': 'Budget planner', 'day-ticket': 'Event pass',
}

export const SKETCH_PHOTO: Partial<Record<SketchId, SamplePhoto>> = {
  'bread-counter': 'bakery', 'pottery-shelf': 'ceramics', 'trail-map': 'mountain-trail', 'print-edition': 'print-studio',
}
