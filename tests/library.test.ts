import { describe, expect, it } from 'vitest'
import { library } from '@/data/library'
import { SECTION_TYPES } from '@/core/types'
import { FIELD_SCHEMA } from '@/core/content'

describe('sample library', () => {
  it('has no lint errors', () => {
    const errors = library.warnings.filter((w) => w.level === 'error').map((w) => `${w.clipId}: ${w.message}`)
    expect(errors).toEqual([])
  })

  it('loads clips with fields from the schema', () => {
    for (const clip of Object.values(library.clips)) {
      expect(Object.keys(clip.fields).length, clip.id).toBeGreaterThan(0)
      for (const f of Object.keys(clip.fields)) expect(FIELD_SCHEMA[clip.type], clip.id).toContain(f)
    }
  })

  it('covers every section type', () => {
    for (const t of SECTION_TYPES) expect(library.byType[t].length, t).toBeGreaterThan(0)
  })
})
