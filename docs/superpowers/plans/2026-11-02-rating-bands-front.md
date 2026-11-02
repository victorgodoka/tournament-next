# Rating Bands and Filters (front) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The statistics page opens on the aggregate band, names bands by games, explains the band of a game and the filters in the method box, and the admin settings form edits the filters and shows what they drop.

**Architecture:** `utils/statistics.ts` gains the new band list and the `fit` fields; `Pickers` and the method copy read them; `app/admin/staff/Settings.tsx` gains the `analytics.filters` group on the existing `GET/PATCH /panel/settings` client.

**Tech Stack:** Next.js App Router, React 19, next-intl, vitest.

**Spec:** omega-server-v3 `docs/superpowers/specs/2026-11-02-rating-bands-and-filters-design.md` §5–§6; contract omega-server-v3 `docs/front/STATISTICS_API.md` and `PANEL_API.md` §10 after the server plan lands. Needs an API running the server plan.

## Global Constraints

- `BANDS = ['aggregate', 'all', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Omega']`; `scopeFrom` defaults to `aggregate`; `scopeQuery` omits `band` when it is `aggregate`.
- Picker labels: aggregate "{floor} and up · {games} games", all "All ratings · {games} games", a tier "{band} · {games} games"; both locales keep the same key set.
- Settings form: `analytics.filters` with the five fields, defaults `{ minPlayerGames: 10, minListGames: 5, minKeyGames: 30, eloCap: 3000, aggregateFloor: 'Gold' }`, sent only when changed (as the other groups do in `settingsBody`).
- Verify with `npx tsc --noEmit`, `npx eslint <files>`, `npx vitest run <files> --exclude ".claude/**" --exclude ".worktrees/**"`; never `next build`; in a worktree use `npx`, never `pnpm`.

## Review Focus

1. A season with no `aggregate` band (every game under the floor): the page falls back to `all` without a 404 (the server answers 404 for the band; the page retries `all` and says so). Pinned in Task 1.
2. The method box shows the filter values of the current build (from `fit`), not the defaults. Pinned in Task 1.
3. The settings form's `dropped` counts read the open season's `all` band and say "no build yet" when absent. Pinned in Task 2.

---

### Task 1: Bands on the page

**Files:**
- Modify: `utils/statistics.ts` (`BANDS`, `scopeFrom`, `scopeQuery`, `Fit` gains `dropped: { players, lists, iron, total } | null` and `aggregateFloor: string`, `Meta.bands[].games`), `app/statistics/Pickers.tsx`, `app/statistics/page.tsx` (fallback to `all` on a 404 for `aggregate`), the method section component (grep `Statistics.method`), `messages/en.json` and `messages/pt.json` (`pickers.bandOption` → games, new `pickers.aggregateOption`, `pickers.allOption`, `method.bands`, `method.filters` with `{minPlayerGames}` … placeholders)
- Test: `utils/statistics.test.ts` (`scopeFrom` default, `scopeQuery` omission), a `Pickers` render test with a hand-made `bands` list

- [ ] **Step 1:** failing tests: `scopeFrom({})` → `band: 'aggregate'`; `scopeQuery({ …, band: 'aggregate' })` has no `band`; `Pickers` renders "Gold and up · 1,234 games" first.
- [ ] **Step 2:** run: fail. **Step 3:** implement. **Step 4:** tests, `tsc`, `eslint`; browser on the dev server against the dev API: the selector, the method box; commit `feat(statistics): aggregate band and bands by games`.

---

### Task 2: Filters in the settings form

**Files:**
- Modify: `utils/panel.ts` (`Filters` type, `DEFAULT_FILTERS`, `PanelSettings['analytics.filters']`), `app/admin/staff/Settings.tsx` (fields, `settingsBody`, the `dropped` block reading `getMeta({ ladder, window: 'season', band: 'all' })` for each ladder)
- Test: `app/admin/staff/Settings.test.tsx` (new: `settingsBody` sends only changed groups; a draft with `minListGames: 0` sends `{ 'analytics.filters': { minListGames: 0 } }`)

- [ ] **Step 1:** failing test. **Step 2:** run: fail. **Step 3:** implement. **Step 4:** tests, `tsc`, `eslint`; browser: change a floor, save, reload; commit `feat(admin): analytics filters in settings`.
