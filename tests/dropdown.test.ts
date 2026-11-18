import { expect, it } from 'vitest'

it('uses Blokmix controls for dropdowns in the app UI', () => {
  const views = import.meta.glob<string>('../resources/js/{ui,pages}/**/*.tsx', { eager: true, query: '?raw', import: 'default' })
  const nativeSelects = Object.keys(views).filter((file) => /<select[\s>]/.test(views[file]))
  expect(nativeSelects, 'Use the shared Dropdown component for pickers.').toEqual([])
})
