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
 * `ships`: the mix can be exported and built (state/shipping.ts): it's paid for, its owner has Plus from before, or
 * Blokmix is on its waitlist; always without Laravel.
 * `archived`: the mix is archived, so everyone sees it as a viewer until its owner (`owns`) brings it back.
 * `buy`: whether paying for a site is open here now, at `price` dollars.
 */
export const useAccount = create<{ user: Account | null; role: MixRole; ships: boolean; archived: boolean; owns: boolean; buy: boolean; price: number }>()(() => ({
  user: null,
  role: 'owner',
  ships: true,
  archived: false,
  owns: true,
  buy: false,
  price: 30,
}))

export const canEdit = (role: MixRole) => role !== 'viewer'
