import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { packetInputFor } from '@/lib/packet'
import { packetFiles } from '@/core/export/packet'
import { describeEdit } from '@/core/export/describe'
import { timeoutFor } from '@/core/commands/bridge'
import { onSection, slotOf } from '@/core/notes'
import { COMMANDS } from '@/core/commands/schema'
import { runCommand } from '@/state/commands'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

describe('seams for mobile, builds and pages', () => {
  it('builds a packet from the store without the export panel', () => {
    const st = useStore.getState()
    const files = packetFiles(packetInputFor(st, { version: null, targets: ['astro'] }))
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['blokmix.json', 'BLOKMIX.md', 'astro/package.json']))
    const v = st.versions[st.head!]
    const fromVersion = packetInputFor(st, { version: v, targets: ['next'] })
    expect(fromVersion.version?.letter).toBe(v.letter)
  })

  it('keeps every command reachable after the split', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThanOrEqual(32)
    for (const name of Object.keys(COMMANDS)) expect(() => runCommand(name, '__not an object__' as never)).toThrow(/Invalid input|Unknown/)
  })

  it('gives slow commands more time over the bridge', () => {
    expect(timeoutFor('prepare_build')).toBe(120_000)
    expect(timeoutFor('get_page')).toBe(15_000)
  })

  it('keeps marks on a build’s preview off the mix’s sections', () => {
    const preview = { kind: 'preview' as const, versionId: 'v1', width: 390, x: 0.5, y: 0.2, slotId: 's1' }
    expect(slotOf(preview)).toBe('s1')
    expect(onSection(preview)).toBeUndefined()
    expect(onSection({ kind: 'block', slotId: 's1', clipId: 'c', blockId: 'b0', label: 'x' })).toBe('s1')
  })

  it('describes block changes in words', () => {
    expect(describeEdit({ hidden: true })).toBe('hidden; leave it out')
    expect(describeEdit({ variant: 'outline' })).toContain('outline look')
  })
})
