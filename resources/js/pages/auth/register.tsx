import { Head, Link, useForm } from '@inertiajs/react'
import { AuthCard, Field, Submit } from '@/ui/auth/AuthCard'

const ROLE_WORDS = { editor: 'edit', viewer: 'view', owner: 'own' } as const

export default function Register({ invite }: { invite?: { mix: string; role: keyof typeof ROLE_WORDS } | null }) {
  const form = useForm({ name: '', email: '', password: '', password_confirmation: '' })
  return (
    <>
      <Head title="Create an account" />
      <AuthCard
        title={invite ? `You’re invited to ${ROLE_WORDS[invite.role]} “${invite.mix}”` : 'Create your Blokmix account'}
        lede={invite ? 'Create your account to open it. Your name shows on the notes you leave and the versions you save.' : 'Your name shows on the notes you leave and the versions you save.'}
        onSubmit={() => form.post('/register', { onFinish: () => form.reset('password', 'password_confirmation') })}
        footer={
          <>
            Have an account?{' '}
            <Link href="/login" className="font-semibold text-zinc-900 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <Field label="Name" autoComplete="name" autoFocus required value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} />
        <Field label="Email" type="email" autoComplete="email" required value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" required value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} error={form.errors.password} />
        <Field
          label="Password again"
          type="password"
          autoComplete="new-password"
          required
          value={form.data.password_confirmation}
          onChange={(e) => form.setData('password_confirmation', e.target.value)}
          error={form.errors.password_confirmation}
        />
        <Submit busy={form.processing}>{form.processing ? 'Creating…' : 'Create account'}</Submit>
      </AuthCard>
    </>
  )
}
