# imiles.me

> Personal website and bilingual (EN/中文) digital garden of Miles — built with [Astro](https://astro.build), React, and Three.js.

**English** | [简体中文](./README.zh.md)

[![Website](https://img.shields.io/badge/website-imiles.me-blue)](https://imiles.me)
[![License: Code Apache-2.0 / Content CC BY-NC-ND 4.0](https://img.shields.io/badge/license-Apache--2.0%20%2B%20CC%20BY--NC--ND%204.0-lightgrey)](#license)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro%205-ff5d01)](https://astro.build)

## Features

- **Bilingual i18n** — English at the root, Chinese under `/zh/`, with per-locale UI strings (`src/locales/`).
- **MDX blog** — KaTeX math (`remark-math` + `rehype-katex`), heading anchors, code-block copy buttons, dynamic `Cite`/`References` citations, and the cross-domain *Snippet of the Week* convention.
- **Stories** — text-only, first-person Markdown prose with a dedicated reading layout (`story-prose`).
- **Notes / Projects / Research** — structured content pages driven by typed data files.
- **Interactive visuals** — Three.js plexus hero (React Three Fiber), GSAP-style scroll/animation islands, fuzzy blog search.
- **PWA** — web manifest, service worker, offline fallback page, and auto-generated icons.
- **Auto-generated outputs** — RSS feed, XML sitemap, per-page OG images via [Satori](https://github.com/vercel/satori), and an `llms.txt` index for LLM discovery.
- **Performance budgets** — a script that fails CI when homepage bundle budgets are exceeded.
- **Dark-mode-first** — Tailwind CSS v4 with `dark` default and light-mode toggle.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Astro](https://astro.build) 5 (server output) + [React](https://react.dev) 19 islands |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4, `tw-animate-css` |
| UI | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com), [Magic UI](https://magicui.design), custom components |
| 3D | [Three.js](https://threejs.org) via [React Three Fiber](https://r3f.docs.pmnd.rs) + [drei](https://github.com/pmndrs/drei) |
| Content | MDX/Markdown with [Astro content collections](https://docs.astro.build/en/guides/content-collections/) (`zod`-validated) |
| Deployment | [Cloudflare Workers](https://workers.cloudflare.com) (`@astrojs/cloudflare` adapter + Wrangler) |
| Tooling | [Biome](https://biomejs.dev) (lint + format), TypeScript, [Husky](https://typicode.github.io/husky/) + lint-staged |

## UI & Component Libraries

The UI is layered rather than a single library — Astro pages hydrate React islands, styled with Tailwind CSS v4 and composed from three component sources:

| Layer | Role | Location |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) | Accessible base controls: `button`, `dropdown-menu`, `navigation-menu` (new-york style, neutral base, lucide icons — see `components.json`) | `src/components/ui/` |
| [Magic UI](https://magicui.design) | Animated & decorative components: aurora text, marquee, terminal, shine border, light rays… | `src/registry/magicui/` |
| Project-custom | Floating dock, link preview, timeline, navbar menu, search input, WebGL plexus background | `src/components/ui/` |

**Magic UI** components are vendored under `src/registry/magicui/` (registered in `components.json` → `https://magicui.design/r/{name}`) to keep the external-registry boundary clear. Currently vendored: `AnimatedThemeToggler`, `AuroraText`, `FlickeringGrid`, `Highlighter`, `InteractiveHoverButton`, `LightRays`, `Marquee`, `NoiseTexture`, `PixelImage`, `ShineBorder`, and `Terminal` (with `TypingAnimation` / `AnimatedSpan`).

In-use examples: `FlickeringGrid` on route listing backgrounds, `LightRays` on landing and article/detail backgrounds, `ShineBorder` on blog/story/project/note cards, `PixelImage` + `Marquee` on note cards, `AuroraText` + `Terminal` in the About hero, `AnimatedThemeToggler` in the header, and the custom `PlexusBackground` (Three.js / R3F) on the landing page.

Adding a Magic UI component:

```bash
npx shadcn@latest add @magicui/<component-name> --path src/registry/magicui
```

> Note: prefer `npx` over `pnpm dlx` here — the shadcn CLI's temporary dependency tree hits a `zod/v4` resolution error under `pnpm dlx` (see `docs/ui.md`).

See [`docs/ui.md`](./docs/ui.md) for the full UI architecture and placement conventions.

## Project Structure

```
imiles.me/
├── src/
│   ├── pages/           # Routes: /, /blog, /stories, /notes, /projects,
│   │                    #   /about, /zh/*, RSS, sitemap, OG images
│   ├── components/      # React (.tsx) & Astro (.astro) components
│   │   └── ui/          # UI primitives (shadcn-style, Radix, custom)
│   ├── registry/        # Vendored Magic UI components (magicui/)
│   ├── layouts/         # BaseLayout.astro, ArticleLayout.astro
│   ├── blog/            # MDX blog posts (content collection)
│   ├── stories/         # Text-only Markdown stories (content collection)
│   ├── data/            # Static data: author, projects, research, notes, links…
│   ├── locales/         # en.ts / zh.ts — UI translation strings
│   ├── hooks/           # React hooks (scroll, reduced motion, text scramble…)
│   ├── lib/             # Utilities: i18n, search, seo, readTime, mdxToMarkdown…
│   └── content.config.ts# Content collection schemas (blog, stories)
├── public/              # Static assets (images, fonts, icons, sw.js, llms.txt)
├── scripts/             # Node scripts (see below)
├── docs/                # Design & analysis notes
├── .github/workflows/   # CI + deploy pipelines
├── astro.config.mjs
├── components.json     # shadcn/ui + Magic UI registry config
├── wrangler.toml        # Cloudflare Workers config
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org) **22+** (used by CI and local scripts)
- [pnpm](https://pnpm.io) **11+** — the project's package manager, pinned via `packageManager` in `package.json` (Corepack: `corepack enable`)

## Getting Started

```bash
git clone https://github.com/Max-Samson/imiles.me.git
cd imiles.me

pnpm install
pnpm dev
```

The dev server runs at `http://localhost:4321`.

> No environment variables are required for local development. Optional variables are documented under [Performance Budget](#performance-budget).

## Available Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Astro dev server |
| `pnpm build` | Production build, then prepare Cloudflare assets (`.assetsignore`) |
| `pnpm preview` | Preview the production build locally |
| `pnpm check` | Astro type & content-collection check |
| `pnpm lint` / `lint:fix` | Biome lint (with autofix) |
| `pnpm format` / `format:check` | Biome format (with check-only mode) |
| `pnpm generate-icons` | Generate PWA icons from `public/images/weblogo.jpeg` |
| `pnpm generate:llms` | Regenerate `public/llms.txt` from content collections |
| `pnpm perf:budget` | Check homepage performance budgets against `dist/` |
| `pnpm deploy` | Build and deploy to Cloudflare Workers (`wrangler deploy`) |

## Scripts (`scripts/`)

| Script | Purpose |
| --- | --- |
| `generate-icons.mjs` | Renders standard + maskable PWA icons (192/512/180) from the logo with a circular mask |
| `generate-llms-txt.mjs` | Generates `public/llms.txt` — an LLM-readable index of blog posts, stories, projects, and notes, grouped by language |
| `check-homepage-performance.mjs` | Validates bundle budgets (CSS, Hero/PlexusScene/SocialDock chunks, blocking stylesheets, KaTeX/Google Fonts on home) |
| `prepare-wrangler-assets.mjs` | Writes `dist/.assetsignore` so the Worker script isn't served as a static asset |

### Performance Budget

```bash
pnpm build
pnpm perf:budget                          # summary report
PERF_URL=http://127.0.0.1:4321/ pnpm perf:budget   # also checks HTML links & islands
PERF_BUDGET_FAIL=1 pnpm perf:budget       # exit non-zero on budget failures (CI)
pnpm perf:budget -- --json                # machine-readable report
```

## Content

Content lives in `src/blog/` (`.mdx`) and `src/stories/` (`.md`) and is validated against the schemas in `src/content.config.ts`.

- **Blog posts** — frontmatter: `title`, `description`, `pubDate`, `tags`; optional `heroImage`, `updatedDate`, `draft`, `shareText`, `lang`, `llms`. Support KaTeX math and React islands (`client:load` / `client:visible`).
- **Stories** — frontmatter: `title`, `description`, `pubDate`, `tags`; optional `draft`, `llms`. Pure prose: no images, components, headings, or math. Use `--` for em-dashes and `---` for scene breaks.
- Set `draft: true` to hide content from production.
- Posts with references use the `Cite` / `References` components; every post conventionally closes with a *Snippet of the Week* inside an `ExploreCard`.

Full authoring conventions (styling, snippets, citations, image credits) are documented in [`AGENTS.md`](./AGENTS.md).

## Deployment

The site runs as a [Cloudflare Worker](https://workers.cloudflare.com) with server-side rendering:

```bash
pnpm deploy          # pnpm build && wrangler deploy
```

`wrangler.toml` maps the Worker to the custom domain `imiles.me` (`nodejs_compat` compatibility flag).

### GitHub Actions

| Workflow | Triggers | What it does |
| --- | --- | --- |
| `ci.yml` | Pull requests to `main` | Lint, format check, Astro type check, production build, artifact upload |
| `deploy.yml` | Push to `main`/`master`, manual dispatch | Build, then `wrangler deploy` via [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action) |

The deploy workflow requires a `CLOUDFLARE_API_TOKEN` secret with permission to deploy Workers to the target account.

## Acknowledgements

Inspired by and adapted from [`urmzd/urmzd.com`](https://github.com/urmzd/urmzd.com), plus the wider open-source ecosystem (Astro, React, Three.js, Tailwind, shadcn/ui, Biome). The current site adds custom content, bilingual localization, an interactive visual experience, and production tooling (CI/CD, PWA, performance budgets, LLM-friendly outputs) for Miles.

## License

Dual-licensed:

- **Code** (source files, config, tooling) — [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) (see [`LICENSE`](./LICENSE))
- **Content** (blog posts, stories, images, branding) — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)

This project is derived from [`urmzd/urmzd.com`](https://github.com/urmzd/urmzd.com); see [`NOTICE`](./NOTICE) for the source attribution and modification record. Contributions of code are welcome under the Apache-2.0 terms; contributed images must be original or compatible with CC BY-NC-ND 4.0.
