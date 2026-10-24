import type { GuideState } from '@/core/types'
import { api } from './mixSync'

/** A style guide saved to your account, to start a mix from or swap into one. Each mix keeps its own copy. */
export interface SavedGuide {
  id: number
  name: string
  guide: GuideState
  updated_at: string
}

export async function listGuides(): Promise<SavedGuide[]> {
  const res = await api<SavedGuide[]>('GET', '/api/style-guides')
  return res.status === 200 && Array.isArray(res.body) ? res.body : []
}

/** Saving under a name you already use updates that guide. */
export async function saveGuide(name: string, guide: GuideState): Promise<SavedGuide | null> {
  const res = await api<SavedGuide>('POST', '/api/style-guides', { name, guide })
  return res.status === 200 || res.status === 201 ? res.body : null
}

export async function deleteGuide(id: number): Promise<boolean> {
  return (await api('DELETE', `/api/style-guides/${id}`)).status === 204
}
