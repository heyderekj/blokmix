import type { Participant } from '@/ui/shell/Avatar'
import { useStore } from '@/state/store'

/** The person at the keyboard, by the name they set in the menu. (Accounts arrive with Laravel.) */
export function useMe(): Participant {
  const name = useStore((s) => s.ui.myName)
  return { kind: 'person', name }
}

export const agent = (name: string): Participant => ({ kind: 'agent', name })
