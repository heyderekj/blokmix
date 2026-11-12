import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { pickable } from '@/core/library'
import { skinList } from '@/core/skins'
import { currentSlots, useStore } from '@/state/store'
import { runCommand } from '@/state/commands'
import { canShip, shipRefusal, useBuySheet } from '@/state/shipping'
import { useAccount } from '@/lib/account'

// Free to make, $30 a site when you ship it (state/shipping.ts, docs/pricing.md).
const unpaid = () => useAccount.setState({ ships: false, price: 30 })

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})
afterEach(() => {
  useAccount.setState({ ships: true })
  useBuySheet.setState({ open: false, what: null })
})

describe('making is free', () => {
  it('offers every layout and theme to a mix that isn’t paid for', () => {
    unpaid()
    const layouts = library.layoutsByType.hero.filter((id) => !library.clips[id].status)
    expect(layouts.length).toBeGreaterThan(3)
    for (const id of layouts) expect(pickable(library, 'hero')).toContain(id)
    expect(useStore.getState().applySkin(skinList().find((s) => s.id !== 'wireframe')!.id)).toBe(true)
  })

  it('lets every control, effect and backdrop through, for you and for agents', () => {
    unpaid()
    const st = useStore.getState
    st().chooseToken('radius.base', { kind: 'custom', value: '2px' })
    expect(st().guide.choices['radius.base']).toBeTruthy()
    st().setEffect('grain', { id: 'grain' })
    expect(st().guide.effects?.grain).toBeTruthy()
    const hero = currentSlots(st()).find((s) => s.type === 'hero')!
    const other = pickable(library, 'hero').find((id) => id !== hero.clipId && library.clips[id].origin === 'layout')!
    runCommand('swap_section', { section: hero.id, clip_id: other })
    expect(currentSlots(st()).find((s) => s.id === hero.id)!.clipId).toBe(other)
    runCommand('set_effect', { effect: 'glow' })
    expect(st().guide.effects?.glow).toBeTruthy()
    expect(useBuySheet.getState().open).toBe(false)
  })
})

describe('shipping', () => {
  it('goes straight through on a mix that ships', () => {
    expect(canShip('Downloading the files')).toBe(true)
    expect(shipRefusal()).toBeNull()
    expect(useBuySheet.getState().open).toBe(false)
  })

  it('opens the buy sheet on a mix that isn’t paid for', () => {
    unpaid()
    expect(canShip('Downloading the files')).toBe(false)
    expect(useBuySheet.getState()).toMatchObject({ open: true, what: 'Downloading the files' })
  })

  it('tells an agent why a build is refused, and how to pay', async () => {
    unpaid()
    runCommand('save_version', { title: 'First' })
    const before = Object.keys(useStore.getState().versions).length
    await expect(runCommand('prepare_build', { version: 'A' }) as Promise<unknown>).rejects.toThrow(/isn’t paid for yet.*\$30 a site, once.*Export/)
    // Nothing started, and the sheet is for people, not agents.
    expect(Object.keys(useStore.getState().versions).length).toBe(before)
    expect(useBuySheet.getState().open).toBe(false)
  })

  it('lets an agent build a mix that ships (paid, Plus or the waitlist: the server says which)', async () => {
    runCommand('save_version', { title: 'First' })
    // Past the paywall it needs the MCP bridge, which tests don't have.
    await expect(runCommand('prepare_build', { version: 'A' }) as Promise<unknown>).rejects.toThrow(/MCP bridge/)
  })
})
