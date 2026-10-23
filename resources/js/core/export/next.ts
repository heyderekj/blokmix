import type { ComposedPage } from '../compose'
import { serialize } from '../html/serialize'
import { BASE_CSS_LAYERED } from './base-css'
import { MEDIA_CSS, MEDIA_JS } from './media-runtime'
import { slug } from './astro'
import { fontLink, sectionCss, sectionHeader, tokensCss, type FileMap } from './shared'

export const NEXT_VERSION = '^16.4.3'
export const REACT_VERSION = '^19.3.1'

export function nextFiles(page: ComposedPage, root = 'next/'): FileMap {
  const files: FileMap = {}
  const href = fontLink(page)

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
  files[`${root}app/base.css`] = BASE_CSS_LAYERED + (page.moving ? `\n${MEDIA_CSS}` : '')
  if (page.moving) files[`${root}public/mx-media.js`] = MEDIA_JS
  files[`${root}app/layout.tsx`] = `import type { Metadata } from 'next'
${page.moving ? "import Script from 'next/script'\n" : ''}import './tokens.css'
import './base.css'
${page.sections.map((s) => `import '../components/sections/${s.component}.css'`).join('\n')}

export const metadata: Metadata = {
  title: ${JSON.stringify(page.title)},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
${href ? `        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />\n        <link rel="stylesheet" href="${href}" />\n` : ''}      </head>
      <body>
        <main>{children}</main>
${page.moving ? '        <Script src="/mx-media.js" strategy="afterInteractive" />\n' : ''}      </body>
    </html>
  )
}
`
  for (const s of page.sections) {
    files[`${root}components/sections/${s.component}.css`] = sectionCss(s)
    files[`${root}components/sections/${s.component}.tsx`] = `${sectionHeader(s, 'js')}
export default function ${s.component}() {
  return (
${serialize(s.tree, 'jsx', 2)}
  )
}
`
  }

  files[`${root}app/page.tsx`] = `${page.sections.map((s) => `import ${s.component} from '@/components/sections/${s.component}'`).join('\n')}

export default function Page() {
  return (
    <>
${page.sections.map((s) => `      <${s.component} />`).join('\n')}
    </>
  )
}
`
  return files
}
