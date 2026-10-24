import { create } from 'zustand'

export type MixRole = 'owner' | 'editor' | 'viewer'
export interface Account {
  id: number
  name: string
  email: string
}

/**
 * Who's signed in (when Laravel serves the board) and what they can do with the
 * open mix. Without Laravel there's no account and you own the mix in this browser.
 */
export const useAccount = create<{ user: Account | null; role: MixRole }>()(() => ({ user: null, role: 'owner' }))

export const canEdit = (role: MixRole) => role !== 'viewer'
