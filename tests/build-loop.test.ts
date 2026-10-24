import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/state/store'
import { packetInputFor } from '@/lib/packet'
import { agentPrompt, packetJson } from '@/core/export/packet'
import { buildDirName, safeBuildDir, safeBuildPath } from '@/core/commands/bridge'
import { reviewAnchor, reviewStatus } from '@/core/notes'
import { sectionAnchors } from '@/core/links'
import { pageView } from '@/core/site'
import { runCommand } from '@/state/commands'

beforeEach(() => {
  useStore.getState().resetDemo()
  useStore.temporal.getState().clear()
})

/** A saved version and an agent build of it. */
function versionAndBuild() {
  const st = useStore.getState()
  const vid = st.pressVersion()
  const bid = st.startBuild(vid, 'astro')
  st.updateBuild(bid, { by: 'agent' })
  st.setAgent({ versionId: null, step: 0 })
  return { v: useStore.getState().versions[vid], b: useStore.getState().versions[bid] }
}

type Marks = { marks: { id: string; number: string; status: string; on: string; external: { review: string; mark: string } | null; preview?: { width: number; x: number | null } }[] }

describe('packet', () => {
  it('spells out the ReviseMy loop in integrations and the prompt', () => {
    const input = packetInputFor(useStore.getState(), { version: null, targets: ['astro'] })
    const { revisemy } = packetJson(input).integrations
    expect(revisemy).toMatchObject({ after: 'preview', widths: [1440, 390], import: 'import_review_marks' })
    expect(revisemy.loop.join(' ')).toMatch(/prepare_build.*report_build.*create_review.*wait_for_review.*import_review_marks.*resolve_marks/)
    const prompt = agentPrompt(input, 'astro', { build: 'A.1', dir: '/tmp/x' })
    for (const step of ['report_build', 'create_review', 'capture_url', 'wait_for_review', 'import_review_marks', 'resolve_marks', 'update_note']) expect(prompt).toContain(step)
    expect(prompt).toContain('build: "A.1"')
  })
})

describe('bridge paths', () => {
  it('only writes plain relative paths inside the build', () => {
    expect(safeBuildPath('astro/src/pages/index.astro')).toBe('astro/src/pages/index.astro')
    expect(safeBuildPath('BLOKMIX.md')).toBe('BLOKMIX.md')
    for (const bad of ['', '/etc/passwd', '../x', 'a/../../b', 'a/./b', 'a//b', 'a/', 'C:/x', 'a\\b', '~/x', 'a\0b', '..'])
      expect(safeBuildPath(bad), bad).toBeNull()
  })
  it('names build folders by mix and letter', () => {
    expect(buildDirName('Launch Week!', 'B.1')).toBe('launch-week-b-1')
    expect(buildDirName('', 'A')).toBe('blokmix-a')
    expect(safeBuildDir('launch-week-b-1')).toBe('launch-week-b-1')
    for (const bad of ['../x', 'a/b', '.hidden', 'A', '']) expect(safeBuildDir(bad), bad).toBeNull()
  })
})

