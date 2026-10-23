import type { Participant } from '@/ui/shell/Avatar'

/** The person at the keyboard. A real name arrives with accounts (Laravel phase). */
export const ME: Participant = { kind: 'person', name: 'You' }

export const agent = (name: string): Participant => ({ kind: 'agent', name })
