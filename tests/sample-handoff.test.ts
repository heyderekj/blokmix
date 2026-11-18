import { expect, it } from 'vitest'
import { sampleHandoffFiles } from '@/lib/sampleHandoff'

it('packages both sample projects with standalone prompts and no account mix identifiers', () => {
  const files = sampleHandoffFiles()
  const packet = JSON.parse(files['blokmix.json'] as string)

  expect(packet.mix.name).toBe('Blokmix launch page')
  expect(packet.mix).not.toHaveProperty('id')
  expect(packet.mix).not.toHaveProperty('draft')
  expect(files['reference/about.html']).toBeTruthy()
  expect(files['BLOKMIX.md']).toContain('make the primary action easy to find on mobile')
  expect(files['BLOKMIX.md']).toContain('To start a new mix')
  expect(files['BLOKMIX.md']).not.toContain('Copy mix.id')

  for (const target of ['astro', 'next']) {
    expect(files[`${target}/package.json`]).toBeTruthy()
    expect(files[`PROMPT.${target}.md`]).toContain(`Use the reference build in ${target}/`)
    expect(files[`PROMPT.${target}.md`]).not.toContain('prepare_build')
  }
})
