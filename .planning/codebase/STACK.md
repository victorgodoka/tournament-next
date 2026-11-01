---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# Technology Stack

**Analysis Date:** 2026-11-01

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code in `app/`, `components/`, `utils/`, `hooks/`, `contexts/`, `i18n/`, plus `proxy.ts` and `instrumentation.ts`. `strict` and `noUncheckedIndexedAccess` are on (`tsconfig.json`).

**Secondary:**
- CSS (Tailwind v4 plus hand-written) - `app/styles.css` (796 lines) and scoped sheets: `app/leaderboard/leaderboard.css`, `app/simulator/new/simulator.css`, `components/omega/messenger/messenger.css`, `components/omega/bubble/bubble.css`.
- JSON - Translation catalogues `messages/en.json` and `messages/pt.json`; wiki page snapshots in `docs/wiki-pages/`.

## Runtime

**Environment:**
- Node 24 (alpine) at runtime, Node 22 (alpine) at build - `Dockerfile`. The build stages stay on 22 on purpose; see the `ponytail:` comment there.
- Browser: most of the product runs client-side, including the deck builder, simulator and combo calculator.

**Package Manager:**
- pnpm 11.1.2, pinned through `packageManager` in `package.json`
- Lockfile: `pnpm-lock.yaml` present
- `pnpm-workspace.yaml` holds only `allowBuilds` (native build approvals). This is a single package, not a monorepo.

## Frameworks

**Core:**
- Next.js 16.4.3 - App Router, `output: "standalone"` (`next.config.ts`). Pages live in `app/`; the middleware file is `proxy.ts`.
- React 19.2.4 / React DOM 19.2.4 - App Router renders with Next's vendored React, not the one in `package.json`.
- next-intl 4.14.5 - Cookie-based locale (`en`, `pt`) with no URL prefix (`i18n/request.ts`).
- Tailwind CSS 4.3.2 through `@tailwindcss/postcss` (`postcss.config.mjs`). There is no `tailwind.config`; tokens live in `app/styles.css`.

**Testing:**
- Vitest 3.2.7 - Test runner (`vitest.config.ts`). There is no `test` script in `package.json`; run it with `pnpm vitest`.
- Testing Library (`@testing-library/react` 16.3.2, `@testing-library/dom` 10.4.1) - Component tests.
- happy-dom 20.10.6 - DOM environment, opted into per file.

**Build/Dev:**
- Turbopack - Default dev bundler for `next dev` on port 5173.
- ESLint 9.39.4 with `eslint-config-next` core-web-vitals and typescript presets (`eslint.config.mjs`).

## Key Dependencies

**Critical:**
- `next-intl` 4.14.5 - All user-facing strings. Server and client share the catalogues in `messages/`.
- `ygopro-deck-encode` 1.0.16 - Deck formats, used by `utils/deck/codecs/ydk.ts` and `utils/deck/codecs/ydke.ts`.
- `tailwind-merge` 3.6.0 - Class merging across `components/ui/` and `app/`.
- `sharp` 0.35.5 - Backs the `next/image` optimiser and `next/og` rasterising. Its cache is turned off in `instrumentation.ts` to stop a libvips leak.

**Infrastructure:**
- `unified` 11.0.5, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-sanitize`, `rehype-class-names`, `rehype-stringify` - Markdown pipeline in `utils/remark.ts`.
- `lowlight` 3.3.0 and `highlight.js` 11.12.0 - Code highlighting in `utils/code-highlight.ts` and `utils/remark.ts`.
- `pdf-lib` 1.17.1 - Fills the Konami decklist PDF in `app/deck-builder/deck-io.ts`, using `public/konami-decklist.pdf`.

Prefer these over new packages. Charts, dialogs, drag and drop and the icon set are all hand-built in `components/ui/`, `utils/simulator/` and `app/deck-builder/gestures.ts`.

## Configuration

**Environment:**
- `.env.development`, `.env.production` and `.env.example` exist. Only `.env.example` is committed (`.gitignore`).
- `NEXT_PUBLIC_*` values are inlined at build time, so they arrive as Docker build args. Adding one means changing `Dockerfile` and `.gitlab-ci.yml` together.
- Required: `NEXT_PUBLIC_API_URL`. `utils/auth.ts` falls back to `''`, and `instrumentation.ts` then skips the fetch timeout entirely.
- Optional at build: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CARD_ART_FETCH`, `NEXT_PUBLIC_SITE_URL`.
- Optional at runtime: `API_INTERNAL_URL` (server-side route to the API), `WIKI_IMAGE_BASE` (`scripts/wiki-tier-list.ts` only).
- `NEXT_PUBLIC_SITE_URL` is not a build arg, so production always uses the default `https://omega.duelistsunite.org` from `utils/config.ts`.

**Build:**
- `next.config.ts` - Redirects, `output: "standalone"`, image optimiser limits, next-intl plugin.
- `tsconfig.json` - Path aliases `@app/*`, `@i18n/*`, `@ui/*`, `@omega/*`, `@utils/*`, `@contexts/*`, `@hooks/*`.
- `vitest.config.ts` - Mirrors those aliases by hand, except `@i18n`. A test that imports `@i18n/*` will not resolve.
- `postcss.config.mjs`, `eslint.config.mjs`, `Dockerfile`, `.dockerignore`, `.gitlab-ci.yml`.

## Platform Requirements

**Development:**
- Node and pnpm 11.1.2.
- `pnpm dev` serves http://localhost:5173. `.claude/launch.json` also defines `tournament-next-alt` on port 5180.
- The API is remote: `.env.development` points the app at a hosted `NEXT_PUBLIC_API_URL`. There is no local backend in this repo.

**Production:**
- Docker container built from the `Dockerfile`, running `node server.js` as user `nextjs` on port 5173.
- Heap capped with `NODE_OPTIONS=--max-old-space-size=768`. Keep it about 75% of the container's memory limit.
- Sits behind Cloudflare and a reverse proxy. `proxy.ts` trusts `cf-connecting-ip`, so the container must only be reachable that way.

---

*Stack analysis: 2026-11-01*
