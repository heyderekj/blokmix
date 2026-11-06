import { useLayoutEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Board from '@/pages/board'
import { FIRST_VISIT, useStore } from '@/state/store'
import { useStartFlow } from '@/ui/start/StartGuide'
import { startedWords } from '@/lib/start'
import { openMix, openMixId, type ServerMix } from '@/lib/mixSync'
import { useAccount, type Account, type MixRole } from '@/lib/account'
import { library } from '@/data/library'

/** One mix on the canvas: a saved one, or "local", the mix kept in this browser only. */
export default function ShowMix({ mix, role: given }: { mix: ServerMix | { id: 'local'; paid?: boolean }; role: MixRole }) {
  const { user, plan } = usePage<{ auth: { user: Account | null; plan: { buy: boolean; pack: { price_usd: number } } | null } }>().props.auth
  const [ready, setReady] = useState(openMixId() === mix.id)
  const archived = mix.id !== 'local' && !!(mix as ServerMix).archived
  // An archived mix is read-only for everyone, like a viewer's.
  const role: MixRole = archived ? 'viewer' : given
  // Point the store at this mix before the board draws it.
  useLayoutEffect(() => {
    // What the board opens follows the mix's owner: a mix pack, or Free's core layouts and controls.
    const paid = mix.paid !== false
    library.paid = paid
    useAccount.setState({ user, paid, archived, owns: given === 'owner', buy: !!plan?.buy, price: plan?.pack.price_usd ?? 20 })
    openMix(mix.id === 'local' ? 'local' : (mix as ServerMix), { role })
    // The browser-only mix opens on the guided start the first time.
    if (mix.id === 'local' && FIRST_VISIT) useStartFlow.setState({ open: true })
    // Just started from the guided start: your words are what's left, so Words opens with its Next on the first sample.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('start') === '1') {
      const st = useStore.getState()
      st.setUi({ leftPanel: 'words' })
      st.showFlash(startedWords(st.mixName, st))
      window.history.replaceState(null, '', window.location.pathname)
    }
    // Marks and versions carry your account's name.
    if (user && useStore.getState().ui.myName !== user.name) useStore.getState().setUi({ myName: user.name })
    setReady(true)
  }, [mix.id, mix.paid, role, given, archived, user, plan])
  const name = useStore((s) => s.mixName)
  return (
    <>
      <Head title={name} />
      {ready && <Board />}
    </>
  )
}
