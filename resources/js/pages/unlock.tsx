import { Head, useForm } from '@inertiajs/react'
import { LogoTile } from '@/ui/shell/Logo'

/** The one password that opens Blokmix until there are accounts. */
export default function Unlock() {
  const form = useForm({ password: '' })
  return (
    <div className="grid min-h-full place-items-center bg-zinc-50 px-4">
      <Head title="Unlock" />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.post('/unlock', { onFinish: () => form.reset('password') })
        }}
        className="w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_16px_40px_-16px_rgb(0_0_0/0.18)]"
      >
        <div className="flex items-center gap-2.5">
          <LogoTile size={30} />
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Blokmix</span>
        </div>
        <h1 className="mt-6 text-[20px] font-semibold tracking-tight text-zinc-900">This mix board is private</h1>
        <p className="mt-1 text-[13.5px] text-pretty text-zinc-500">Enter the password to open it.</p>
        <label className="mt-5 block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
            aria-invalid={!!form.errors.password}
            className="h-11 w-full rounded-xl bg-zinc-100 px-3.5 text-[15px] text-zinc-900 outline-none transition-[box-shadow] duration-150 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/15 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500/40"
            placeholder="Password"
          />
        </label>
        {form.errors.password && <p className="mt-2 text-[12.5px] text-red-600">{form.errors.password}</p>}
        <button
          type="submit"
          disabled={form.processing || !form.data.password}
          className="mt-4 h-11 w-full cursor-pointer rounded-full bg-zinc-900 text-[14px] font-semibold text-white transition-[scale,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-800"
        >
          {form.processing ? 'Opening…' : 'Open Blokmix'}
        </button>
      </form>
    </div>
  )
}
