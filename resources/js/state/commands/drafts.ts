import { type CommandInput } from '@/core/commands/schema'
import { draftList, versionsOf, type Draft } from '@/core/drafts'
import { allSlots } from '@/core/site'
import { draftBody } from '@/core/drafts'
import { useStore } from '../store'
import { CommandError } from './refs'
import { findVersion } from './versions'

/** A draft by its letter ("B"), its name or id. */
export function findDraft(ref: string): Draft {
  const st = useStore.getState()
  const r = ref.trim().replace(/^draft\s+/i, '').toLowerCase()
  const d = st.drafts[ref] ?? Object.values(st.drafts).find((x) => x.letter.toLowerCase() === r || x.name.toLowerCase() === ref.trim().toLowerCase())
  if (!d) throw new CommandError(`No draft "${ref}". Drafts: ${draftList(st.drafts).map((x) => x.letter).join(', ')}`)
  return d
}

function describeDraft(d: Draft) {
  const st = useStore.getState()
  const body = draftBody(st, d.id)
  const from = d.from?.version ? st.versions[d.from.version]?.letter : d.from?.draft ? st.drafts[d.from.draft]?.letter : null
  return {
    id: d.id,
    letter: d.letter,
    name: d.name,
    open: d.id === st.draftId,
    status: d.status ?? 'in-progress',
    pages: body?.site.pages.map((p) => p.path) ?? [],
    sections: body ? allSlots(body.site).length : 0,
    versions: versionsOf(st.versions, d.id).filter((v) => v.kind === 'snapshot').map((v) => v.letter),
    from: from ?? null,
  }
}

export const read = {
  list_drafts: () => ({ drafts: draftList(useStore.getState().drafts).map(describeDraft) }),
}

export const write = {
  switch_draft: (i: CommandInput<'switch_draft'>) => {
    const d = findDraft(i.draft)
    if (d.id !== useStore.getState().draftId && !useStore.getState().switchDraft(d.id)) throw new CommandError(`Couldn’t open ${d.name}`)
    return describeDraft(useStore.getState().drafts[d.id])
  },
  new_draft: (i: CommandInput<'new_draft'>) => {
    const from = i.from_version ? { version: findVersion(i.from_version).id } : { draft: i.from_draft ? findDraft(i.from_draft).id : undefined }
    const id = useStore.getState().addDraft(from, { name: i.name, open: i.open })
    if (!id) throw new CommandError('No room for another draft in this mix: delete one first.')
    return describeDraft(useStore.getState().drafts[id])
  },
  update_draft: (i: CommandInput<'update_draft'>) => {
    const d = findDraft(i.draft)
    useStore.getState().updateDraft(d.id, { name: i.name, status: i.status })
    return describeDraft(useStore.getState().drafts[d.id])
  },
  delete_draft: (i: CommandInput<'delete_draft'>) => {
    const d = findDraft(i.draft)
    if (!useStore.getState().deleteDraft(d.id)) throw new CommandError('A mix keeps at least one draft.')
    return { deleted: d.letter, drafts: draftList(useStore.getState().drafts).map((x) => x.letter) }
  },
}
