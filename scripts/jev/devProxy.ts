// /api/jev for the Vite-only app, in dev only: the same checks as JevController, with
// TYPESAFE_API_KEY read from .env.local (or the shell) on this machine. It has no VITE_
// prefix, so Vite never puts it in the bundle; a built dist/ has no proxy and Jev is off.

import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { requestProblem } from '../../resources/js/core/jev/limits.ts'

const API = 'https://api.typesafe.ai/v1/systemone'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/** What people asked for that Blokmix couldn't do, counted while the dev server runs (never their words). */
const wants = new Map<string, number>()

export function jevDevProxy(): Plugin {
  let key = ''
  return {
    name: 'blokmix-jev-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      key = loadEnv(config.mode, config.root, '').TYPESAFE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? ''
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/api/jev/status' && req.method === 'GET') return send(res, 200, { on: key !== '' })
        if (url === '/api/jev/wants') {
          if (req.method === 'POST') {
            const w = JSON.parse((await readBody(req)) || '{}') as { want?: string; feature?: string }
            if (w.want && w.feature) wants.set(`${w.feature}:${w.want}`, (wants.get(`${w.feature}:${w.want}`) ?? 0) + 1)
            res.statusCode = 204
            return res.end()
          }
          return send(res, 200, Object.fromEntries(wants))
        }
        if (url !== '/api/jev' || req.method !== 'POST') return next()
        if (!key) return send(res, 503, { message: 'Jev is off: put TYPESAFE_API_KEY in .env.local and restart npm run dev.' })
        const raw = await readBody(req)
        let body: unknown
        try {
          body = JSON.parse(raw)
        } catch {
          return send(res, 422, { message: 'Send the request as JSON.' })
        }
        const problem = requestProblem(body, Buffer.byteLength(raw))
        if (problem) return send(res, 422, { message: problem })
        const b = body as { assets?: object; questions: Record<string, { type: string }> }
        const images = !!(b.assets && Object.keys(b.assets).length) || Object.values(b.questions).some((q) => q.type === 'box')
        try {
          const r = await fetch(API, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(images ? { 'TypeSafe-Danger-Zone-Images': 'true' } : {}) },
            body: raw,
            signal: AbortSignal.timeout(images ? 20_000 : 10_000),
          })
          send(res, r.status, await r.text())
        } catch (e) {
          send(res, 502, { message: `Couldn’t reach TypeSafe: ${e instanceof Error ? e.message : String(e)}` })
        }
      })
    },
  }
}
