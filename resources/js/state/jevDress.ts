// Dress it up, on the board: what suits a section from Blokmix's own treatments, as
// ordinary commands (set_section_backdrop, set_mock) that preview on hover and land as
// one undo step. On Free they show a lock and open the buy sheet, like any treatment.

import { treatmentList, lookList, MOCK_IDS, mockSource } from '@/core/treatments'
import { backdropShaderId } from '@/core/treatments/backdrops'
import { skinById } from '@/core/skins'
import { toneOfGuide } from '@/core/dials'
import { resolveGuide } from '@/core/guide'
import { backdropCandidates, dressRequest, readDress, type DressBrief, type Dressed } from '@/core/jev/dress'
import { KIND_WORDS } from '@/core/jev/vocab'
import { slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { currentSlots, useStore } from './store'
import { wordsFor } from './commands/refs'
import { paid } from './plan'

export interface DressIdea {
  label: string
  command: string
  input: Record<string, unknown>
  /** Needs a mix pack, and this mix's owner is on Free. */
  locked: boolean
  fit: number
}

/** Ideas for one section: up to three backgrounds, and a product screen for its empty picture. */
export async function dressSection(slotId: string, feel?: string): Promise<{ ideas: DressIdea[]; dressed: Dressed } | null> {
  const st = useStore.getState()
  const slots = currentSlots(st)
  const slot = slots.find((s) => s.id === slotId)
  if (!slot) return null
  const clip = slotClip(slot)
  const words = wordsFor(slot)
  const text = clip.blocks
    .filter((b) => (b.kind === 'heading' || b.kind === 'text' || b.kind === 'badge') && b.field && words[b.field])
    .map((b) => words[b.field!])
    .slice(0, 4)
    .join(' · ')
  const liveElsewhere = slots.some((s) => s.id !== slot.id && !!backdropShaderId(s.backdrop))
  const cands = backdropCandidates(treatmentList(), liveElsewhere)
  const empty = clip.blocks.find((b) => b.kind === 'image' && !slot.edits?.[slot.clipId]?.[b.id]?.media && !(b.media ?? '').startsWith('logo'))
  const skin = st.guide.skin?.id ? skinById(st.guide.skin.id) : null
  const brief: DressBrief = {
    type: slot.type,
    words: text,
    site: st.content.kind ? `${st.content.brand}, ${KIND_WORDS[st.content.kind]}` : st.content.brand,
    look: skin?.words,
    tone: toneOfGuide(resolveGuide(st.guide).tokens) === 'dark' ? 'dark' : 'light',
    feel,
    mocks: empty ? MOCK_IDS.map((id) => ({ id, label: mockSource(id)?.label ?? id, hint: mockSource(id)?.hint ?? '' })) : undefined,
  }
  const res = await askJev(dressRequest(brief, cands), { timeoutMs: 6000 })
  if (!res) return null
  const dressed = readDress(res, cands)
  const locked = !paid()
  const ideas: DressIdea[] = dressed.backdrops.map((b) => ({ label: b.label, command: 'set_section_backdrop', input: { section: slot.id, backdrop: b.treatment, preset: b.preset }, locked, fit: b.fit }))
  if (dressed.mock && empty) ideas.push({ label: `${mockSource(dressed.mock.id)?.label ?? dressed.mock.id} screen in the picture`, command: 'set_mock', input: { section: slot.id, block: empty.id, mock: dressed.mock.id }, locked, fit: dressed.mock.p })
  return { ideas, dressed }
}

/** The whole page's effects: the curated look that suits the site and the feel. */
export async function dressPage(feel?: string): Promise<DressIdea | null> {
  const st = useStore.getState()
  const looks = lookList()
  if (!looks.length) return null
  const hero = currentSlots(st).find((s) => s.type === 'hero')
  const brief: DressBrief = {
    type: 'hero',
    words: hero ? Object.values(wordsFor(hero)).slice(0, 3).join(' · ') : '',
    site: st.content.kind ? `${st.content.brand}, ${KIND_WORDS[st.content.kind]}` : st.content.brand,
    tone: toneOfGuide(resolveGuide(st.guide).tokens) === 'dark' ? 'dark' : 'light',
    feel,
    looks,
  }
  const res = await askJev(dressRequest(brief, []), { timeoutMs: 6000 })
  const d = readDress(res, [])
  const look = d.look && looks.find((l) => l.id === d.look!.id)
  return look ? { label: `${look.label} effects`, command: 'apply_look', input: { look: look.id }, locked: !paid(), fit: d.look!.p } : null
}
