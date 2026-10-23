import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import type { LightboxPayload } from '@/frame/bridge'
import { uploadData } from '@/lib/assets'
import { DOTLOTTIE_URL } from '@/core/export/media-runtime'

/**
 * The lightbox a visitor would get, opened from an interactive frame. It sits
 * over the whole app (a frame can only cover its own section).
 */
const useLightbox = create<{ open: (LightboxPayload & { url?: string }) | null }>()(() => ({ open: null }))

/** Open from a frame; uploaded media is resolved here, from this page's own copy of the file. */
export function openLightbox(p: LightboxPayload, asset?: string) {
  let url = p.src
  if (asset) {
    const a = uploadData(asset)
    if (a?.bytes) url = URL.createObjectURL(new Blob([a.bytes], { type: a.mime }))
  }
  useLightbox.setState({ open: { ...p, url } })
}

export function Lightbox() {
  const open = useLightbox((s) => s.open)
  const close = () => {
    if (open?.url?.startsWith('blob:')) URL.revokeObjectURL(open.url)
    useLightbox.setState({ open: null })
  }
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="fixed inset-0 z-[90] grid place-items-center bg-zinc-950/70 p-8 backdrop-blur-sm"
          onPointerDown={(e) => e.target === e.currentTarget && close()}
          data-chrome
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ scale: 0.98, opacity: 0, transition: { duration: 0.12 } }}
            className="relative w-[min(92vw,1100px)] overflow-hidden rounded-2xl bg-black shadow-2xl"
          >
            <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/85 text-zinc-900 hover:bg-white">
              <X size={16} />
            </button>
            <Media p={open} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Media({ p }: { p: LightboxPayload & { url?: string } }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (p.kind !== 'lottie' || !canvas.current || !p.url) return
    let player: { destroy?: () => void } | null = null
    void import(/* @vite-ignore */ DOTLOTTIE_URL).then(({ DotLottie }) => {
      player = new DotLottie({ canvas: canvas.current, src: p.url, autoplay: true, loop: true })
    })
    return () => player?.destroy?.()
  }, [p])
  const box = 'block aspect-video w-full max-h-[86vh] object-contain'
  if (p.kind === 'embed') return <iframe src={p.player} title={p.alt || 'Video'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className={`${box} border-0`} />
  if (p.kind === 'video') return <video src={p.url} poster={p.poster} controls autoPlay playsInline className={box} />
  if (p.kind === 'lottie') return <canvas ref={canvas} className={`${box} bg-white`} />
  return <img src={p.url} alt={p.alt ?? ''} className={box} />
}
