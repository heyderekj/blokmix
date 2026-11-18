import { renderToStaticMarkup } from 'react-dom/server'
import { themeScene } from '@/core/themeScene'
import { SceneDrawing } from '@/ui/skins/SkinSpecimen'
import { svgDataUri } from '@/core/media'
import { fontHrefs, fontsForTokens } from '@/core/tokens'
import { resolveGuide } from '@/core/guide'
import type { GuideState } from '@/core/types'
import type { JevAsset } from '@/core/jev'

const styles = new Map<string, Promise<void>>()
function loadSheet(href: string) {
  let pending = styles.get(href)
  if (pending) return pending
  pending = new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find((el) => el.href === href)
    if (existing?.sheet) return resolve()
    const link = existing ?? document.createElement('link')
    const finish = () => {
      clearTimeout(timer)
      link.removeEventListener('load', loaded)
      link.removeEventListener('error', failed)
    }
    const loaded = () => {
      finish()
      resolve()
    }
    const failed = () => {
      finish()
      reject(new Error('Font unavailable'))
    }
    const timer = setTimeout(failed, 3000)
    link.addEventListener('load', loaded)
    link.addEventListener('error', failed)
    if (!existing) {
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }).catch((error) => {
    styles.delete(href)
    throw error
  })
  styles.set(href, pending)
  return pending
}

export async function themeShot(guide: GuideState, title: string, body?: string): Promise<JevAsset | null> {
  if (typeof document === 'undefined') return null
  try {
    const scene = themeScene(guide, title, body)
    await Promise.all(fontHrefs(fontsForTokens(resolveGuide(guide).tokens, [])).map(loadSheet))
    const fonts = scene.lines.map((l) => `${l.weight} ${l.size}px ${l.family}`)
    await Promise.all(fonts.map((font) => document.fonts.load(font)))
    const image = new Image()
    image.src = svgDataUri(renderToStaticMarkup(<SceneDrawing scene={scene} lettering={false} />))
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 300
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    scene.lines.forEach((l, i) => {
      ctx.save()
      ctx.beginPath()
      ctx.rect(l.x, l.y - l.size, l.width, l.size * 1.3)
      ctx.clip()
      ctx.font = fonts[i]
      ctx.fillStyle = l.color
      ctx.fillText(l.text, l.x, l.y)
      ctx.restore()
    })
    return { type: 'image', format: 'jpg', data_base64: canvas.toDataURL('image/jpeg', 0.84).split(',')[1] }
  } catch {
    return null
  }
}
