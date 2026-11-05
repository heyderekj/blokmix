import type { ComposedPage, ComposedSection } from '../compose'
import { serialize } from '../html/serialize'
import type { HNode } from '../html/parse'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { SLIDER_JS } from './slider-runtime'
import { SHADERS_JS, SHADER_CSS } from './shaders'
import { slug } from './astro'
import { contentVar, sitePages, fontLinks, sectionCss, sectionHeader, tokensCss, type FileMap } from './shared'
import { bindContent } from './bind'
import { nextCollectionFiles, sectionContent } from './collections'

export const NEXT_VERSION = '^16.4.3'
export const REACT_VERSION = '^19.3.1'

/** A component's markup; a fragment when there's more than one root (a nav with a banner added above it). */
function jsxBody(nodes: HNode[]): string {
  if (nodes.filter((n) => n.t === 'el').length < 2) return serialize(nodes, 'jsx', 2)
  return `    <>\n${serialize(nodes, 'jsx', 3)}\n    </>`
}

export function nextFiles(page: ComposedPage, root = 'next/'): FileMap {
  const files: FileMap = {}
  const links = fontLinks(page, true)

  for (const [path, data] of Object.entries(page.mediaFiles)) files[`${root}public/${path}`] = data
  files[`${root}package.json`] = JSON.stringify(
    {
      name: slug(page.title) + '-next',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: NEXT_VERSION, react: REACT_VERSION, 'react-dom': REACT_VERSION },
      devDependencies: { typescript: '^5.9.3', '@types/react': '^19.3.0', '@types/node': '^24' },
    },
    null,
    2,
  ) + '\n'
  files[`${root}next.config.mjs`] = `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\n\nexport default nextConfig\n`
  files[`${root}tsconfig.json`] = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'react-jsx',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  ) + '\n'

  files[`${root}app/tokens.css`] = tokensCss(page)
  files[`${root}app/base.css`] = BASE_CSS_LAYERED + (page.moving ? `\n${MEDIA_CSS}` : '') + (page.shaders.length ? `\n${SHADER_CSS}` : '')
  if (page.moving) files[`${root}public/mx-media.js`] = MEDIA_JS
  if (page.sliding) files[`${root}public/mx-slider.js`] = SLIDER_JS
  if (page.shaders.length) files[`${root}public/mx-shaders.js`] = SHADERS_JS
  files[`${root}app/layout.tsx`] = `import type { Metadata } from 'next'
${page.moving || page.sliding || page.shaders.length ? "import Script from 'next/script'\n" : ''}import './tokens.css'
import './base.css'
${page.sections.map((s) => `import '../components/sections/${s.component}.css'`).join('\n')}

export const metadata: Metadata = {
  title: ${JSON.stringify(page.title)},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
${links.map((l) => `        ${l}\n`).join('')}      </head>
      <body>
        {children}
${page.moving ? '        <Script src="/mx-media.js" strategy="afterInteractive" />\n' : ''}${page.sliding ? '        <Script src="/mx-slider.js" strategy="afterInteractive" />\n' : ''}${page.shaders.length ? '        <Script src="/mx-shaders.js" strategy="afterInteractive" />\n' : ''}      </body>
    </html>
  )
}
`
  for (const s of page.sections) {
    files[`${root}components/sections/${s.component}.css`] = sectionCss(s)
    if (!s.outline.length) {
      files[`${root}components/sections/${s.component}.tsx`] = `${sectionHeader(s, 'js')}\nexport default function ${s.component}() {\n  return (\n${jsxBody(s.tree)}\n  )\n}\n`
      continue
    }
    // Words live in a content file; the page passes it in as props.
    const file = `content/${s.contentName}.json`
    files[`${root}${file}`] = JSON.stringify(s.content, null, 2) + '\n'
    files[`${root}components/sections/${s.component}.tsx`] = `${sectionHeader(s, 'js')}
import data from '@/content/${s.contentName}.json'

export default function ${s.component}({ content = data }: { content?: typeof data }) {
  return (
${jsxBody(bindContent(s.source, s.outline, file, true))}
  )
}
`
  }

  // Each route renders the shared nav and footer (unless it turns them off) around its own <main>.
  const site = sitePages(page)
  // A list that shows a collection gets its entries, read at build time.
  const use = (s: ComposedSection) => (s.outline.length ? `<${s.component} content={${sectionContent(s, 'next', page)?.expr ?? contentVar(s)}} />` : `<${s.component} />`)
  const importsFor = (secs: ComposedSection[], template = false) => [
    ...secs.flatMap((s) => [`import ${s.component} from '@/components/sections/${s.component}'`, ...(s.outline.length ? [`import ${contentVar(s)} from '@/content/${s.contentName}.json'`] : [])]),
    ...(template || secs.some((s) => s.bound?.length || s.entryBound) ? [`import { entries, getEntry, paragraph, text } from '@/lib/collections'`] : []),
  ]
  Object.assign(files, nextCollectionFiles(page, root))
  for (const p of site.pages) {
    const nav = p.show.nav ? site.shared.nav : undefined
    const footer = p.show.footer ? site.shared.footer : undefined
    const route = p.path === '/' ? 'app/page.tsx' : `app${p.path}/page.tsx`
    // A collection's template page: one page per entry, from the route's slug.
    const c = p.template ? page.collections?.find((x) => x.slug === p.template!.collection) : undefined
    const meta = c
      ? `\nexport function generateStaticParams() {\n  return entries('${c.slug}').map((e) => ({ slug: e.slug }))\n}\n\nexport async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {\n  const entry = getEntry('${c.slug}', (await params).slug)\n  return { title: \`\${text(entry?.${c.schema.titleField})} · ${page.title.replace(/[`$\\]/g, '')}\` }\n}\n`
      : p.path === '/'
        ? ''
        : `\nexport const metadata = { title: ${JSON.stringify(`${p.title} · ${page.title}`)} }\n`
    const secs = [...(nav ? [nav] : []), ...p.sections, ...(footer ? [footer] : [])]
    files[`${root}${route}`] = `${c ? "import { notFound } from 'next/navigation'\n" : ''}${[...new Set(importsFor(secs, !!c))].join('\n')}
${meta}
export default ${c ? 'async ' : ''}function Page(${c ? '{ params }: { params: Promise<{ slug: string }> }' : ''}) {
${c ? `  const entry = getEntry('${c.slug}', (await params).slug)\n  if (!entry) notFound()\n` : ''}${secs.flatMap((s) => sectionContent(s, 'next', page)?.setup ?? []).map((l) => `  ${l}\n`).join('')}  return (
    <>
${nav ? `      ${use(nav)}\n` : ''}      <main>
${p.sections.map((s) => `        ${use(s)}`).join('\n')}
      </main>
${footer ? `      ${use(footer)}\n` : ''}    </>
  )
}
`
  }
  return files
}
