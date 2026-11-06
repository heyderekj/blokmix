import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, Trash2, X } from 'lucide-react'
import { api, useSave } from '@/lib/mixSync'
import { useStore } from '@/state/store'
import type { MixRole } from '@/lib/account'

interface Member {
  id: number
  name: string
  email: string
  role: MixRole
  you: boolean
}
interface ShareLink {
  id: number
  role: 'editor' | 'viewer'
  url: string
}

const ROLE_LABEL: Record<MixRole, string> = { owner: 'Owner', editor: 'Can edit', viewer: 'Can view' }
const ROLE_HINT: Record<MixRole, string> = { owner: 'Shares and deletes', editor: 'Changes anything', viewer: 'Looks and leaves notes' }

/** Who's in this mix, and links that bring more people in. Only the owner changes either. */
export function SharePanel() {
  const mixId = useSave((s) => s.mixId)
  const [members, setMembers] = useState<Member[]>([])
  const [links, setLinks] = useState<ShareLink[]>([])
  const [owner, setOwner] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const flash = (t: string) => useStore.getState().showFlash(t)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await api<{ members: Member[]; links: ShareLink[]; can_share: boolean }>('GET', `/api/mixes/${mixId}/share`)
      if (res.status === 200) {
        setMembers(res.body.members)
        setLinks(res.body.links)
        setOwner(res.body.can_share)
        setLoaded(true)
        return
      }
    } catch {
      // Offline, or the server didn't answer: say so rather than load forever.
    }
    setFailed(true)
  }, [mixId])
  useEffect(() => void load(), [load])

  if (mixId === 'local')
    return <p className="px-4 py-5 text-[13px] text-pretty text-zinc-500">This mix lives only in this browser. Save it to your mixes (on the Mixes page) to share it.</p>

  const makeLink = async (role: ShareLink['role']) => {
    const res = await api<ShareLink>('POST', `/api/mixes/${mixId}/share/links`, { role })
    if (res.status === 201) {
      setLinks((l) => [res.body, ...l])
      void copy(res.body.url)
    }
  }
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied')
    } catch {
      flash('Couldn’t copy. Click the link to select it, then copy.')
    }
  }
  const revoke = async (l: ShareLink) => {
    const res = await api('DELETE', `/api/mixes/${mixId}/share/links/${l.id}`)
    if (res.status === 204) setLinks((x) => x.filter((y) => y.id !== l.id))
  }
  const setRole = async (m: Member, role: MixRole) => {
    const res = await api('PATCH', `/api/mixes/${mixId}/share/members/${m.id}`, { role })
    if (res.status === 200) setMembers((x) => x.map((y) => (y.id === m.id ? { ...y, role } : y)))
  }
  const remove = async (m: Member) => {
    const res = await api('DELETE', `/api/mixes/${mixId}/share/members/${m.id}`)
    if (res.status === 204) {
      setMembers((x) => x.filter((y) => y.id !== m.id))
      flash(`Removed ${m.name}`)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      {owner && (
        <section>
          <h3 className="px-1 pb-1.5 text-[11px] font-semibold text-zinc-400">Invite with a link</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(['editor', 'viewer'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void makeLink(r)}
                className="flex cursor-pointer flex-col items-start rounded-xl bg-white px-3 py-2 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.07)] transition-[background-color,scale] duration-150 active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-50"
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-800">
                  <Link2 size={13} /> {ROLE_LABEL[r]}
                </span>
                <span className="text-[11px] text-zinc-400">{ROLE_HINT[r]}</span>
              </button>
            ))}
          </div>
          {links.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.id} className="flex items-center gap-1.5 rounded-lg bg-zinc-950/[0.03] py-1 pl-2.5 pr-1">
                  <span className="shrink-0 text-[11.5px] font-semibold text-zinc-600">{ROLE_LABEL[l.role]}</span>
                  <input
                    readOnly
                    value={l.url}
                    title={l.url}
                    aria-label={`${ROLE_LABEL[l.role]} link`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-500 outline-none"
                  />
                  <IconBtn label="Copy link" onClick={() => void copy(l.url)}>
                    <Copy size={13} />
                  </IconBtn>
                  <IconBtn label="Turn this link off" onClick={() => void revoke(l)}>
                    <X size={13} />
                  </IconBtn>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h3 className="px-1 pb-1.5 text-[11px] font-semibold text-zinc-400">People</h3>
        {failed ? (
          <p className="flex items-center gap-2 px-1 text-[12.5px] text-zinc-500">
            Couldn’t reach Blokmix to see who’s here.
            <button type="button" onClick={() => void load()} className="cursor-pointer font-medium text-zinc-900 underline underline-offset-2 active:scale-[0.97]">
              Try again
            </button>
          </p>
        ) : !loaded ? (
          <p className="px-1 text-[12.5px] text-zinc-400">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-key-soft text-[12px] font-bold text-key-ink">{initials(m.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-900">
                    {m.name}
                    {m.you && <span className="font-normal text-zinc-400"> (you)</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-zinc-400">{m.email}</span>
                </span>
                {owner && !m.you ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => void setRole(m, e.target.value as MixRole)}
                      aria-label={`${m.name}’s role`}
                      className="h-8 cursor-pointer rounded-lg bg-zinc-950/[0.04] px-2 text-[12px] font-medium text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15"
                    >
                      {(['owner', 'editor', 'viewer'] as const).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <IconBtn label={`Remove ${m.name}`} onClick={() => void remove(m)}>
                      <Trash2 size={13} />
                    </IconBtn>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-[12px] text-zinc-500">
                    {m.role === 'owner' && <Check size={12} />}
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {loaded && !owner && <p className="mt-2 px-1 text-[12px] text-zinc-400">Only the owner can invite people or change roles.</p>}
      </section>
    </div>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition-[background-color,color,scale] duration-150 hover:bg-zinc-950/5 hover:text-zinc-800 active:scale-[0.97]"
    >
      {children}
    </button>
  )
}
