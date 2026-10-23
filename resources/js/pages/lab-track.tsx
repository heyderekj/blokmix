import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Lock, LockOpen, MoreHorizontal, Palette, PanelsTopLeft, Sparkles, Trash2, Type, Waves } from 'lucide-react'
import type { Keep, Slot, TokenGroup } from '@/core/types'
import { TOKEN_GROUPS } from '@/core/types'
import { TYPE_LABEL } from '@/core/content'
import { GROUP_LABEL, primaryFamily } from '@/core/tokens'
import { library } from '@/data/library'
import { useStore } from '@/state/store'

/**
 * Design exploration: four directions for the track pill and its details.
 * Brief: stronger hierarchy, more visual simplicity. Open with ?lab=track.
 */
export default function LabTrack() {
  const slot = useStore((s) => s.slots[0])
  const theme = useStore((s) => s.ui.theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  if (!slot) return null
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--canvas-bg)' }}>
      <div className="mx-auto max-w-[1280px] px-8 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Track pill: four directions</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Brief: stronger hierarchy and visual simplicity. Each starts opened; click its bar (or ⋯ in B) to see it at rest. They use the live tape, so the toggles really change your first track.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <Variant letter="A" name="Quiet label, one drawer" notes="The bar only says what the track is. Everything you can do lives in the drawer, grouped under three plain headings.">
            <VariantA slot={slot} />
          </Variant>
          <Variant letter="B" name="Icon keeps" notes="Keep toggles become four icons that are always visible. The drawer is reduced to one decision: borrow this look.">
            <VariantB slot={slot} />
          </Variant>
          <Variant letter="C" name="Cassette label" notes="Mixtape’s own: a numbered spine in the key pink anchors the eye. The drawer is a short list of rows, like liner notes.">
            <VariantC slot={slot} />
          </Variant>
          <Variant letter="D" name="Two tiers" notes="Name and source on the left, controls on the right, with one strong action. Details are tabs, so the card never gets tall.">
            <VariantD slot={slot} />
          </Variant>
        </div>
      </div>
    </div>
  )
}

function Variant({ letter, name, notes, children }: { letter: string; name: string; notes: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-zinc-950/5">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-[12px] font-bold text-white">{letter}</span>
        <h2 className="text-[15px] font-semibold text-zinc-900">{name}</h2>
      </div>
      <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">{notes}</p>
      {/* a stand-in page behind the pill */}
      <div className="relative min-h-[540px] overflow-hidden rounded-xl bg-[#f6f1e7] p-3 ring-1 ring-zinc-950/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[#111]" />
        <div className="pointer-events-none absolute left-6 top-28 font-serif text-[40px] leading-none text-[#1f1a14]/80">Clip the web.</div>
        <div className="relative">{children}</div>
      </div>
    </section>
  )
}

function useTrack(slot: Slot) {
  const clip = library.clips[slot.clipId]
  const source = library.sources[clip.sourceId]
  const ids = library.byType[slot.type]
  const index = useStore((s) => s.slots.findIndex((x) => x.id === slot.id))
  const count = useStore((s) => s.slots.length)
  return { clip, source, pos: ids.indexOf(slot.clipId) + 1, total: ids.length, index, count, st: useStore.getState }
}

const KEEPS: { key: keyof Keep; label: string; icon: typeof Type; on: string; off: string }[] = [
  { key: 'layout', label: 'Layout', icon: PanelsTopLeft, on: 'Reproduce this structure', off: 'Reference only' },
  { key: 'style', label: 'Style', icon: Palette, on: 'Its own look', off: 'Your style guide' },
  { key: 'content', label: 'Copy', icon: Type, on: 'Source copy', off: 'Your copy' },
  { key: 'motion', label: 'Motion', icon: Waves, on: 'Keep motion', off: 'Static' },
]

/* ---------- A. Quiet label, one drawer ---------- */

