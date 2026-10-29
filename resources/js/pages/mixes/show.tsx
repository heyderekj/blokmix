import { useLayoutEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Board from '@/pages/board'
import { FIRST_VISIT, useStore } from '@/state/store'
import { useStartFlow } from '@/ui/start/StartFlow'
import { openMix, openMixId, type ServerMix } from '@/lib/mixSync'
import { useAccount, type Account, type MixRole } from '@/lib/account'

/** One mix on the canvas: a saved one, or "local", the mix kept in this browser only. */
export default function ShowMix({ mix, role }: { mix: ServerMix | { id: 'local' }; role: MixRole }) {
  const user = usePage<{ auth: { user: Account | null } }>().props.auth.user
  const [ready, setReady] = useState(openMixId() === mix.id)
  // Point the store at this mix before the board draws it.
  useLayoutEffect(() => {
    useAccount.setState({ user })
    openMix(mix.id === 'local' ? 'local' : (mix as ServerMix), { role })
    // The browser-only mix opens on the guided start the first time.
    if (mix.id === 'local' && FIRST_VISIT) useStartFlow.setState({ open: true })
    // Marks and versions carry your account's name.
    if (user && useStore.getState().ui.myName !== user.name) useStore.getState().setUi({ myName: user.name })
    setReady(true)
  }, [mix.id, role, user])
  const name = useStore((s) => s.mixName)
  return (
    <>
      <Head title={name} />
      {ready && <Board />}
    </>
  )
}
