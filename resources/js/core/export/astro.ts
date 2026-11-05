import type { ComposedPage, ComposedSection } from '../compose'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { SLIDER_JS } from './slider-runtime'
import { SHADERS_JS, SHADER_CSS } from './shaders'
import { contentVar, fontLinks, routeFile, sectionCss, sectionHeader, sitePages, tokensCss, type FileMap } from './shared'
import { bindContent } from './bind'
import { astroCollectionFiles, sectionContent } from './collections'

export const ASTRO_VERSION = '~7.3.0' // 7.4 needs Node >= 22.23.4; 7.3 runs on any Node 22.12+

export function astroFiles(page: ComposedPage, root = 'astro/'): FileMap {
  const files: FileMap = {}
  const links = fontLinks(page)

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
  files[`${root}src/styles/base.css`] = BASE_CSS_LAYERED + (page.moving ? `\n${MEDIA_CSS}` : '') + (page.shaders.length ? `\n${SHADER_CSS}` : '')
  if (page.moving) files[`${root}public/mx-media.js`] = MEDIA_JS
  if (page.sliding) files[`${root}public/mx-slider.js`] = SLIDER_JS
  if (page.shaders.length) files[`${root}public/mx-shaders.js`] = SHADERS_JS

  const site = sitePages(page)
  const { nav, footer } = site.shared
  // The shared nav and footer live in the layout; each page can turn either off.
  const chrome = (s: ComposedSection | undefined, flag: string) => (s ? `{${flag} && ${use(s, '  ')}}` : '')
  // A list that shows a collection gets its entries, read at build time.
  const use = (s: ComposedSection, pad = '') =>
    (s.outline.length ? `<${s.component} content={${sectionContent(s, 'astro', page)?.expr ?? contentVar(s)}} />` : `<${s.component} />`).replace(/^/, pad).trim()
  const importsFor = (secs: ComposedSection[], up: string, after: string[] = []) => {
    const filled = secs.map((s) => sectionContent(s, 'astro', page)).filter((b) => !!b)
    return [
      ...secs.flatMap((s) => [
        `import ${s.component} from '${up}components/sections/${s.component}.astro'`,
        ...(s.outline.length ? [`import ${contentVar(s)} from '${up}content/${s.contentName}.json'`] : []),
      ]),
      ...(filled.length || after.length ? [`import { entries, paragraph, text } from '${up}lib/collections'`] : []),
      ...after,
      ...(filled.length ? ['', ...filled.flatMap((b) => b.setup)] : []),
    ]
  }
  files[`${root}src/layouts/Base.astro`] = `---
import '../styles/tokens.css'
import '../styles/base.css'
${importsFor([nav, footer].filter((x): x is ComposedSection => !!x), '../').join('\n')}

interface Props {
  title: string
  nav?: boolean
  footer?: boolean
}
const { title, nav = true, footer = true } = Astro.props
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
${links.map((l) => `    ${l}\n`).join('')}${page.moving ? '    <script is:inline src="/mx-media.js" defer></script>\n' : ''}${page.sliding ? '    <script is:inline src="/mx-slider.js" defer></script>\n' : ''}${page.shaders.length ? '    <script is:inline src="/mx-shaders.js" defer></script>\n' : ''}  </head>
  <body>
${nav ? `    ${chrome(nav, 'nav')}\n` : ''}    <main>
      <slot />
    </main>
${footer ? `    ${chrome(footer, 'footer')}\n` : ''}  </body>
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

  Object.assign(files, astroCollectionFiles(page, root))

  for (const p of site.pages) {
    const { file, depth } = routeFile(p.path)
    const up = '../'.repeat(depth + 1)
    const off = [!p.show.nav && nav ? ' nav={false}' : '', !p.show.footer && footer ? ' footer={false}' : ''].join('')
    // A collection's template page: one page per entry (its slug from the entry file's name).
    const c = p.template ? page.collections?.find((x) => x.slug === p.template!.collection) : undefined
    const perEntry = c
      ? [
          `import { getCollection } from 'astro:content'`,
          '',
          'export async function getStaticPaths() {',
          `  const list = (await getCollection('${c.slug}')).filter((e) => !e.data.draft)`,
          '  return list.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))',
          '}',
          'const { entry } = Astro.props',
        ]
      : []
    const title = c ? `{\`\${text(entry.data.${c.schema.titleField})} · ${page.title.replace(/[`$\\]/g, '')}\`}` : JSON.stringify(p.path === '/' ? page.title : `${p.title} · ${page.title}`)
    files[`${root}src/pages/${file}.astro`] = `---
import Base from '${up}layouts/Base.astro'
${importsFor(p.sections, up, perEntry).join('\n')}
---
<Base title=${title}${off}>
${p.sections.map((s) => `  ${use(s)}`).join('\n')}
</Base>
`
  }
  return files
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blokmix'
}