function VariantA({ slot }: { slot: Slot }) {
  const t = useTrack(slot)
  const [open, setOpen] = useState(true)
  return (
    <div className="glass-panel w-[400px] overflow-hidden rounded-2xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-11 w-full items-center gap-2.5 px-3 text-left">
        <span className="text-[14px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
        <span className="text-[13px] text-zinc-500">{t.source.name}</span>
        <span className="ml-auto text-[12px] tabular-nums text-zinc-400">
          {t.pos} of {t.total}
        </span>
        {slot.locked && <Lock size={13} className="text-key-ink" />}
        <ChevronDown size={15} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-zinc-950/6 p-3">
          <div>
            <div className="eyebrow mb-2">Keep from this clip</div>
            <div className="grid grid-cols-2 gap-1.5">
              {KEEPS.map((k) => {
                const on = slot.keep[k.key]
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => t.st().toggleKeep(slot.id, k.key)}
                    className={`flex items-center gap-2 rounded-xl p-2 text-left transition ${on ? 'bg-lift shadow-sm ring-1 ring-zinc-950/5' : 'bg-well'}`}
                  >
                    <span className={`grid size-4 place-items-center rounded-[5px] border ${on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300'}`}>{on && '✓'}</span>
                    <span>
                      <span className={`block text-[13px] font-medium ${on ? 'text-zinc-900' : 'text-zinc-500'}`}>{k.label}</span>
                      <span className="block text-[11px] text-zinc-500">{on ? k.on : k.off}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Its look</div>
            <button type="button" onClick={() => t.st().adoptClipDesign(t.clip.id)} className="btn-lit flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold">
              <Sparkles size={14} /> Use {t.source.name.split(' ')[0]}’s look for the whole page
            </button>
          </div>
          <div className="flex items-center gap-1 border-t border-zinc-950/6 pt-2.5 text-[12px] text-zinc-500">
            <span className="truncate">{t.clip.capture.url.replace('https://', '')}</span>
            <span className="ml-auto flex items-center gap-0.5">
              <SmallBtn label="Move up" onClick={() => t.st().moveSlot(slot.id, t.index - 1)} disabled={t.index === 0}>
                <ArrowUp size={14} />
              </SmallBtn>
              <SmallBtn label="Move down" onClick={() => t.st().moveSlot(slot.id, t.index + 1)} disabled={t.index === t.count - 1}>
                <ArrowDown size={14} />
              </SmallBtn>
              <SmallBtn label={slot.locked ? 'Unlock' : 'Lock'} onClick={() => t.st().toggleLock(slot.id)}>
                {slot.locked ? <Lock size={14} /> : <LockOpen size={14} />}
              </SmallBtn>
              <SmallBtn label="Remove track" onClick={() => {}}>
                <Trash2 size={14} />
              </SmallBtn>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- B. Icon keeps ---------- */

function VariantB({ slot }: { slot: Slot }) {
  const t = useTrack(slot)
  const [open, setOpen] = useState(true)
  const [groups, setGroups] = useState<TokenGroup[]>(['color', 'type'])
  return (
    <div className="w-fit space-y-2">
      <div className="glass-panel flex h-11 items-center gap-1 rounded-full pl-3.5 pr-1.5">
        <span className="text-[14px] font-semibold text-zinc-900">{TYPE_LABEL[slot.type]}</span>
        <span className="pl-1 pr-2 text-[13px] text-zinc-500">{t.source.name}</span>
        <div className="flex items-center gap-0.5 rounded-full bg-well p-0.5">
          {KEEPS.map((k) => {
            const on = slot.keep[k.key]
            return (
              <button
                key={k.key}
                type="button"
                title={`${k.label}: ${on ? k.on : k.off}`}
                aria-pressed={on}
                onClick={() => t.st().toggleKeep(slot.id, k.key)}
                className={`grid size-7 place-items-center rounded-full transition ${on ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
              >
                <k.icon size={14} />
              </button>
            )
          })}
        </div>
        <SmallBtn label={slot.locked ? 'Unlock' : 'Lock'} onClick={() => t.st().toggleLock(slot.id)} active={slot.locked}>
          {slot.locked ? <Lock size={14} /> : <LockOpen size={14} />}
        </SmallBtn>
        <SmallBtn label="More" onClick={() => setOpen((o) => !o)} active={open}>
          <MoreHorizontal size={15} />
        </SmallBtn>
      </div>
      {open && (
        <div className="glass-panel w-[360px] rounded-2xl p-3">
          <div className="text-[13px] font-semibold text-zinc-900">Borrow {t.source.name.split(' ')[0]}’s look</div>
          <p className="mb-3 text-[12px] text-zinc-500">Pick what this clip lends your style guide.</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {TOKEN_GROUPS.map((g) => {
              const on = groups.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroups((x) => (on ? x.filter((y) => y !== g) : [...x, g]))}
                  className={`h-7 rounded-full px-3 text-[12px] font-medium transition ${on ? 'bg-zinc-900 text-white' : 'bg-chip text-zinc-600'}`}
                >
                  {GROUP_LABEL[g]}
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => t.st().adoptClipDesign(t.clip.id, groups)} className="btn-lit flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold">
            <Sparkles size={14} /> Use these
          </button>
          <div className="mt-3 flex items-center justify-between text-[11.5px] text-zinc-400">
            <span>{t.clip.capture.url.replace('https://', '')}</span>
            <button type="button" className="hover:text-problem">
              Remove track
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- C. Cassette label ---------- */

function VariantC({ slot }: { slot: Slot }) {
  const t = useTrack(slot)
  const [open, setOpen] = useState(true)
  const off = KEEPS.filter((k) => !slot.keep[k.key])
  return (
    <div className="glass-panel w-[400px] overflow-hidden rounded-2xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-stretch text-left">
        <span className="grid w-12 shrink-0 place-items-center bg-key text-[15px] font-bold tabular-nums text-key-ink">{String(t.index + 1).padStart(2, '0')}</span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
          <span className="text-[14px] font-semibold leading-tight text-zinc-900">
            {TYPE_LABEL[slot.type]} <span className="font-normal text-zinc-400">·</span> <span className="font-medium text-zinc-600">{t.source.name}</span>
          </span>
          <span className="truncate text-[12px] text-zinc-500">{off.length ? `Your ${off.map((k) => k.off.replace('Your ', '').toLowerCase()).join(', ')}` : 'Kept exactly as clipped'}</span>
        </span>
        <span className="flex items-center gap-1 pr-2.5 text-[12px] tabular-nums text-zinc-400">
          {t.pos}/{t.total}
          {slot.locked && <Lock size={13} className="text-zinc-700" />}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-zinc-950/6 border-t border-zinc-950/6">
          {KEEPS.map((k) => (
            <Row key={k.key} label={k.label} hint={slot.keep[k.key] ? k.on : k.off}>
              <Toggle on={slot.keep[k.key]} onClick={() => t.st().toggleKeep(slot.id, k.key)} />
            </Row>
          ))}
          <Row label="Its look" hint={`${primaryFamily(t.clip.tokens['font.display'])}, ${t.clip.tokens['color.primary']}`}>
            <button type="button" onClick={() => t.st().adoptClipDesign(t.clip.id)} className="btn-lit h-7 rounded-full px-3 text-[12px] font-semibold">
              Use it
            </button>
          </Row>
          <div className="flex items-center gap-0.5 px-3 py-1.5">
            <SmallBtn label="Move up" onClick={() => t.st().moveSlot(slot.id, t.index - 1)} disabled={t.index === 0}>
              <ArrowUp size={14} />
            </SmallBtn>
            <SmallBtn label="Move down" onClick={() => t.st().moveSlot(slot.id, t.index + 1)} disabled={t.index === t.count - 1}>
              <ArrowDown size={14} />
            </SmallBtn>
            <SmallBtn label={slot.locked ? 'Unlock' : 'Lock'} onClick={() => t.st().toggleLock(slot.id)} active={slot.locked}>
              {slot.locked ? <Lock size={14} /> : <LockOpen size={14} />}
            </SmallBtn>
            <button type="button" className="ml-auto text-[12px] font-medium text-zinc-400 hover:text-problem">
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- D. Two tiers ---------- */

function VariantD({ slot }: { slot: Slot }) {
  const t = useTrack(slot)
  const [tab, setTab] = useState<'keep' | 'look' | 'source' | null>('keep')
  return (
    <div className="glass-panel w-[420px] overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight text-zinc-900">{TYPE_LABEL[slot.type]}</div>
          <div className="truncate text-[12px] text-zinc-500">
            {t.source.name} · {t.pos} of {t.total}
          </div>
        </div>
        <SmallBtn label={slot.locked ? 'Unlock' : 'Lock'} onClick={() => t.st().toggleLock(slot.id)} active={slot.locked}>
          {slot.locked ? <Lock size={14} /> : <LockOpen size={14} />}
        </SmallBtn>
        <button type="button" onClick={() => t.st().adoptClipDesign(t.clip.id)} className="btn-lit flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold">
          <Sparkles size={13} /> Use look
        </button>
      </div>
      <div className="flex gap-0.5 border-t border-zinc-950/6 px-2 pt-1.5">
        {(['keep', 'look', 'source'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(tab === k ? null : k)}
            className={`h-8 rounded-t-lg px-3 text-[12.5px] font-medium transition ${tab === k ? 'bg-well text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {k === 'keep' ? 'Keep' : k === 'look' ? 'Look' : 'Source'}
          </button>
        ))}
      </div>
      {tab && (
        <div className="bg-well p-3">
          {tab === 'keep' && (
            <div className="grid grid-cols-4 gap-1.5">
              {KEEPS.map((k) => {
                const on = slot.keep[k.key]
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => t.st().toggleKeep(slot.id, k.key)}
                    className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${on ? 'bg-lift text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
                  >
                    <k.icon size={16} />
                    <span className="text-[11.5px] font-medium">{k.label}</span>
                  </button>
                )
              })}
            </div>
          )}
          {tab === 'look' && (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-14 place-items-center rounded-lg ring-1 ring-zinc-950/10" style={{ background: t.clip.tokens['color.bg'] }}>
                <span style={{ fontFamily: t.clip.tokens['font.display'], color: t.clip.tokens['color.text'] }} className="text-[18px]">
                  Aa
                </span>
              </span>
              <div className="text-[12.5px] text-zinc-600">
                {primaryFamily(t.clip.tokens['font.display'])} · radius {t.clip.tokens['radius.base']}
                <div className="mt-1 flex gap-1">
                  {(['color.primary', 'color.accent', 'color.text'] as const).map((c) => (
                    <span key={c} className="size-4 rounded-full ring-1 ring-zinc-950/10" style={{ background: t.clip.tokens[c] }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'source' && (
            <div className="text-[12.5px] text-zinc-600">
              <div className="font-medium text-zinc-900">{t.clip.title}</div>
              <div className="mt-0.5 text-zinc-500">{t.clip.capture.url.replace('https://', '')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- shared bits ---------- */

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-900">{label}</div>
        <div className="truncate text-[11.5px] text-zinc-500">{hint}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
      <span className={`absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-all ${on ? 'left-[19px]' : 'left-[3px]'}`} />
    </button>
  )
}

function SmallBtn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-full transition hover:bg-zinc-950/5 disabled:opacity-25 ${active ? 'bg-key text-key-ink hover:bg-key' : 'text-zinc-500'}`}
    >
      {children}
    </button>
  )
}
