import { create } from 'zustand'
import { useAccount } from '@/lib/account'

/**
 * Free to make, $30 a site when you ship it (docs/pricing.md). Everything on the board is free; shipping is what's
 * paid for, once per mix: downloading its code (blokmix.json, BLOKMIX.md, tokens, Astro, Next.js) and handing a version
 * to an agent. `useAccount` `ships` says whether the open mix can: it's paid for, its owner has Plus from before, Blokmix
 * is on its waitlist, or there's no Laravel. After paying, every version and export of it is free.
 */
export const ships = () => useAccount.getState().ships

/** The buy sheet, open when someone tries to ship a mix that isn't paid for. `what` names the step ("Downloading the files"). */
export const useBuySheet = create<{ open: boolean; what: string | null }>()(() => ({ open: false, what: null }))

/** True when the open mix can ship; otherwise opens the buy sheet for `what` and returns false. */
export function canShip(what: string): boolean {
  if (ships()) return true
  useBuySheet.setState({ open: true, what })
  return false
}

/** Why an agent can't ship the open mix (null when it can), with how to pay. */
export function shipRefusal(): string | null {
  if (ships()) return null
  const { price } = useAccount.getState()
  return `This mix isn’t paid for yet, so it can’t be exported or built. Making it is free; shipping it is $${price} a site, once. Someone who can edit it pays from Export on the board, and then every version and export of it is free.`
}
