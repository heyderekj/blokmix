# Blokmix

**Remix website layouts and styles, then hand your design to an agent to build.**

[![License: O'Saasy](https://img.shields.io/badge/license-O%27Saasy-ffc53d)](LICENSE)

Blokmix is a visual workspace for designing websites. Start with a theme, mix built-in layouts with sections you capture, and pull the site together with one style guide. When the design is ready, export a build packet for your agent or download a starter project for Astro or Next.js.

[Visit Blokmix](https://blokmix.com)

## What you can do

- Try layouts and styles on the canvas while keeping your own copy and branding.
- Capture sections from live sites with the [Blokmix Chrome extension](extension/README.md) and add them to your mix.
- Explore different directions in separate drafts, save versions, and share a mix for editing or feedback.
- Export `BLOKMIX.md`, structured project data, design tokens, and runnable Astro or Next.js starter projects. Notes on the design travel with the build packet.
- Connect an agent through the local MCP bridge to inspect or edit a mix with your permission.

## Run locally

### Browser-only demo

With Node.js 22 and npm installed, run:

```bash
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173) to try the editor with sample content. This mode saves the mix in your browser.

### Laravel app

The full app uses Laravel 13, Inertia, React, and TypeScript. Install PHP 8.5 with SQLite support, Composer, and Node.js 22. On a fresh checkout, run:

```bash
touch database/database.sqlite
composer setup
npm run dev:laravel
```

Open [localhost:8000](http://localhost:8000) and create a local account to use saved mixes and sharing.

## Development commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Check TypeScript for the app and extension |
| `npm test` | Run the JavaScript tests |
| `php artisan test` | Run the Laravel tests |
| `npm run build` | Build the browser-only app |
| `npm run build:laravel` | Build the Laravel app's frontend assets |
| `npm run extension:build` | Build the Chrome extension into `extension/dist` |
| `npm run mcp` | Start the local MCP bridge. Enable **Let agents edit this mix** in the board menu to connect |
| `npm run export:demo` | Write a sample build packet to `.out/packet` |

The editor lives in `resources/js`, the capture extension in `extension`, and the Laravel backend in `app` and `routes`. See [CLAUDE.md](CLAUDE.md) for implementation details and clip authoring rules.

## License

Blokmix uses the [O'Saasy License](LICENSE), the same license as ReviseMy. It allows use, modification, and redistribution under its terms. The license restricts offering Blokmix or a derivative as a directly competing hosted service.
