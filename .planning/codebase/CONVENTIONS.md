---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# Coding Conventions

**Analysis Date:** 2026-11-01

## Naming Patterns

**Files:**
- Tool routes and `components/`: kebab-case, such as `deck-editor.client.tsx`, `top-cut-card.tsx`, `use-save.ts`
- Content routes: PascalCase for components, such as `app/statistics/DeckPage.tsx`, `app/wiki/editor/DocEditor.tsx`, `app/tournament/sections/Standings.tsx`
- Match the folder you are in. Do not rename existing files to unify them.
- Design system components: `<name>.component.tsx` plus an `index.ts` barrel
- Role suffixes: `.client.tsx`, `.loader.tsx`, `.page.tsx`, `.reducer.ts`, `.const.ts`, `.types.ts`

**Functions:**
- camelCase verbs: `getTournament`, `listMyDecks`, `cardsByIds`, `parseBubble`
- `get*` and `list*` read from the API. A `null` result means not found.
- Hooks are `use*`; event props are `on*`
- Page-level helpers stay private and short: `framesOf`, `clock`, `tabOf`

**Variables:**
- camelCase for locals
- SCREAMING_SNAKE_CASE for module constants: `API_TIMEOUT`, `SESSION_COOKIE`, `LEADERBOARD_PAGE_SIZE`
- Numeric separators on large values: `60_000`, `2_678_400`
- Short names are fine in tight scopes: `q`, `t` (translator), `s` and `a` (reducer state and action), `ok`

**Types:**
- PascalCase. Prefer `type` aliases; `interface` is rare (20 in the codebase).
- Props types sit beside the component and are named `<Component>Props`, or written inline for small components
- Discord IDs are strings, because snowflakes exceed 2^53

## Code Style

**Formatting:**
- No Prettier, Biome or EditorConfig. Match the surrounding file.
- Most code: 2 spaces, single quotes, no semicolons, as in `utils/auth.ts` and `app/tournament/Tournament.page.tsx`
- Some older files use semicolons or double quotes, such as `contexts/auth/auth.context.tsx` and `app/profile/sections/MatchHistory.tsx`. Keep each file's style.
- Long lines are accepted. There is no line limit.
- Leading `;` guards a line starting with `(` or `[`, as in `instrumentation.ts`

**Linting:**
- ESLint 9 flat config: `eslint-config-next` core-web-vitals and typescript presets (`eslint.config.mjs`)
- `react-hooks/purity` and `react-hooks/set-state-in-effect` are errors. Load data in promise callbacks, and don't call `Date.now()` or `Math.random()` during render.
- `any` is almost absent (3 uses outside tests) and `@ts-ignore` is absent. Keep it that way.
- `eslint-disable` needs a local reason. The common one is `@next/next/no-img-element`.

**Type checking:**
- `strict` and `noUncheckedIndexedAccess`. Array access returns `T | undefined`; tests use `!` where the fixture guarantees it.
- Verify with `pnpm tsc --noEmit` and `pnpm eslint`. See `CONCERNS.md` for the one lint error currently on `main`.

## Import Organization

**Order:**
1. Framework and packages: `next/*`, `next-intl`, `react`
2. Aliased modules: `@app/`, `@ui/`, `@omega/`, `@utils/`, `@hooks/`, `@contexts/`, `@i18n/`
3. Relative imports: `./`, `../`
4. `import type` sits with its group, and inline `type` specifiers are common: `import { fetchMe, type AuthUser } from '@utils/auth'`

Ordering is loose and not enforced.

**Path Aliases:**
- `@app/*` → `app/*`
- `@ui/*` → `components/ui/*`
- `@omega/*` → `components/omega/*`
- `@utils/*` → `utils/*`
- `@hooks/*` → `hooks/*` (import from `@hooks/index`)
- `@contexts/*` → `contexts/*`
- `@i18n/*` → `i18n/*`
- Use aliases across top-level folders and relative paths within a route folder.
- New aliases must be added to both `tsconfig.json` and `vitest.config.ts`.

## Styling

**Tailwind v4 with a closed token set:**
- `app/styles.css` resets `--color-*`, `--radius-*` and shadows in `@theme`. Off-system colours fail to compile, so use tokens like `bg-surface-200`, `text-ink-dim`, `border-line`.
- Corners are chamfered through `.cut`, not `rounded-*`.
- Type scale comes from component classes: `action-md`, `signal-strong`.
- Merge classes with `twMerge` from `tailwind-merge`.
- Use a separate `.css` file only for complex scoped surfaces: messenger, simulator stage, leaderboard.

