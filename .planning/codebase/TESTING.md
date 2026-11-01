---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# Testing Patterns

**Analysis Date:** 2026-11-01

## Test Framework

**Runner:**
- Vitest 3.2.7
- Config: `vitest.config.ts`, which sets aliases and excludes only

**Assertion Library:**
- Vitest's `expect`. `@testing-library/jest-dom` is not installed, so assert with `toBeTruthy()` and `toBeNull()` on queries.

**Run Commands:**
```bash
pnpm vitest run                       # Run all tests
pnpm vitest                           # Watch mode
pnpm vitest run utils/deck            # One folder
pnpm tsc --noEmit                     # Type check
pnpm eslint                           # Lint
```

There is no `test` script in `package.json`, and no coverage provider is installed. `vitest.config.ts` already excludes `.claude/**` and `.worktrees/**`, so other sessions' copies are not picked up.

Prefer `tsc` and `eslint` over `next build` for verification.

**Baseline on 2026-11-01:** `tsc --noEmit` is clean and `eslint` has 1 error. `vitest run` takes 50-80 s. Under load, 2 of its 1,069 tests can fail and then pass when their files run alone. See "Known Bugs" in `CONCERNS.md`.

## Test File Organization

**Location:**
- Co-located with the source file

**Naming:**
- `<source>.test.ts` for logic, `<source>.test.tsx` for components

**Structure:**
```
utils/deck/model.ts
utils/deck/model.test.ts
app/deck-builder/my-decks.tsx
app/deck-builder/my-decks.test.tsx
proxy.ts
proxy.test.ts
```

99 test files sit beside 453 source files.

## Test Structure

**Suite Organization:**
```typescript
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteDeck, listMyDecks, type DeckSummary } from '@utils/decks'
import { MyDecks } from './my-decks'

const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@utils/decks', () => ({ listMyDecks: vi.fn(), deleteDeck: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MyDecks', () => {
  it('lists the decks and loads the next page with the cursor', async () => {
    vi.mocked(listMyDecks).mockResolvedValueOnce({ decks: [], nextCursor: 'c1' })
    await setup()
    expect(listMyDecks).toHaveBeenLastCalledWith('c1')
  })
})
```

**Patterns:**
- Setup: a local `setup()` helper that renders inside `await act(async () => ...)`
- Teardown: `cleanup()` and `vi.clearAllMocks()` in `afterEach`, plus resetting shared mock objects. `cleanup` is required: there is no global setup file.
- Assertion: test behaviour through visible text and calls to the mocked API
- Test names are sentences describing behaviour
- Inline comments explain non-obvious expectations: `// last page`

## DOM Environment

The default environment is Node. Component tests opt in with a pragma on line 1:

```typescript
// @vitest-environment happy-dom
```

43 test files use it. Pure logic tests omit it and run faster.

## Mocking

**Framework:** Vitest's `vi.mock`, `vi.fn`, `vi.stubGlobal`

**Patterns:**
```typescript
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => (values?.name ? `${key}:${values.name}` : key),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
```

The translator mock returns the key, so tests assert on message keys such as `myDecks.more`, not on English copy.

**What to Mock:**
- `next-intl` (22 files), `next/image` (15), `@hooks/index` (13), `next/navigation` (12)
- API modules: `@utils/cards` (9), `@utils/decks` (7), `@utils/combos` (4)
- `fetch`, via `vi.stubGlobal`, when testing an API module itself

**What NOT to Mock:**
- Pure domain code in `utils/deck/`, `utils/combo/`, `utils/simulator/`. Reducers and client tests run the real logic.
- `hypergeometric` and `simulate` results. Assert exact values.

## API Module Tests

Stub `fetch` and assert on the URL built:

```typescript
const capture = () => {
  const fetchMock = vi.fn(async (input: string) => {
    void input
    return new Response(JSON.stringify({ matches: [], nextCursor: null }))
  })
  vi.stubGlobal('fetch', fetchMock)
  // `API_URL` is empty without NEXT_PUBLIC_API_URL, so the path is relative: give it a base to parse against.
  return () => new URL(fetchMock.mock.calls[0]![0], 'http://api.test')
}

afterEach(() => vi.unstubAllGlobals())
```

See `utils/profile.test.ts` and `utils/statistics.test.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
const summary = (id: string, name: string): DeckSummary => ({
  id,
  owner: { id: 'u1', name: 'kaiba', avatarUrl: null },
  name,
  // ...
})
```

**Location:**
- Local factory functions at the top of each test file. There is no shared fixtures folder.
- Types come from the real module, so an API shape change breaks the factory at compile time.

## Coverage

**Requirements:** None enforced. CI runs no tests.

**View Coverage:**
```bash
pnpm vitest run --coverage   # Needs @vitest/coverage-v8, which is not installed
```

Well covered: `utils/deck/`, `utils/combo/`, `utils/simulator/`, `app/deck-builder/`, `app/calculator/`, `app/simulator/`, `components/omega/ads/`.

Thin or uncovered: see "Test Coverage Gaps" in `CONCERNS.md`.

## Test Types

**Unit Tests:**
- Pure functions, reducers, codecs and parsers, without a DOM

**Integration Tests:**
- Client roots rendered with API modules mocked, such as `app/deck-builder/deck-editor.client.test.tsx` and `app/simulator/new/simulator.client.test.tsx`
- `app/simulator/simulator.client.test.tsx` is large, because it drives the board through real transitions

**E2E Tests:**
- Not used. Changes that render are verified by hand in the browser preview against the dev server on port 5173.
- With no `Origin` header, the API rejects some server fetches, so wiki `[card:ID]` tags can fall back to passcodes on localhost.

## Common Patterns

**Async Testing:**
```typescript
await act(async () => fireEvent.click(screen.getByText('myDecks.more')))
expect(listMyDecks).toHaveBeenLastCalledWith('c1')
```

**Timers:**
- 13 test files use `vi.useFakeTimers()`. Debounces, auto-save and polling depend on them. Restore with `vi.useRealTimers()` in `afterEach`.

**Error Testing:**
Reject with the module's real error class, so `instanceof` branches in the code under test run (`app/deck-builder/use-save.test.tsx`, `app/calculator/calculator.client.test.tsx`):

```typescript
vi.mocked(updateDeck).mockRejectedValue(new DeckConflictError(latest))
vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(500))
vi.mocked(getDeck).mockRejectedValue(new DeckApiError(403))
```

**BigInt and exact values:**
```typescript
expect(choose(40, 5)).toBe(658008n)
expect(atLeast(d, 1).p).toBeCloseTo(0.33755, 4)
```

**Snapshots:**
- Not used. Assert specific values.

---

*Testing analysis: 2026-11-01*
