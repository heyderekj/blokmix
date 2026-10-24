import { CloudAlert, CloudCheck, CloudOff, CloudUpload } from 'lucide-react'
import { useSave } from '@/lib/mixSync'

const STATES = {
  saved: { icon: CloudCheck, label: 'Saved', tone: 'text-zinc-400' },
  saving: { icon: CloudUpload, label: 'Saving…', tone: 'text-zinc-400' },
  offline: { icon: CloudOff, label: 'Offline: kept in this browser, saving when you’re back', tone: 'text-amber-600' },
  error: { icon: CloudAlert, label: 'Couldn’t save. Your edits are kept in this browser.', tone: 'text-red-600' },
} as const

/** Whether a saved mix's edits have reached the server. Nothing for the browser-only mix. */
export function SaveState() {
  const status = useSave((s) => s.status)
  if (status === 'local') return null
  const s = STATES[status]
  return (
    <span className={`grid size-8 shrink-0 place-items-center ${s.tone}`} title={s.label} aria-label={s.label} role="status">
      <s.icon size={15} />
    </span>
  )
}
