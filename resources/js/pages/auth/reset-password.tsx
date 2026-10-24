import { Head, useForm } from '@inertiajs/react'
import { AuthCard, Field, Submit } from '@/ui/auth/AuthCard'

export default function ResetPassword({ token, email }: { token: string; email: string }) {
  const form = useForm({ token, email, password: '', password_confirmation: '' })
  return (
    <>
      <Head title="Choose a new password" />
      <AuthCard title="Choose a new password" onSubmit={() => form.post('/reset-password', { onFinish: () => form.reset('password', 'password_confirmation') })}>
        <Field label="Email" type="email" autoComplete="email" required value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
        <Field label="New password" type="password" autoComplete="new-password" autoFocus required value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} error={form.errors.password} />
        <Field
          label="New password again"
          type="password"
          autoComplete="new-password"
          required
          value={form.data.password_confirmation}
          onChange={(e) => form.setData('password_confirmation', e.target.value)}
          error={form.errors.password_confirmation}
        />
        <Submit busy={form.processing}>{form.processing ? 'Saving…' : 'Save and sign in'}</Submit>
      </AuthCard>
    </>
  )
}
