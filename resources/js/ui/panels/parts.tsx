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
        className={`absolute top-[3px] size-4 rounded-full shadow-sm transition-all duration-300 ${on ? 'left-[19px] bg-white' : 'left-[3px] bg-white'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </button>
  )
}
