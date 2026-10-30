// Send site-library bundles to a Blokmix server: POST /api/library/sites with `site` (upload.json) and `files[]`
// (the images it names), signed in through Fortify's session.
//   npx vite-node scripts/library/upload.ts <slug…|--all> [--base http://localhost:8000] [--out .out/library]
// Credentials: LIBRARY_EMAIL / LIBRARY_PASSWORD, else LOCAL_TEST_EMAIL / LOCAL_TEST_PASSWORD from the main
// checkout's .env. The password is never printed.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const base = (opt('--base') ?? 'http://localhost:8000').replace(/\/+$/, '')
const root = join(process.cwd(), opt('--out') ?? '.out/library')
const valued = new Set(['--base', '--out'])
const named = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]))
const slugs = args.includes('--all') ? (existsSync(root) ? readdirSync(root) : []).filter((s) => existsSync(join(root, s, 'upload.json'))) : named
if (!slugs.length) throw new Error('Usage: upload.ts <slug…|--all> [--base http://localhost:8000]')
if (/laravel\.cloud|blokmix\.com/.test(base) && !args.includes('--production')) throw new Error(`Refusing to upload to ${base} without --production`)

const MAX_FILE = 15 * 1024 * 1024
const MAX_TOTAL = 200 * 1024 * 1024
const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

function credentials(): { email: string; password: string } {
  let email = process.env.LIBRARY_EMAIL
  let password = process.env.LIBRARY_PASSWORD
  if (!email || !password) {
    const envFile = '/Users/heyderekj/blokmix/.env'
    const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
    const read = (k: string) => {
      const m = new RegExp(`^${k}=(.*)$`, 'm').exec(env)
      return m ? m[1].trim().replace(/^(['"])(.*)\1$/, '$2') : undefined
    }
    email ??= read('LOCAL_TEST_EMAIL')
    password ??= read('LOCAL_TEST_PASSWORD')
  }
  if (!email || !password) throw new Error('Set LIBRARY_EMAIL and LIBRARY_PASSWORD (or LOCAL_TEST_EMAIL / LOCAL_TEST_PASSWORD in .env)')
  return { email, password }
}

/** A tiny cookie jar for one origin. */
class Jar {
  private cookies = new Map<string, string>()
  take(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  xsrf() {
    const v = this.cookies.get('XSRF-TOKEN')
    return v ? decodeURIComponent(v) : ''
  }
}

async function signIn(jar: Jar) {
  const page = await fetch(`${base}/login`, { headers: { Accept: 'text/html' }, redirect: 'manual' })
  jar.take(page)
  if (!jar.xsrf()) throw new Error(`No XSRF-TOKEN cookie from ${base}/login (status ${page.status})`)
  const { email, password } = credentials()
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': jar.xsrf(), Cookie: jar.header(), 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ email, password, remember: false }),
  })
  jar.take(res)
  if (res.status >= 400) throw new Error(`Sign-in failed for ${email} (${res.status})`)
  console.log(`Signed in to ${base} as ${email}`)
}

async function upload(jar: Jar, slug: string) {
  const dir = join(root, slug)
  const text = readFileSync(join(dir, 'upload.json'), 'utf8')
  const site = JSON.parse(text) as { thumb?: string; pages: { screenshot: string; sections: { screenshot?: string }[] }[] }
  const names = new Set<string>()
  if (site.thumb) names.add(site.thumb)
  for (const p of site.pages) {
    names.add(p.screenshot)
    for (const s of p.sections) if (s.screenshot) names.add(s.screenshot)
  }
  const form = new FormData()
  form.append('site', new Blob([text], { type: 'application/json' }), 'upload.json')
  let total = 0
  for (const name of names) {
    const file = join(dir, name)
    if (!existsSync(file)) throw new Error(`${slug}: upload.json names ${name}, which isn't in the bundle`)
    const data = readFileSync(file)
    if (data.length > MAX_FILE) throw new Error(`${slug}: ${name} is over 15 MB`)
    total += data.length
    form.append('files[]', new Blob([data], { type: TYPES[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream' }), name)
  }
  if (total > MAX_TOTAL) throw new Error(`${slug}: ${Math.round(total / 1e6)} MB of images is over the 200 MB limit`)
  const res = await fetch(`${base}/api/library/sites`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'X-XSRF-TOKEN': jar.xsrf(), Cookie: jar.header(), 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
  })
  jar.take(res)
  const body = await res.text()
  if (!res.ok) throw new Error(`${slug}: ${res.status} ${body.slice(0, 400)}`)
  console.log(`✓ ${slug}: ${names.size} images, ${(total / 1e6).toFixed(1)} MB  ${body.slice(0, 200)}`)
}

const jar = new Jar()
await signIn(jar)
let failed = 0
for (const slug of slugs) {
  try {
    await upload(jar, slug)
  } catch (err) {
    failed++
    console.error(`✗ ${(err as Error).message}`)
  }
}
process.exitCode = failed ? 1 : 0