describe('review marks', () => {
  it('maps anchors: a section, a point, or the page', () => {
    const anchors = { s1: 'hero', s2: 'pricing' }
    expect(reviewAnchor({ id: 1, kind: 'nit', status: 'open', body: '', section: '#pricing' }, 'v', anchors)).toEqual({ kind: 'preview', versionId: 'v', width: 1440, x: -1, y: -1, slotId: 's2' })
    expect(reviewAnchor({ id: 1, kind: 'nit', status: 'open', body: '', x: 0.25, y: 0.5, width: 390, section: 'nope' }, 'v', anchors)).toEqual({ kind: 'preview', versionId: 'v', width: 390, x: 0.25, y: 0.5 })
    expect(reviewAnchor({ id: 1, kind: 'nit', status: 'open', body: '', x: 0.1, y: 0.2, w: 0.3, h: 0.1, section: 'hero' }, 'v', anchors)).toMatchObject({ x: 0.1, y: 0.2, w: 0.3, h: 0.1, slotId: 's1' })
    expect(reviewAnchor({ id: 1, kind: 'nit', status: 'open', body: '' }, 'v', anchors)).toEqual({ kind: 'page' })
  })

  it('keeps statuses one to one, but only a person verifies', () => {
    for (const s of ['open', 'in_progress', 'resolved'] as const) expect(reviewStatus({ kind: 'must-fix', status: s })).toBe(s)
    expect(reviewStatus({ kind: 'nit', status: 'verified' })).toBe('resolved')
    expect(reviewStatus({ kind: 'nit', status: 'verified', verified_by_person: true })).toBe('verified')
    expect(reviewStatus({ kind: 'keep', status: 'open' })).toBe('verified')
  })

  it('imports as notes on the build, upserting by mark id', () => {
    const { b } = versionAndBuild()
    const anchor = sectionAnchors(pageView(b.snapshot.site, null))[pageView(b.snapshot.site, null)[1].id]
    const review = { id: 'R1', url: 'https://revisemy.com/r/abc', status: 'changes_requested' }
    const marks = [
      { id: 23, kind: 'must-fix', status: 'open', body: 'Button is cramped', x: 0.5, y: 0.1, width: 1440, section: anchor },
      { id: 24, kind: 'question', status: 'open', body: 'Is this the final price?', x: 0.3, y: 0.6, width: 390 },
      { id: 25, kind: 'nit', status: 'verified', body: 'Tighten the gap' },
    ]
    const first = runCommand('import_review_marks', { version: b.letter, review, marks }) as { added: unknown[]; updated: unknown[] }
    expect(first.added).toHaveLength(3)
    const st = useStore.getState()
    expect(st.versions[b.id].review).toMatchObject({ tool: 'revisemy', id: 'R1', url: review.url, status: 'changes_requested' })
    const notes = st.notes.filter((n) => n.external?.reviewId === 'R1')
    expect(notes.map((n) => n.status)).toEqual(['open', 'open', 'resolved'])
    expect(notes[0].anchor).toMatchObject({ kind: 'preview', versionId: b.id, width: 1440, slotId: pageView(b.snapshot.site, null)[1].id })
    expect(notes[2].anchor).toEqual({ kind: 'page' })
    expect(notes.every((n) => n.source === 'review')).toBe(true)
    expect(useStore.temporal.getState().pastStates).toHaveLength(1)

    // Running it again updates the same notes.
    runCommand('reply_note', { note: notes[1].id, text: 'Checking with the team' })
    const again = runCommand('import_review_marks', { version: b.id, review: { ...review, status: 'pending' }, marks: [{ ...marks[0], status: 'in_progress' }, marks[1]] }) as { added: unknown[]; updated: unknown[] }
    expect(again.added).toHaveLength(0)
    expect(again.updated).toHaveLength(2)
    const after = useStore.getState().notes.filter((n) => n.external?.reviewId === 'R1')
    expect(after).toHaveLength(3)
    expect(after[0].status).toBe('in_progress')
    expect(after[1].replies).toHaveLength(1)
    expect(after.map((n) => n.number)).toEqual(notes.map((n) => n.number))
  })

  it('echoes ReviseMy ids from list_notes and update_note', () => {
    const { b } = versionAndBuild()
    runCommand('import_review_marks', { version: b.letter, review: { id: 'R2', url: 'https://revisemy.com/r/x' }, marks: [{ id: 7, kind: 'nit', body: 'Too loud', x: 0.2, y: 0.3, width: 390 }] })
    const listed = (runCommand('list_notes', {}) as Marks).marks.find((m) => m.external?.review === 'R2')!
    expect(listed.external).toEqual({ tool: 'revisemy', review: 'R2', mark: '7' })
    expect(listed.preview).toMatchObject({ width: 390, x: 0.2 })
    expect(listed.on).toContain(`${b.letter}’s preview at 390px`)
    const done = runCommand('update_note', { note: listed.id, status: 'resolved', resolution: 'Toned down' }) as { external: unknown; mirror: string }
    expect(done.external).toEqual({ tool: 'revisemy', review: 'R2', mark: '7' })
    expect(done.mirror).toContain('resolve_marks')
  })
})

describe('builds', () => {
  it('lists versions with their builds and open marks', () => {
    const { v, b } = versionAndBuild()
    runCommand('import_review_marks', { version: b.letter, review: { id: 'R3', url: 'https://revisemy.com/r/y' }, marks: [{ id: 1, kind: 'must-fix', body: 'x', x: 0.1, y: 0.1 }] })
    const out = runCommand('list_versions', {}) as { versions: { letter: string; parent: string | null; build: { by: string; target: string } | null; open_marks: number; review: { id: string } | null }[] }
    const build = out.versions.find((x) => x.letter === b.letter)!
    expect(build).toMatchObject({ parent: v.letter, build: { by: 'agent', target: 'astro' }, open_marks: 1, review: { id: 'R3' } })
  })

  it('reports steps, the preview and done', () => {
    const { b } = versionAndBuild()
    runCommand('report_build', { build: b.letter, step: 'Installing' })
    expect(useStore.getState().agent.versionId).toBe(b.id)
    runCommand('report_build', { build: b.letter, preview_url: 'http://localhost:4321', preview_height: { '1440': 5200, '390': 9800 } })
    runCommand('report_build', { build: b.letter, done: true })
    const after = useStore.getState().versions[b.id]
    expect(after.build).toMatchObject({ steps: ['Installing'], previewUrl: 'http://localhost:4321', previewHeight: { '/@1440': 5200, '/@390': 9800 }, done: true })
    expect(after.status).toBe('ready')
    expect(useStore.getState().agent.versionId).toBeNull()
    expect(() => runCommand('report_build', { build: b.letter, preview_url: 'javascript:alert(1)' })).toThrow(/http/)
  })

  it('needs the bridge to prepare a build', async () => {
    const { v } = versionAndBuild()
    await expect(runCommand('prepare_build', { version: v.letter }) as Promise<unknown>).rejects.toThrow(/bridge/)
  })
})

describe('deleting a build', () => {
  it('takes its review marks with it', () => {
    const { b } = versionAndBuild()
    runCommand('import_review_marks', { version: b.letter, review: { id: 'R4', url: 'https://revisemy.com/r/z' }, marks: [{ id: 1, kind: 'nit', body: 'x', x: 0.1, y: 0.1 }] })
    useStore.getState().deleteVersion(b.id)
    expect(useStore.getState().notes.some((n) => n.external?.reviewId === 'R4')).toBe(false)
  })
})
