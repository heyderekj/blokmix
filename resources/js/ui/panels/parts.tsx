/** Shared pieces for the content that lives inside the islands. */
export function PanelSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-950/5 px-4 py-3.5 last:border-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="eyebrow">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <span
        className={`absolute left-[3px] top-[3px] size-4 rounded-full bg-white shadow-sm transition-[translate] duration-200 ${on ? 'translate-x-4' : 'translate-x-0'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </button>
  )
}
