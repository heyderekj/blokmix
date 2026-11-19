import { directionFromStarter, parseDirection, registerDirections, type Direction } from '@/core/directions'
import { library } from './library'
import './skins'

const files = import.meta.glob('/samples/directions/*.json', { eager: true, import: 'default' }) as Record<string, unknown>

/** The curated directions in samples/directions/, then every starter as one, by name. */
export const directions: Direction[] = [
  ...Object.entries(files).map(([path, json]) => parseDirection(path.replace(/^.*\/|\.json$/g, ''), json)),
  ...library.starters.map((s) => directionFromStarter(s, library)),
].sort((a, b) => a.name.localeCompare(b.name))
registerDirections(directions)
