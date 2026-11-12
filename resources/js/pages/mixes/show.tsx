import { useEffect, useLayoutEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Board from '@/pages/board'
import { FIRST_VISIT, useStore } from '@/state/store'
import { useStartFlow } from '@/ui/start/StartGuide'
import { startedWords } from '@/lib/start'
import { api, openMix, openMixId, type ServerMix } from '@/lib/mixSync'
import { useAccount, type Account, type MixRole } from '@/lib/account'

/** One mix on the canvas: a saved one, or "local", the mix kept in this browser only. */
export default function ShowMix({ mix, role: given }: { mix: ServerMix | { id: 'local'; ships?: boolean }; role: MixRole }) {
  const { user, billing } = usePage<{ auth: { user: Account | null; billing: { buy: boolean; price: number } | null } }>().props.auth
  const [ready, setReady] = useState(openMixId() === mix.id)
  const archived = mix.id !== 'local' && !!(mix as ServerMix).archived
  // An archived mix is read-only for everyone, like a viewer's.
  const role: MixRole = archived ? 'viewer' : given
  // Point the store at this mix before the board draws it.
  useLayoutEffect(() => {
    // Everything on the board is free; exporting and building ask once the mix isn't paid for (state/shipping.ts).
    useAccount.setState({ user, ships: mix.ships !== false, archived, owns: given === 'owner', buy: !!billing?.buy, price: billing?.price ?? 30 })
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
  }, [mix.id, mix.ships, role, given, archived, user, billing])
  usePaidReturn(mix.id)
  const name = useStore((s) => s.mixName)
  return (
    <>
      <Head title={name} />
      {ready && <Board />}
    </>
  )
}

/**
 * Back from Polar's checkout (?paid=1): say thanks, and look again until the webhook has marked the mix paid. Only the
 * shipping switch changes; the board and its unsaved edits stay as they are.
 */
function usePaidReturn(id: string) {
  useEffect(() => {
    if (id === 'local' || typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('paid')) return
    window.history.replaceState(null, '', window.location.pathname)
    const thanks = () => useStore.getState().showFlash(`Thank you. ${useStore.getState().mixName} is paid for: download it or hand it to your agent any time.`)
    if (useAccount.getState().ships) return thanks()
    useStore.getState().showFlash('Thank you. Shipping opens here as soon as Polar confirms the payment.')
    let tries = 0
    const t = window.setInterval(async () => {
      if (++tries > 10) return window.clearInterval(t)
      const res = await api<ServerMix>('GET', `/api/mixes/${id}`)
      if (res.status === 200 && res.body.ships) {
        window.clearInterval(t)
        useAccount.setState({ ships: true })
        thanks()
      }
    }, 3000)
    return () => window.clearInterval(t)
  }, [id])
}
