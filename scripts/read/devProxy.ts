// /api/read for the Vite-only app, in dev only: the same checks as ReadController, with ANTHROPIC_API_KEY read from
// .env.local (or the shell) on this machine. It has no VITE_ prefix, so Vite never puts it in the bundle; a built
// dist/ has no proxy and reading is off.

import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type Anthropic from '@anthropic-ai/sdk'
import { clientFor, readOnce, requestProblem, type Task } from './call.ts'

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
  res.end(JSON.stringify(body))
}

export function readerDevProxy(): Plugin {
  let key = ''
  let model = 'claude-haiku-5-5'
  let client: Anthropic | null = null
  return {
    name: 'blokmix-reader-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      key = env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
      model = env.BLOKMIX_READ_MODEL || model
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/api/read/status' && req.method === 'GET') return send(res, 200, { on: key !== '' })
        if (url !== '/api/read' || req.method !== 'POST') return next()
        if (!key) return send(res, 503, { message: 'Reading is off: put ANTHROPIC_API_KEY in .env.local and restart npm run dev.' })
        let body: { task?: unknown; text?: unknown; context?: unknown }
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          return send(res, 422, { message: 'Send the request as JSON.' })
        }
        const problem = requestProblem(body)
        if (problem) return send(res, 422, { message: problem })
        client ??= clientFor(key)
        const r = await readOnce(client, model, body.task as Task, body.text as string, (body.context as object) ?? {})
        // Counts and timings only, like the server's log.
        console.log(`[read] ${body.task} ${r.read ? 'ok' : `no (${r.why})`} ${r.ms}ms ${r.input_tokens}+${r.output_tokens} tokens`)
        if (!r.read) return send(res, 502, { message: 'No reading that time.' })
        send(res, 200, { read: r.read, usage: { input_tokens: r.input_tokens, output_tokens: r.output_tokens }, ms: r.ms })
      })
    },
  }
}
