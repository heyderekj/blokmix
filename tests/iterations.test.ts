import { z } from 'zod'
import returnWire from '../resources/schemas/agent-return.json'
import recipeWire from '../resources/schemas/layout-recipe.json'
import { recipeSchema, sampleRecipe, addSharedRecipe } from '@/core/iterations'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyControl, layoutClip, returnSchema, type Bundle } from '@/core/iterations'
import { useStore } from '@/state/store'
import { blankMix } from '@/state/seed'
import { library } from '@/data/library'
import { decideReturn, handoffPacket, newMixFromReturn, reviewReturn, sendChanges, stageReturn } from '@/lib/iterations'
import { updateSlotIn } from '@/core/site'
import { packetInputFor } from '@/lib/packet'
import { packetFiles } from '@/core/export/packet'

const pricing = {
  format: 'blokmix.return/v1',
  id: '942f1456-105d-4635-83a9-114dbda2a007',
  agent: 'Studio AI',
  summary: 'Added billing periods',
  changes: [
    {
      kind: 'add',
      page: '/',
      section: 'pricing_new',
      words: { heading: 'Plans' },
      recipe: {
        title: 'Billing options',
        type: 'pricing',
        layout: { rows: [[{ kind: 'heading', field: 'heading' }], [{ kind: 'text', field: 't1Price' }]] },
        controls: [
          {
            kind: 'toggle',
            label: 'Annual billing',
            options: [
              { label: 'Monthly', words: { t1Price: '$20 monthly' } },
              { label: 'Annual', words: { t1Price: '$200 annually' } },
            ],
          },
        ],
      },
    },
  ],
} satisfies Bundle

beforeEach(() => {
  useStore.getState().openMixData(blankMix('Studio'))
})

describe('agent iterations', () => {
  it('keeps hosted validation in sync with local commands', () => {
    expect(z.toJSONSchema(returnSchema, { io: 'input', reused: 'ref' })).toEqual(returnWire)
    expect(z.toJSONSchema(recipeSchema, { io: 'input', reused: 'ref' })).toEqual(recipeWire)
  })
  it('sends A, receives while B is open, checks pricing, sends visual edits and resolves a competing second return', async () => {
    await sendChanges()
    const first = useStore.getState().head!,
      draft = useStore.getState().draftId
    const bundle = { ...pricing, base: first }
    const other = useStore.getState().addDraft()!
    useStore.getState().switchDraft(other)
    stageReturn(bundle)
    stageReturn(bundle)
    expect(useStore.getState().versions[first].returns).toHaveLength(1)
    expect(useStore.getState().site.pages[0].slots).toHaveLength(0)
    useStore.getState().switchDraft(draft)
    decideReturn(first, bundle.id, new Set([0]))
    const accepted = useStore.getState().head!
    expect(useStore.getState().versions[accepted].letter).toBe('A2')
    const slot = useStore.getState().site.pages[0].slots[0]
    useStore.setState((s) => ({ site: updateSlotIn(s.site, slot.id, (x) => applyControl(x, pricing.changes[0].recipe.controls[0], 1)) }))
    await sendChanges()
    const v = useStore.getState().versions[useStore.getState().head!]
    expect(v.letter).toBe('A3')
    const packet = handoffPacket(v)
    expect(packet.previous).toBe(first)
    expect(packet.changes.some((c) => c.after === '$200 annually')).toBe(true)
    expect(v.snapshot.site.pages[0].slots[0].recipe).toEqual(slot.recipe)
    const files = packetFiles(packetInputFor(useStore.getState(), { version: v, targets: ['astro', 'next'] }))
    for (const target of ['astro', 'next'])
      expect(Object.entries(files).some(([k, val]) => k.includes(target) && k.includes('content/') && String(val).includes('$200 annually'))).toBe(
        true,
      )
    const second: Bundle = {
      ...bundle,
      id: crypto.randomUUID(),
      base: v.id,
      changes: [{ kind: 'word', section: slot.id, field: 'heading', value: 'Agent plans' }],
    }
    useStore.getState().setWord(slot.id, 'heading', 'My plans')
    stageReturn(second)
    expect(reviewReturn(v, second).rows[0]).toMatchObject({ conflict: true, here: 'My plans', incoming: 'Agent plans' })
    decideReturn(v.id, second.id, new Set([0]))
    expect(useStore.getState().site.pages[0].slots[0].words?.heading).toBe('Agent plans')
    useStore.temporal.getState().undo()
    expect(useStore.getState().site.pages[0].slots[0].words?.heading).toBe('My plans')
    expect(useStore.getState().versions[v.id].returns?.[0].status).toBe('pending')
    expect(useStore.getState().versions[first].snapshot.site.pages[0].slots).toHaveLength(0)
  })
  it('prepares sample words for curation and uses the next mix’s own pricing', () => {
    const sample = sampleRecipe(pricing.changes[0].recipe)
    expect(JSON.stringify(sample)).not.toContain('$200 annually')
    const mix = newMixFromReturn(pricing)
    const snapshot = mix.versions[mix.data.head].snapshot
    snapshot.content.fields.pricing = { heading: 'Our membership plans', t1Price: '$9' }
    const result = addSharedRecipe(snapshot, '/', 'anotherSection', sample, library)
    expect(result.site.pages[0].slots[0].words).toMatchObject({ heading: 'Our membership plans', t1Price: '$9' })
    expect(result.site.pages[0].slots[0].recipe?.controls).toHaveLength(1)
  })
  it('starts a mix from a portable return and rebuilds a versioned native layout', () => {
    const mix = newMixFromReturn(pricing)
    expect(mix.versions[mix.data.head].returns?.[0].bundle.base).toBe(mix.data.head)
    const clip = layoutClip(pricing.changes[0].recipe, library)
    expect(clip.blocks.map((b) => b.kind)).toContain('heading')
    expect(() => layoutClip({ ...pricing.changes[0].recipe, layout: { rows: [[{ kind: 'text', field: 'imaginary' }]] } }, library)).toThrow()
    expect(returnSchema.safeParse({ ...pricing, preview: 'javascript:alert(1)' }).success).toBe(false)
  })
})
