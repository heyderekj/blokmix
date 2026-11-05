import { useEffect, useState } from 'react'
import { AREA_LABEL, CONTRACT_AREAS, CONTRACT_SETTINGS, emptyContract, SETTING_LABEL, settingOf, type Contract, type ContractArea, type ContractSetting } from '@/core/contract'
import { useStore } from '@/state/store'

/** What you always want kept and where you'd like to be surprised. Skin swaps, Surprise me and agents all answer to it. */
export function ContractTile() {
  const contract = useStore((s) => s.contract) ?? emptyContract()
  const set = (area: ContractArea, value: ContractSetting) => useStore.getState().setContract({ areas: { ...contract.areas, [area]: value } })
  return (
    <div className="col-span-2 rounded-2xl bg-[var(--lift)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]">
      <div className="text-[12.5px] font-semibold text-zinc-900">Contract</div>
      <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-zinc-500">What stays, and where you’d like a surprise. Skins and agents follow it, and it goes in your handoff.</p>
      <div className="grid gap-1.5">
        {CONTRACT_AREAS.map((area) => (
          <div key={area} className="flex items-center justify-between gap-2" title={AREA_LABEL[area].words}>
            <span className="min-w-0 truncate text-[11.5px] font-medium text-zinc-700">{AREA_LABEL[area].name}</span>
            <div className="flex shrink-0 rounded-full bg-chip p-0.5" role="radiogroup" aria-label={AREA_LABEL[area].name}>
              {CONTRACT_SETTINGS.map((v) => {
                const on = settingOf(contract, area) === v
                return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => set(area, v)} className={`h-6 cursor-pointer rounded-full px-2 text-[10.5px] font-semibold transition-[background-color,color] duration-150 ${on ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
                    {SETTING_LABEL[v]}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <Lines label="Always keep" field="keep" value={contract.keep} placeholder="The two-column hero" />
      <Lines label="Surprise me with" field="surprise" value={contract.surprise} placeholder="The footer" />
    </div>
  )
}

/** One line per thing, saved when you leave the box, so typing isn't an undo step per letter. */
function Lines({ label, field, value, placeholder }: { label: string; field: keyof Pick<Contract, 'keep' | 'surprise'>; value: string[]; placeholder: string }) {
  const joined = value.join('\n')
  const [text, setText] = useState(joined)
  useEffect(() => setText(joined), [joined])
  return (
    <label className="mt-2.5 grid gap-1">
      <span className="text-[11.5px] font-medium text-zinc-700">{label}</span>
      <textarea
        value={text}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== joined && useStore.getState().setContract({ [field]: text.split('\n') })}
        className="w-full resize-y rounded-lg bg-white px-2 py-1.5 text-[12px] text-zinc-800 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none placeholder:text-zinc-400"
      />
    </label>
  )
}
