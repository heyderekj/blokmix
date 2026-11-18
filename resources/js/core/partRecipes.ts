import type { Skin } from './skins'
import type { StyleArea } from './contract'

interface PartRecipe {
  id: string
  name: string
  area: StyleArea
  from: string
  overrides?: Pick<Skin, 'tokens'> | Pick<Skin, 'sections'>
}

/** Named parts from the same catalog the whole themes use. Only the named area's fields are applied. */
export const PART_RECIPES: PartRecipe[] = [
  {
    id: 'reading-room',
    name: 'Narrow reading column',
    area: 'space',
    from: 'liner-notes',
    overrides: { tokens: { 'space.content': '1000px', 'space.text': '620px', 'space.section': '88px' } },
  },
  {
    id: 'gallery-wall',
    name: 'Wide gallery',
    area: 'space',
    from: 'studio',
    overrides: { tokens: { 'space.content': '1480px', 'space.text': '700px', 'space.section': '128px' } },
  },
  {
    id: 'straight-edge',
    name: 'Square corners and hairlines',
    area: 'shape',
    from: 'studio',
    overrides: { tokens: { 'radius.base': '0px', 'stroke.width': '1px', 'shadow.card': 'none' } },
  },
  { id: 'still', name: 'Still', area: 'motion', from: 'wireframe', overrides: { tokens: { 'motion.duration': '0ms' } } },
  {
    id: 'quiet-fade',
    name: 'Gentle fade',
    area: 'motion',
    from: 'studio',
    overrides: { sections: { hero: { motion: { mode: 'preset', enter: 'fade' } }, features: { motion: { mode: 'preset', enter: 'fade' } } } },
  },
]
