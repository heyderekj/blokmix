import { describe, expect, it } from 'vitest'
import { dfsOrder, letterFor, nextLetter } from '@/core/versions'
import type { VersionNode } from '@/core/types'

const node = (id: string, letter: string, parentId: string | null, createdAt: number) =>
  ({ id, letter, parentId, createdAt }) as VersionNode

describe('version letters', () => {
  it('letters roots A…Z then AA', () => {
    expect([0, 1, 25, 26, 27].map(letterFor)).toEqual(['A', 'B', 'Z', 'AA', 'AB'])
  })

  it('numbers branches under their parent and orders depth-first', () => {
    const v: Record<string, VersionNode> = { a: node('a', 'A', null, 1), b: node('b', 'B', null, 2) }
    expect(nextLetter(v, null)).toBe('C')
    expect(nextLetter(v, 'b')).toBe('B.1')
    v.b1 = node('b1', 'B.1', 'b', 3)
    v.a1 = node('a1', 'A.1', 'a', 4)
    expect(nextLetter(v, 'b')).toBe('B.2')
    expect(dfsOrder(v).map((x) => `${x.node.letter}@${x.depth}`)).toEqual(['A@0', 'A.1@1', 'B@0', 'B.1@1'])
  })
})
