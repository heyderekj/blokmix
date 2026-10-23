import { describe, expect, it } from 'vitest'
import type { Note } from '@/core/types'
import { workPackets, initialStatus, outstanding, replaceWords } from '@/core/notes'
import { library } from '@/data/library'
import { composePage } from '@/core/compose'
import { emptyGuide, resolveGuide } from '@/core/guide'
import { DEFAULT_CONTENT } from '@/core/content'
import { DEFAULT_KEEP } from '@/core/types'
import { packetFiles } from '@/core/export/packet'

const mark = (n: number, kind: Note['kind'], status: Note['status'], extra: Partial<Note> = {}): Note => ({
  id: `m${n}`,
  number: n,
  text: `note ${n}`,
  color: 'yellow',
  createdAt: n,
  kind,
  status,
  source: 'you',
  author: 'Derek Castelli',
  anchor: { kind: 'block', slotId: 's1', clipId: 'cta.layout-band', blockId: 'b4', label: 'Call to action · Button', quote: 'Get started' },
  ...extra,
})

describe('marks', () => {
  it('keeps start verified and never count as to-do', () => {
    expect(initialStatus('keep')).toBe('verified')
    expect(outstanding(mark(1, 'keep', 'verified'))).toBe(false)
    expect(outstanding(mark(2, 'nit', 'in_progress'))).toBe(true)
  })

  it('buckets work for an agent, must-fix first, dropping verified', () => {
    const wp = workPackets(
      [mark(3, 'nit', 'open'), mark(1, 'must-fix', 'open', { suggestedCopy: 'Start free' }), mark(2, 'must-fix', 'verified'), mark(4, 'keep', 'verified'), mark(5, 'question', 'resolved')],
      [{ slotId: 's1', position: 1, type: 'cta', component: 'CtaLayoutBand', label: 'Call to action' }],
    )
    expect(wp.must_fix.map((w) => w.number)).toEqual(['N1'])
    expect(wp.must_fix[0].on).toBe('Call to action (section 1) · Button')
    expect(wp.nits).toHaveLength(1)
    expect(wp.keeps).toHaveLength(1)
    expect(wp.awaiting_verification.map((w) => w.number)).toEqual(['N5'])
  })

  it('reaches MIXTAPE.md and mixtape.json', () => {
    const guide = resolveGuide(emptyGuide())
    const page = composePage({ slots: [{ id: 's1', type: 'cta', clipId: 'cta.layout-band', locked: false, keep: { ...DEFAULT_KEEP } }], guide, content: DEFAULT_CONTENT, library })
    const files = packetFiles({ page, guide, guideState: emptyGuide(), library, tapeName: 'T', targets: ['astro'], marks: [mark(1, 'must-fix', 'open', { suggestedCopy: 'Start free' })] })
    expect(files['MIXTAPE.md']).toContain('## Feedback')
    expect(files['MIXTAPE.md']).toContain('Use exactly: “Start free”')
    expect(JSON.parse(files['mixtape.json']).work_packets.must_fix[0].number).toBe('N1')
  })
})

describe('changing selected words', () => {
  it('replaces a phrase whatever the spacing, and says when it isn’t there', () => {
    expect(replaceWords('Clip the web. Mix your site.', 'Mix  your\nsite.', 'Remix it all.')).toBe('Clip the web. Remix it all.')
    expect(replaceWords('Price (per month)', '(per month)', 'monthly')).toBe('Price monthly')
    expect(replaceWords('Clip the web.', 'Mix', 'x')).toBeNull()
  })
})
