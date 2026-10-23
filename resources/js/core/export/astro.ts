import type { ComposedPage } from '../compose'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { contentVar, fontLink, sectionCss, sectionHeader, tokensCss, type FileMap } from './shared'
import { bindContent } from './bind'

export const ASTRO_VERSION = '~7.3.0' // 7.4 needs Node >= 22.23.4; 7.3 runs on any Node 22.12+

export function astroFiles(page: ComposedPage, root = 'astro/'): FileMap {
  const files: FileMap = {}
  const href = fontLink(page)

  for (const [path, data] of Object.entries(page.mediaFiles)) files[`${root}public/${path}`] = data
  files[`${root}package.json`] = JSON.stringify(
    {
      name: slug(page.title) + '-astro',
      type: 'module',
      private: true,
      scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
      dependencies: { astro: ASTRO_VERSION },
    },
    null,
    2,
  ) + '\n'
  files[`${root}astro.config.mjs`] = `import { defineConfig } from 'astro/config'\n\nexport default defineConfig({})\n`
  files[`${root}tsconfig.json`] = JSON.stringify({ extends: 'astro/tsconfigs/strict', include: ['.astro/types.d.ts', '**/*'], exclude: ['dist'] }, null, 2) + '\n'
  files[`${root}src/styles/tokens.css`] = tokensCss(page)
  files[`${root}src/styles/base.css`] = BASE_CSS_LAYERED + (page.moving ? `\n${MEDIA_CSS}` : '')
  if (page.moving) files[`${root}public/mx-media.js`] = MEDIA_JS

  files[`${root}src/layouts/Base.astro`] = `---
import '../styles/tokens.css'
import '../styles/base.css'

interface Props {
  title: string
}
const { title } = Astro.props
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
${href ? `    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${href}" />\n` : ''}${page.moving ? '    <script is:inline src="/mx-media.js" defer></script>\n' : ''}  </head>
  <body>
    <main>
      <slot />
    </main>
  </body>
</html>
`

  for (const s of page.sections) {
    files[`${root}src/components/sections/${s.component}.css`] = sectionCss(s)
    if (!s.outline.length) {
      files[`${root}src/components/sections/${s.component}.astro`] = `---\n${sectionHeader(s, 'js')}\nimport './${s.component}.css'\n---\n${serialize(s.tree, 'html')}\n`
      continue
    }
    // Words live in a content file; the component reads it (and takes other content as a prop).
    const file = `src/content/${s.contentName}.json`
    files[`${root}${file}`] = JSON.stringify(s.content, null, 2) + '\n'
    files[`${root}src/components/sections/${s.component}.astro`] = `---
${sectionHeader(s, 'js')}
import './${s.component}.css'
import data from '../../content/${s.contentName}.json'

interface Props {
  content?: typeof data
}
const { content = data } = Astro.props
---
${serialize(bindContent(s.source, s.outline, file, false), 'html')}
`
  }

  const imports = page.sections
    .flatMap((s) => [
      `import ${s.component} from '../components/sections/${s.component}.astro'`,
      ...(s.outline.length ? [`import ${contentVar(s)} from '../content/${s.contentName}.json'`] : []),
    ])
    .join('\n')
  files[`${root}src/pages/index.astro`] = `---
import Base from '../layouts/Base.astro'
${imports}
---
<Base title=${JSON.stringify(page.title)}>
${page.sections.map((s) => (s.outline.length ? `  <${s.component} content={${contentVar(s)}} />` : `  <${s.component} />`)).join('\n')}
</Base>
`
  return files
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mixtape'
}
