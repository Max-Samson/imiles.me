# imiles.me

> Miles's bilingual (English / 中文) personal website and digital garden, built with [Astro](https://astro.build), React, and Three.js.

**English** | [简体中文](./README.zh.md) · [Visit the site](https://imiles.me)

## Features

| Area | Current implementation |
| --- | --- |
| Home and navigation | A sectioned landing page with projects, experience, essays, a technology cloud, and a digital garden; section navigation and a `⌘/Ctrl+K` search dialog. English routes live at `/`, Chinese routes at `/zh/`. |
| Blog and stories | Astro content collections and published D1 articles share the public listings. Articles show reading time, tags, sharing, Markdown copy, heading links, code-copy buttons, and a mobile table of contents when there are enough headings. Blog MDX supports KaTeX, citations, and interactive components; stories use a text-only reading layout. |
| Projects and notes | Project pages present status, technology, feature grids, and demos. Notes have their own listing and detail pages. The About page renders a bilingual experience timeline. |
| PDF reading | `/pdf` uses PDF.js for page rendering, outline and thumbnail navigation, document search, zoom, and download. Blog content can link to it through `PDFCard` and `PDFLink`. |
| Friend links | `/friends` and `/zh/friends` show approved links with client-side search. Visitors can submit a site and optional screenshot through a Turnstile-protected form. The admin can approve, reject, hide, or restore links; email notifications are available when configured. |
| Admin and CMS | `/admin` provides a dashboard, friend-link review, and a blog/story workbench. The workbench manages D1 drafts, article assets, publication, deletion, and revision history. Production admin APIs verify Cloudflare Access identity and capabilities. |
| Distribution | RSS, XML sitemap, Satori-generated OG images, generated `llms.txt`, Web App Manifest, service worker, and PWA icons. |

## Technology stack

| Layer | Technology and role |
| --- | --- |
| Rendering | Astro 5 in server-output mode with the Cloudflare adapter; React 19 islands hydrate controls and visualizations only where needed. |
| Content | Astro content collections, MDX/Markdown, `remark-math` and `rehype-katex` for math, and `rehype-slug` for heading IDs. Repository content and published D1 content are combined at runtime. |
| UI and motion | Tailwind CSS v4; Radix and shadcn/ui controls; vendored Magic UI and React Bits effects; Motion for transitions and scroll interactions; Lucide, Tabler, and Iconify icons. |
| Graphics and documents | Three.js with React Three Fiber for the plexus scene; PDF.js for the reader; Satori for OG image layout; Sharp for image processing. |
| Server and data | Cloudflare Workers, D1 with Drizzle ORM and SQL migrations, KV for cache and sessions, and Supabase Storage via the AWS S3 client. |
| Security and integrations | Cloudflare Access for admin authorization, Turnstile for friend-link applications, optional Resend email notifications, and the GitHub Contents API for the CMS Git publication path. |
| Developer workflow | TypeScript, pnpm, Biome, Astro checks, Node test suites, Husky/lint-staged, Wrangler, and GitHub Actions CI. |

## Visual system and runtime behavior

The site is dark-first with a light-mode toggle. The homepage combines a browser-only Three.js plexus, shared ambient light, scroll reveals, and a separate garden particle scene. Content pages use lighter grid and light-ray effects; interactive controls respect reduced-motion preferences. Heavy visualizations use visible or idle hydration where the page permits it.

Components have distinct homes: project controls in `src/components/ui/`, shadcn primitives in `src/registry/shadcn/`, and vendored effects in `src/registry/magicui/` and `src/registry/react-bits/`. The [component playground](https://imiles.me/playground) demonstrates buttons, navigation, inputs, overlays, and a carousel. See [UI architecture](./docs/ui.md) for placement and design conventions.

Published D1 articles appear alongside repository articles. If a D1 read fails, the repository's Astro collections still provide content. Public APIs keep friend-link contact and review fields out of the public response; admin routes use capability checks. See [server architecture](./src/server/README.md) for API and data boundaries.

## Repository map

```text
content/                   Blog (.md/.mdx), stories (.md), and experience (.mdx)
src/pages/                 English and /zh routes, admin pages, API, feeds, and OG images
src/components/            React and Astro components
src/registry/              shadcn primitives, Magic UI, and React Bits components
src/layouts/               Site, article, admin, and playground layouts
src/server/                REST APIs, Access auth, CMS, friend links, D1, KV, and storage
src/data/                  Projects, notes, links, and other site data
src/locales/               English and Chinese interface text
src/content.config.ts      Astro collection schemas
drizzle/migrations/        D1 SQL migrations
packages/pageel-workbench/ Embedded article editor
public/                    Images, fonts, icons, service worker, and generated llms.txt
scripts/                   Build, release, content generation, and performance checks
docs/                      Design and operational documentation
```

## Local development

Requires Node.js **24.22.1** (`.nvmrc`) and pnpm **11.13.1** (`packageManager` in `package.json`).

```bash
git clone https://github.com/Max-Samson/imiles.me.git
cd imiles.me
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:4321`. The repository content and UI can be developed without production credentials. Features backed by D1, Turnstile, object storage, or external services need local bindings and the relevant values from [`.env.example`](./.env.example). Keep local secrets in ignored files; do not commit them. The full Cloudflare setup is in [deployment documentation](./docs/cloudflare-production-deployment.md).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm preview` | Run development server / preview a build |
| `pnpm build` | Generate `llms.txt`, build Astro, and prepare the Cloudflare asset manifest and release metadata; no remote D1 write |
| `pnpm check` / `pnpm check:server` | Astro and server TypeScript checks |
| `pnpm lint` / `pnpm format:check` | Biome checks |
| `pnpm test:server` / `pnpm test:release` / `pnpm test:boundaries` | Server, release-policy, and build-boundary tests |
| `pnpm db:generate` / `pnpm db:check` / `pnpm db:migrate:local` | Create migrations, check Drizzle metadata, apply migrations to local D1 |
| `pnpm cf:types` | Regenerate Cloudflare binding types |
| `pnpm generate-icons` / `pnpm generate:llms` | Regenerate PWA icons / LLM-facing index |
| `pnpm perf:budget` | Check homepage performance budgets after a build |
| `pnpm release:plan` / `pnpm release:cf` | Inspect a production release / release an existing build |
| `pnpm deploy` | Build, then run `release:cf` |

Run `pnpm lint` and `pnpm format:check` before committing. CI also checks types, Drizzle metadata, local server tests, release rules, and the production build.

## Content authoring

Astro collection schemas live in [`src/content.config.ts`](./src/content.config.ts). Blog posts use `.md` or `.mdx` in `content/blog/`; stories use text-only `.md` in `content/stories/`; experience entries use `.mdx` in `content/experience/`. Blog and story frontmatter require `title`, `description`, and `pubDate`; `tags` defaults to an empty array in the schema. `lang` selects English or Chinese. In the CMS, **Save draft** keeps work in D1; **Publish** makes the article public.

Blog posts can use KaTeX and React islands. Posts conventionally close with a cross-domain *Snippet of the Week* inside `ExploreCard`; referenced posts use `Cite` and `References`. Stories contain prose only. See [`AGENTS.md`](./AGENTS.md) for authoring, image-credit, and licensing rules.

The admin workbench stores working drafts in D1. Published CMS articles are read from D1 at runtime; the publication workflow also supports a Git-based path. See [CMS workbench](./packages/pageel-workbench/README.md) and [server architecture](./src/server/README.md) for implementation details.

## Deployment

The site uses one Cloudflare Worker configured in [`wrangler.toml`](./wrangler.toml). GitHub Actions CI runs on pull requests and pushes to `main` or `master`; it validates and builds but does **not** deploy or apply remote migrations. Cloudflare production builds use `pnpm build` and release the resulting artifact with `pnpm release:cf`. The local `pnpm deploy` command runs both steps.

The release command requires committed, clean source and a matching build artifact. It checks the current production baseline and D1 schema; migration SQL changes are reviewed under the release policy before deployment. Follow [Cloudflare release instructions](./docs/cloudflare-release.md) for first-time setup and migration approval. Production secrets and resource setup are documented in [deployment setup](./docs/cloudflare-production-deployment.md).

## Credits and license

Inspired by and adapted from [`urmzd/urmzd.com`](https://github.com/urmzd/urmzd.com); see [`NOTICE`](./NOTICE). Code is [Apache-2.0](./LICENSE). Blog posts, stories, images, and branding are [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).