**Component variants:**
- Maps of classes keyed by a prop, as in `components/ui/button/button.component.tsx`.
- Document what each variant is for in a JSDoc on the prop.

## Copy and i18n

- All user-facing strings go in `messages/en.json` and `messages/pt.json`, in the same commit.
- Server: `await getTranslations('Namespace')`. Client: `useTranslations('Namespace')`.
- Client namespaces must be listed in the route's `layout.tsx` through `ClientMessages`.
- A few strings are still literal, such as `LOGIN_ERRORS` in `utils/auth.ts` and `FORMATS_SUPPORTED` in `utils/const.ts`. Don't add more.
- Numbers and dates that render on both server and client use a fixed locale, to avoid hydration mismatches (`components/omega/profile/labels.ts`).

## Error Handling

**Patterns:**
- API modules define an error class with `status` and optional `code`. Branch on `code`, never on `message`:

```typescript
export class TournamentApiError extends Error {
  status: number
  /** Stable code (`BAD_REQUEST`, `NOT_FOUND`). Branch on this, never on `message`. */
  code?: string
}
```

- Not found returns `null`; other failures throw:

```typescript
export const getTournament = cache(async (id: string): Promise<TournamentDetail | null> => {
  try {
    return await get<TournamentDetail>(`/tournaments/${encodeURIComponent(id)}`, 15)
  } catch (error) {
    if (error instanceof TournamentApiError && error.status === 404) return null
    throw error
  }
})
```

- Always `encodeURIComponent` path segments.
- Optional reads degrade rather than fail the page: `.catch(() => [])`, or try/catch with `log`.
- Client effects abort with `AbortController` and ignore errors from an aborted signal.
- `try { sessionStorage... } catch {}` around browser storage, which can throw.
- Show panel errors with `panelErrorText` (`utils/panel.ts`).

## Logging

**Framework:** `log` from `utils/log.ts` on the server. There is no client logger.

**Patterns:**
- `log('error', 'EVENT_NAME', { call, page, err: error })`, with an UPPER_SNAKE event name
- Pass errors as `err`, which strips them to safe fields
- `console.log` is absent from source. `console.error` is acceptable in client catch blocks and boundaries.

## Comments

**When to Comment:**
- Say why, especially when the reason came from an incident or measurement. Include dates and numbers: "On 2026-10-26 one did and drained the API's pool", "measured 2026-10-29: 180 MB flat after 15".
- Name the constraint that makes the odd-looking code correct.
- Don't restate the code.
- Mark deliberate corners with `ponytail:`, naming the ceiling and the upgrade path. Example: `// ponytail: in-memory fixed window, one container. Several replicas need a shared store.`
- Code comments are in English. `docs/` and some `Dockerfile` lines are in Portuguese.

**JSDoc/TSDoc:**
- `/** ... */` on exports and non-obvious props, written as sentences
- Module headers cite the API contract: `Tournament endpoints on omega-server-v3 (see its TOURNAMENT_API.md).`
- No `@param` or `@returns` tags. Types carry that.

## Function Design

**Size:** Pure helpers are short. Client roots are large (`deck-editor.client.tsx` is 722 lines), but logic moves out to `utils/`, reducers and `use-*.ts` hooks.

**Parameters:** Options objects past two or three arguments. `signal?: AbortSignal` is the last argument of client-callable reads.

**Return Values:** `null` for absent, typed result objects (`result.ok`) when the UI must show the failure.

**Components:**
- Arrow functions: `export const Name = (...) => ...` is the norm (308 uses against 1 `export function`).
- Next's special exports stay as named functions: `generateMetadata`, `register`, and `page.tsx` default exports through `export default Name`.
- In Next 15+, `params` and `searchParams` are promises. Await them in the route.
- Accessibility: `aria-label` on icon-only buttons, per the `icon` size note on `Button`.

## Module Design

**Exports:** Named exports everywhere, except Next's required defaults and `*.client.tsx` targets of `next/dynamic`.

**Barrel Files:** One per component folder, re-exporting that component. `hooks/index.ts` holds the shared hooks directly. There is no top-level barrel for `utils/`.

**Client boundary:**
- `'use client'` goes on the smallest leaf that needs it. Files in `utils/` never carry it.
- A server component can pass server-rendered nodes into a client tool as props, as `promo={<VipPromo />}` does in `app/deck-builder/page.tsx`.

**Git:**
- Conventional Commits with a scope: `feat(statistics): ...`, `refactor(ci): ...`, `docs(statistics): ...`
- Commits go without a `Co-Authored-By` trailer.

---

*Convention analysis: 2026-11-01*
