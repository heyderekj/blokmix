import { useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { addSharedRecipe, applyControl, sampleRecipe, layoutClip, makeSection, recipeSchema, type Recipe } from '@/core/iterations'
import { updateSlotIn, pageOf } from '@/core/site'
import { api, openMixId } from '@/lib/mixSync'
import { useAccount } from '@/lib/account'
import { useStore } from '@/state/store'
import { snapshotOf } from '@/state/snapshot'
import { library } from '@/data/library'
import { uid } from '@/state/uid'
import type { Slot, VersionNode } from '@/core/types'
import { blankMix } from '@/state/seed'
import { VersionPreview } from './IterationReview'

interface Item {
  id: number
  recipe: Recipe
}
function specimen(recipe: Recipe) {
  const mix = blankMix('Library preview')
  const slot = makeSection(recipe, 'sample', library)
  mix.site.pages[0].slots = [slot]
  return {
    id: 'sample',
    letter: '',
    title: recipe.title,
    kind: 'snapshot',
    status: 'ready',
    parentId: null,
    createdAt: 0,
    snapshot: snapshotOf(mix),
  } satisfies VersionNode
}

export function RecipeControls({ slot }: { slot: Slot }) {
  const [preview, setPreview] = useState<Recipe | null>(null)
  const [message, setMessage] = useState('')
  const owner = useAccount((s) => s.owns && !s.archived)
  const editable = useAccount((s) => s.role !== 'viewer' && !s.archived)
  const recipe = slot.recipe
  if (!recipe || layoutClip(recipe, library).id !== slot.clipId) return null
  return (
    <fieldset className="grid gap-2 rounded-xl bg-white p-3 text-sm" disabled={!editable || slot.locked}>
      <legend>{recipe.title}</legend>
      {recipe.controls.map((c, i) => {
        const set = (n: number) => useStore.setState((s) => ({ site: updateSlotIn(s.site, slot.id, (x) => applyControl(x, c, n)) }))
        if (c.kind === 'range')
          return (
            <label key={i}>
              {c.label}
              <input
                aria-label={c.label}
                type="range"
                min={0}
                max={10}
                value={slot.edits?.[slot.clipId]?.[c.block]?.style?.gap ?? 0}
                onChange={(e) => set(+e.target.value)}
              />
            </label>
          )
        const value = c.options.findIndex(
          (o) =>
            (!o.surface || o.surface === slot.surface) &&
            Object.entries(o.words).every(([k, v]) => slot.words?.[k] === v) &&
            Object.entries(o.blocks ?? {}).every(([id, style]) =>
              Object.entries(style).every(([k, v]) => slot.edits?.[slot.clipId]?.[id]?.style?.[k as keyof typeof style] === v),
            ),
        )
        return (
          <label key={i} className="flex justify-between">
            {c.label}
            {c.kind === 'toggle' ? (
              <input type="checkbox" checked={value === 1} onChange={(e) => set(e.target.checked ? 1 : 0)} />
            ) : (
              <select aria-label={c.label} value={value} onChange={(e) => set(+e.target.value)}>
                <option value={-1} disabled>
                  Custom
                </option>
                {c.options.map((o, n) => (
                  <option key={n} value={n}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        )
      })}
      {owner && openMixId() !== 'local' && <button onClick={() => setPreview(sampleRecipe(recipe))}>Suggest for the library</button>}
      {preview && (
        <>
          <VersionPreview version={specimen(preview)} />
          <details>
            <summary>Review shared fields and controls</summary>
            <pre className="overflow-auto">{JSON.stringify(preview, null, 2)}</pre>
          </details>
          <button
            onClick={async () => {
              try {
                const res = await api('POST', '/api/mixes/' + openMixId() + '/layout-suggestions', { recipe: preview })
                if (res.status !== 201) throw Error()
                setPreview(null)
                setMessage('Submitted for curation.')
              } catch {
                setMessage('Could not submit this suggestion.')
              }
            }}
          >
            Submit reusable layout
          </button>
          <button onClick={() => setPreview(null)}>Cancel</button>
        </>
      )}
      {message && <span role="status">{message}</span>}
    </fieldset>
  )
}

export function SharedRecipes({ curate = false }: { curate?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null),
    [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ id: number; version?: VersionNode; error?: string } | null>(null)
  function inspect(item: Item) {
    try {
      setPreview({ id: item.id, version: specimen(item.recipe) })
    } catch (e) {
      setPreview({ id: item.id, error: (e as Error).message })
    }
  }
  const load = async () => {
    try {
      const res = await api<Item[]>('GET', '/api/layout-suggestions' + (curate ? '?pending=1' : ''))
      if (res.status !== 200) throw Error()
      setItems(res.body.map((i) => ({ ...i, recipe: recipeSchema.parse(i.recipe) })))
    } catch {
      setMessage('Could not load layouts.')
    }
  }
  async function choose(item: Item, status?: string) {
    try {
      if (curate) {
        const res = await api('PATCH', '/api/layout-suggestions/' + item.id, { status })
        if (res.status !== 200) throw Error('Reload the queue and try again.')
        setItems(items?.filter((i) => i.id !== item.id) ?? [])
      } else {
        const st = useStore.getState(),
          snap = snapshotOf(st),
          page = pageOf(st.site, st.ui.pageId)
        const next = addSharedRecipe(snap, page.id, uid('section'), item.recipe, library)
        useStore.setState({ site: next.site })
        setMessage('Added ' + item.recipe.title)
      }
    } catch (e) {
      setMessage((e as Error).message)
    }
  }
  return (
    <div className={curate ? 'grid gap-2 p-2 text-sm' : 'draft-library grid gap-2 text-sm'}>
      <button aria-expanded={items !== null} onClick={() => (items ? setItems(null) : void load())}>
        {!curate && <LayoutGrid size={16} />} {curate ? 'Review suggested layouts' : 'Community layouts'}
        {!curate && <ChevronDown size={15} className={items ? 'ml-auto rotate-180' : 'ml-auto'} />}
      </button>
      {items?.length === 0 && <span>{curate ? 'No suggestions waiting.' : 'No curated layouts yet.'}</span>}
      {items?.map((i) => (
        <div key={i.id}>
          <button onClick={() => inspect(i)}>{i.recipe.title}</button>
          {preview?.id === i.id && (
            <>
              {preview.version ? <VersionPreview version={preview.version} /> : <span>{preview.error}</span>}
              <button disabled={!preview.version} onClick={() => void choose(i, 'approved')}>
                {curate ? 'Approve layout' : 'Add to this page'}
              </button>
              {curate && <button onClick={() => void choose(i, 'declined')}>Decline</button>}
            </>
          )}
        </div>
      ))}
      {message && <span role="status">{message}</span>}
    </div>
  )
}
