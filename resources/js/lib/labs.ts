import { create } from 'zustand'

/**
 * Labs: designs being tried before they replace the real thing (local only,
 * /labs/*). Each switch picks which version a part of the app draws.
 */
export type GuideVariant = 'now' | 'a' | 'b' | 'c' | 'd'
export const useLabs = create<{ guide: GuideVariant }>()(() => ({ guide: 'now' }))
