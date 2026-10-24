import { Head } from '@inertiajs/react'
import Board from '@/pages/board'
import { useStore } from '@/state/store'

/** One mix on the canvas. Until mixes are stored on the server the only one is "local", the mix in this browser. */
export default function ShowMix(_: { mix: { id: string } }) {
  const name = useStore((s) => s.mixName)
  return (
    <>
      <Head title={name} />
      <Board />
    </>
  )
}
