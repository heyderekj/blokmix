import { Head, Link, useForm } from '@inertiajs/react'
import { AuthCard, Field, Submit } from '@/ui/auth/AuthCard'

export default function ForgotPassword({ status }: { status?: string | null }) {
  const form = useForm({ email: '' })
  return (
    <>
      <Head title="Reset your password" />
      <AuthCard
        title="Reset your password"
        lede={status ?? 'We’ll email you a link to choose a new one.'}
        onSubmit={() => form.post('/forgot-password')}
        footer={
          <>
            Remembered it?{' '}
            <Link href="/login" className="font-semibold underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <Field label="Email" type="email" autoComplete="email" autoFocus required value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
        <Submit busy={form.processing}>{form.processing ? 'Sending…' : 'Email me a link'}</Submit>
      </AuthCard>
    </>
  )
}
