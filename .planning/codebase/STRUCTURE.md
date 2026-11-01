---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# Codebase Structure

**Analysis Date:** 2026-11-01

## Directory Layout

```
tournament-next/
├── app/                  # App Router: routes, feature UI, global CSS
│   ├── admin/            # Staff panel, gated in the client
│   ├── banlist/          # Current banlist
│   ├── banlist-timeline/ # Banlist history, by date and by card
│   ├── calculator/       # Combo odds calculator (client only)
│   ├── calendar/         # Tournament calendar
│   ├── card-image/       # Same-origin card image route
│   ├── deck-builder/     # Deck editor (client only)
│   ├── decks/            # Public deck browser and deck view
│   ├── download/         # Client download and VIP page
│   ├── home/             # Landing page, rendered from app/page.tsx
│   ├── leaderboard/      # Ranked ladders
│   ├── login/            # Sign-in screen
│   ├── messenger/        # Full-page messenger
│   ├── privacy/, terms/  # Legal pages, one component per locale
│   ├── profile/          # Profiles, edit form, personal statistics
│   ├── simulator/        # Combo simulator, sharing and video render
│   │   └── new/          # Next-generation stage, noindex preview
│   ├── statistics/       # Meta report, archetype and card pages
│   ├── tournament/       # One tournament
│   ├── tournaments/      # Tournament list and scheduled events
│   ├── welcome/          # Post-sign-in welcome page
│   └── wiki/             # Articles, editor, panel, card pages
├── components/
│   ├── omega/            # Domain components, one folder per domain
│   └── ui/               # Design system primitives
├── contexts/             # AuthProvider
├── docs/                 # Contracts, wiki snapshots, specs and plans
├── hooks/                # useResource, useSearch, useLazyText, useAuth
├── i18n/                 # next-intl request config, ClientMessages
├── messages/             # en.json, pt.json
├── public/               # Static assets, wiki images, decklist PDF
├── scripts/              # wiki-tier-list.ts
├── utils/                # API clients, types, pure domain logic
│   ├── combo/            # Odds and hand simulation
│   ├── deck/             # Deck model, rules, codecs
│   └── simulator/        # Board state, timing, sessions
├── instrumentation.ts    # Fetch wrapper, error logging
├── proxy.ts              # Bot guard (Next's middleware file)
├── next.config.ts        # Redirects, image limits
├── vitest.config.ts      # Test aliases
└── Dockerfile            # Production image
```

## Directory Purposes

**`app/`:**
- Purpose: Routes and the UI that belongs to one route
- Contains: `page.tsx`, `layout.tsx`, `route.ts`, feature components, co-located tests
- Key files: `app/layout.tsx`, `app/styles.css`, `app/sitemap.ts`, `app/robots.ts`

**`components/ui/`:**
- Purpose: Generic, domain-free primitives
- Contains: One folder per component with `<name>.component.tsx` and `index.ts`
- Key files: `components/ui/button/`, `components/ui/dialog/`, `components/ui/chart/`, `components/ui/field/`, `components/ui/icon/`, `components/ui/navbar/`, `components/ui/header/`

**`components/omega/`:**
- Purpose: Components with game or product knowledge, shared across routes
- Contains: `ads/`, `analytics/`, `card-art/`, `infographic/`, `legal/`, `messenger/`, `profile/`, `tournament/`, `tracking/`, `wiki/`
- Key files: `components/omega/ads/ads-mode.ts`, `components/omega/messenger/use-messenger.ts`, `components/omega/infographic/infographic.tsx`

**`utils/`:**
- Purpose: Everything that isn't a component
- Contains: API clients, shared types, parsers, domain logic, constants
- Key files: `utils/auth.ts`, `utils/types.ts`, `utils/const.ts`, `utils/config.ts`, `utils/log.ts`, `utils/metadata.ts`, `utils/gtm.ts`

**`docs/`:**
- Purpose: Contracts and working documents
- Contains: `analytics/` (tracking plan, GTM export), `wiki-pages/` (article JSON and snapshots), `superpowers/plans/`, `superpowers/specs/`, `profile-api.md`, `WIKI_BLOCKS.md`, `MSGBUBBLE.md`
- Key files: `docs/analytics/tracking-plan.md`, `docs/superpowers/plans/2026-11-01-ranked-analytics-rebuild-front.md`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout
- `app/page.tsx`: Home, which renders `app/home/Home.page.tsx`
- `proxy.ts`: Request guard
- `instrumentation.ts`: Server start hook

**Configuration:**
- `next.config.ts`: Redirects, standalone output, image limits
- `tsconfig.json`: Strict options and path aliases
- `vitest.config.ts`: Test aliases and excludes
- `eslint.config.mjs`: Lint presets and ignores
- `app/styles.css`: Tailwind v4 theme tokens
- `.gitlab-ci.yml`, `Dockerfile`: Build and image

