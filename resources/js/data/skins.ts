import { parseSkin, registerSkins, type Skin } from '@/core/skins'

const files = import.meta.glob('/samples/skins/*.json', { eager: true, import: 'default' }) as Record<string, unknown>

/** The skins in samples/skins/, plain to loud: Wireframe first, then the free ones, then the rest. */
export const skins: Skin[] = Object.entries(files)
  .map(([path, json]) => parseSkin(path.replace(/^.*\/|\.json$/g, ''), json))
  .sort((a, b) => +(b.id === 'wireframe') - +(a.id === 'wireframe') || a.name.localeCompare(b.name))
registerSkins(skins)
