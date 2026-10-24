import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { AuthCard, Field, Submit } from '@/ui/auth/AuthCard'

export default function Login({ canReset = false }: { canReset?: boolean }) {
  const flash = usePage<{ flash?: string | null }>().props.flash
  const form = useForm({ email: '', password: '', remember: true })
  return (
    <>
      <Head title="Sign in" />
      <AuthCard
        title={flash ? 'Sign in to Blokmix' : 'Welcome back'}
        lede={flash ?? 'Pick up your mix where you left it.'}
        onSubmit={() => form.post('/login', { onFinish: () => form.reset('password') })}
        footer={
          <>
            New here?{' '}
            <Link href="/register" className="font-semibold text-zinc-900 underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        }
      >
        <Field label="Email" type="email" autoComplete="email" autoFocus required value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} error={form.errors.password} />
        {canReset && (
          <Link href="/forgot-password" className="-mt-1 self-end text-[12.5px] font-medium text-[#C2185B] underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        )}
        <Submit busy={form.processing}>{form.processing ? 'Signing in…' : 'Sign in'}</Submit>
      </AuthCard>
    </>
  )
}
