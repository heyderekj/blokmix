import { Head, Link, useForm } from '@inertiajs/react'
import { AuthCard, Field, Submit } from '@/ui/auth/AuthCard'

/** Without a mail service (MAIL_MAILER log) no link could reach anyone, so the page says so instead of a form. */
export default function ForgotPassword({ status, canReset = true }: { status?: string | null; canReset?: boolean }) {
  const form = useForm({ email: '' })
  return (
    <>
      <Head title="Reset your password" />
      <AuthCard
        title="Reset your password"
        lede={canReset ? (status ?? 'We’ll email you a link to choose a new one.') : 'Password reset by email isn’t switched on yet. Ask the people who run Blokmix to reset it for you.'}
        onSubmit={() => canReset && form.post('/forgot-password')}
        footer={
          <>
            Remembered it?{' '}
            <Link href="/login" className="font-semibold underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        {canReset && (
          <>
            <Field label="Email" type="email" autoComplete="email" autoFocus required value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
            <Submit busy={form.processing}>{form.processing ? 'Sending…' : 'Email me a link'}</Submit>
          </>
        )}
      </AuthCard>
    </>
  )
}
