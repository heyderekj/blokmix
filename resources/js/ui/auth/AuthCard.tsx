import type { FormEvent, ReactNode } from 'react'
import { Wordmark } from '@/ui/brand/Wordmark'

/** The card the sign-in and sign-up pages share. */
export function AuthCard({ title, lede, onSubmit, children, footer }: { title: string; lede?: string; onSubmit: (e: FormEvent) => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-[360px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(e)
          }}
          className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_16px_40px_-16px_rgb(0_0_0/0.18)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-900">
              <Wordmark height={18} />
            </span>
          </div>
          <h1 className="mt-6 text-[20px] font-semibold tracking-tight text-balance text-zinc-900">{title}</h1>
          {lede && <p className="mt-1 text-[13.5px] text-pretty text-zinc-500">{lede}</p>}
          <div className="mt-5 flex flex-col gap-3">{children}</div>
        </form>
        {footer && <p className="mt-4 text-center text-[13px] text-zinc-500">{footer}</p>}
      </div>
    </div>
  )
}

export function Field({ label, error, ...input }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[var(--auth-label,#71717a)]">{label}</span>
      <input
        {...input}
        aria-invalid={!!error}
        className="h-11 w-full rounded-xl bg-[var(--auth-field,#f4f4f5)] px-3.5 text-[15px] text-[var(--auth-ink,#18181b)] outline-none transition-[box-shadow] duration-150 placeholder:text-zinc-400 focus:ring-2 focus:ring-[var(--auth-focus,rgb(24_24_27/0.15))] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500/40"
      />
      {error && <span className="mt-1.5 block text-[12.5px] text-red-600">{error}</span>}
    </label>
  )
}

export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-1 h-11 w-full cursor-pointer rounded-full bg-[var(--auth-button,#18181b)] text-[14px] font-semibold text-[var(--auth-button-ink,#fff)] transition-[scale,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--auth-button-hover,#27272a)]"
    >
      {children}
    </button>
  )
}
