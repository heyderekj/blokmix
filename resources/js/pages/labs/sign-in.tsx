import { useState } from 'react'
import { Head, Link, useForm } from '@inertiajs/react'
import { Field, Submit } from '@/ui/auth/AuthCard'
import { AuthCanvas, AuthFlyer, AuthPoster } from '@/ui/auth/variants'

const VARIANTS = { a: { label: 'A · Canvas', Layout: AuthCanvas }, b: { label: 'B · Poster', Layout: AuthPoster }, c: { label: 'C · Flyer', Layout: AuthFlyer } } as const
type Key = keyof typeof VARIANTS

/** Labs (local only): sign-in designs side by side, with the real form. */
export default function SignInLabs() {
  const [v, setV] = useState<Key>(() => (new URLSearchParams(location.search).get('v') as Key) ?? 'a')
  const form = useForm({ email: '', password: '', remember: true })
  const { Layout } = VARIANTS[VARIANTS[v] ? v : 'a']
  return (
    <div className="relative h-full">
      <Head title="Labs · Sign in" />
      <Layout
        title="Welcome back"
        lede="Pick up your mix where you left it."
        onSubmit={() => form.post('/login', { onFinish: () => form.reset('password') })}
        footer={
          <>
            New here?{' '}
            <Link href="/register" className="font-semibold underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        }
      >
        <Field label="Email" type="email" autoComplete="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} error={form.errors.password} />
        <Submit busy={form.processing}>Sign in</Submit>
      </Layout>
      <nav className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-white/90 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur">
        {(Object.keys(VARIANTS) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setV(k)
              history.replaceState(null, '', `?v=${k}`)
            }}
            className={`h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-semibold transition-[background-color,color] duration-150 ${v === k ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
          >
            {VARIANTS[k].label}
          </button>
        ))}
      </nav>
    </div>
  )
}