**Core Logic:**
- `utils/deck/model.ts`, `utils/deck/rules.ts`: Deck operations and legality
- `utils/combo/simulate.ts`, `utils/combo/hypergeometric.ts`: Combo odds
- `utils/simulator/draft.ts`, `utils/simulator/board.ts`: Simulator state
- `utils/statistics.ts`, `utils/power-tier.ts`: Meta report data and tiers
- `utils/explorer.ts`, `utils/global-explorer.ts`: Analytics explorer
- `utils/wiki-doc.ts`, `utils/remark.ts`: Wiki document format and Markdown

**Testing:**
- `*.test.ts` and `*.test.tsx`: Beside the file they test
- `proxy.test.ts`: The one root-level test

## Naming Conventions

**Files:**
- Design system: `kebab-case.component.tsx` with an `index.ts` barrel, as in `components/ui/page-header/page-header.component.tsx`
- Tool routes use kebab-case: `deck-editor.client.tsx`, `pool-filters.tsx`, `use-save.ts`
- Content routes use PascalCase for components: `app/statistics/DeckPage.tsx`, `app/profile/sections/Ladders.tsx`. Follow the folder you are in.
- Page bodies: `Name.page.tsx` with an `index.ts` re-export, as in `app/tournament/Tournament.page.tsx`
- Suffixes: `.client.tsx` (client root), `.loader.tsx` (`ssr: false` wrapper), `.reducer.ts`, `.const.ts`, `.types.ts`
- Hooks: `use-*.ts`
- Tests: `<file>.test.ts` or `<file>.test.tsx`

**Directories:**
- Routes and folders use kebab-case
- Dynamic segments use Next's `[id]`, `[slug]`, `[section]`

## Where to Add New Code

**New page:**
- Route: `app/<route>/page.tsx`, with `generateMetadata` using `pageMetadata`
- If client components use translations: `app/<route>/layout.tsx` with `ClientMessages namespaces={[...]}`
- Add the path to `app/sitemap.ts` if it should be indexed, or use `noIndexMetadata`
- Tests: `app/<route>/*.test.tsx`

**New API call:**
- Add it to the matching `utils/<domain>.ts`
- New domain: new `utils/<domain>.ts` following `utils/tournaments.ts`
- Shared response types: `utils/types.ts`, or local to the module when only it uses them

**New client tool:**
- `app/<tool>/page.tsx`, `<tool>.loader.tsx`, `<tool>.client.tsx`
- Pure logic: `utils/<tool>/` with tests beside it
- State: `<tool>.reducer.ts`

**New component:**
- Generic primitive: `components/ui/<name>/` with `<name>.component.tsx` and `index.ts`
- Domain widget used by several routes: `components/omega/<domain>/`
- Used by one route: inside `app/<route>/`

**New strings:**
- Add to both `messages/en.json` and `messages/pt.json`
- Client components need the namespace listed in the route's `layout.tsx`

**New analytics event:**
- Call `track` from `utils/gtm.ts`
- Document it in `docs/analytics/tracking-plan.md`

**New route with heavy server reads:**
- Add it to `config.matcher` in `proxy.ts` if bots can walk it
- Do not add wildcard image hosts in `next.config.ts`

**Utilities:**
- Shared helpers: `utils/format.ts`, or a new focused `utils/<name>.ts`
- Shared hooks: `hooks/index.ts`

**Retired URLs:**
- Add a redirect in `next.config.ts`, so shared links keep working

## Special Directories

**`.next/`:**
- Purpose: Build and dev output, including Turbopack's cache
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning artifacts
- Generated: Yes
- Committed: Yes

**`.worktrees/`, `.claude/worktrees/`:**
- Purpose: Parallel session checkouts holding copies of the source. Excluded from `vitest.config.ts` and `eslint.config.mjs`.
- Generated: Yes
- Committed: No. `.claude` is in `.gitignore`; `.worktrees/` is only in this clone's `.git/info/exclude`.

**`.tokensave/`, `graphify-out/`:**
- Purpose: Local code-graph indexes
- Generated: Yes
- Committed: No. `graphify-out/` is ignored through `*graphify*`; `.tokensave/` is only in this clone's `.git/info/exclude`.

**`brag-output/`:**
- Purpose: Generated launch video material, untracked in the working tree
- Generated: Yes
- Committed: No. It is not ignored, so avoid `git add .`.

**`docs/wiki-pages/`:**
- Purpose: Wiki article JSON and dated snapshots used by `scripts/wiki-tier-list.ts`
- Generated: Partly
- Committed: Yes

---

*Structure analysis: 2026-11-01*
