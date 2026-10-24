import { useLayoutEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import Board from '@/pages/board'
import { useStore } from '@/state/store'
import { openMix, openMixId, type ServerMix } from '@/lib/mixSync'

/** One mix on the canvas: a saved one, or "local", the mix kept in this browser only. */
export default function ShowMix({ mix }: { mix: ServerMix | { id: 'local' } }) {
  const [ready, setReady] = useState(openMixId() === mix.id)
  // Point the store at this mix before the board draws it.
  useLayoutEffect(() => {
    openMix(mix.id === 'local' ? 'local' : (mix as ServerMix))
    setReady(true)
  }, [mix.id])
  const name = useStore((s) => s.mixName)
  return (
    <>
      <Head title={name} />
      {ready && <Board />}
    </>
  )
}
