import { Archive, CircleDashed, Eye, Flag, CircleCheck, type LucideIcon } from 'lucide-react'
import type { Status } from '@/core/types'

export const STATUS_META: Record<Status, { label: string; color: string; icon: LucideIcon }> = {
  'in-progress': { label: 'In progress', color: 'var(--foreground)', icon: CircleDashed },
  ready: { label: 'Ready for review', color: 'var(--attention)', icon: Eye },
  changes: { label: 'Changes requested', color: 'var(--problem)', icon: Flag },
  approved: { label: 'Approved', color: 'var(--done)', icon: CircleCheck },
  archived: { label: 'Archived', color: 'var(--n-400)', icon: Archive },
}

export const STATUS_ORDER: Status[] = ['changes', 'archived', 'approved', 'ready', 'in-progress']
