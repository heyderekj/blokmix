// Pictures that fit, on the board: find a photo's subject and keep it in frame, and put
// stock results that fit the section's words first.

import type { MediaFill, Slot, StockPhoto } from '@/core/types'
import { imageRef } from '@/core/jev'
import { focusFrom, jevPhotoUrl, jevThumbUrl, rankRequest, rankedOrder, subjectRequest, type PhotoBrief } from '@/core/jev/photos'
import { KIND_WORDS } from '@/core/jev/vocab'
import { skinById } from '@/core/skins'
import { slotClip } from '@/data/library'
import { askJev } from '@/lib/jev'
import { assetUrl } from '@/lib/assets'
import { boxOnPicture, toJevJpeg } from '@/lib/jevImage'
import { useStore } from './store'
import { wordsFor } from './commands/refs'
import { allSlots } from '@/core/site'

/** A photo fill's picture as something Jev can read, or null (placeholders, moving media). */
function pictureOf(fill: MediaFill | undefined): string | null {
  if (!fill) return null
  if (fill.source === 'upload' && fill.asset) return assetUrl(fill.asset) ?? null
  if (fill.source === 'stock' && fill.stock) return jevPhotoUrl(fill.stock)
  return null
}

const sameFill = (a: MediaFill | undefined, b: MediaFill | undefined) => !!a && !!b && a.source === b.source && a.asset === b.asset && a.stock?.id === b.stock?.id

/** Where the subject of this picture is, or null when Jev is off, unsure, or there's no single subject. */
export async function findFocus(fill: MediaFill | undefined): Promise<{ x: number; y: number; kind: string } | null> {
  const src = pictureOf(fill)
  if (!src) return null
  const img = await toJevJpeg(src, 1024)
  if (!img) return null
  const ref = imageRef('photo')
  const res = await askJev(subjectRequest(ref, img.asset))
  return focusFrom(res, (b) => boxOnPicture(b, img.inner))
}

const fillOf = (slotId: string, blockId: string) => {
  const slot = allSlots(useStore.getState().site).find((s) => s.id === slotId)
  return slot?.edits?.[slot.clipId]?.[blockId]?.media
}

/**
 * After you pick a photo: find its subject in the background and keep it in frame. Folded into the pick's own undo
 * step (history paused), and only if the block still shows that photo and nobody set a focus meanwhile.
 */
export async function autoFocus(slotId: string, blockId: string): Promise<void> {
  const picked = fillOf(slotId, blockId)
  if (!picked || picked.focus || !pictureOf(picked)) return
  const focus = await findFocus(picked)
  const now = fillOf(slotId, blockId)
  if (!focus || !now || now.focus || !sameFill(now, picked)) return
  const t = useStore.temporal.getState()
  t.pause()
  try {
    useStore.getState().editBlock(slotId, blockId, { media: { ...now, focus: { x: focus.x, y: focus.y } } })
  } finally {
    t.resume()
  }
}

/** What a section is about, for judging photos against: its words, the kind of site and the skin's mood. */
export function photoBrief(slot: Slot, query?: string): PhotoBrief {
  const st = useStore.getState()
  const clip = slotClip(slot)
  const words = wordsFor(slot)
  const text = clip.blocks
    .filter((b) => (b.kind === 'heading' || b.kind === 'text' || b.kind === 'badge') && b.field && words[b.field])
    .map((b) => words[b.field!])
    .slice(0, 4)
    .join(' · ')
  const skin = st.guide.skin?.id ? skinById(st.guide.skin.id) : null
  return { words: text, site: st.content.kind ? `${st.content.brand}, ${KIND_WORDS[st.content.kind]}` : st.content.brand, look: skin?.words, query }
}

/** Stock results with the best fit for this section first (Unsplash's order when Jev is off or slow). */
export async function rankPhotos<P extends StockPhoto>(photos: P[], brief: PhotoBrief): Promise<{ photos: P[]; ranked: boolean }> {
  const take = photos.slice(0, 18)
  const imgs = await Promise.all(take.map((p) => toJevJpeg(jevThumbUrl(p))))
  const refs: string[] = []
  const assets: Record<string, NonNullable<Awaited<ReturnType<typeof toJevJpeg>>>['asset']> = {}
  const index: number[] = []
  imgs.forEach((img, i) => {
    if (!img) return
    const ref = imageRef(`p${i}`)
    refs.push(ref)
    assets[ref] = img.asset
    index.push(i)
  })
  if (!refs.length) return { photos, ranked: false }
  const res = await askJev(rankRequest(brief, refs, assets), { timeoutMs: 6000 })
  if (!res) return { photos, ranked: false }
  const { order } = rankedOrder(res, refs.length)
  const rankedTaken = order.map((k) => take[index[k]])
  const unrated = take.filter((_, i) => !index.includes(i))
  return { photos: [...rankedTaken, ...unrated, ...photos.slice(18)], ranked: true }
}
