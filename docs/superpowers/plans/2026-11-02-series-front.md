# Series (front) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin page to create, edit and delete Series on the panel's `/panel/series` routes.

**Architecture:** `utils/panel.ts` gains the Series client (section 9.4 of the server's `PANEL_API.md`); `app/admin/cards/series/page.tsx` is a client page in the mould of `app/admin/cards/ignored/page.tsx` (list with `DataTable`, pickers with `Lookup`), plus a form component for one Series.

**Tech Stack:** Next.js App Router, React 19, vitest.

**Spec:** omega-server-v3 `docs/superpowers/specs/2026-11-02-series-design.md` §5–§6; the API contract is omega-server-v3 `docs/front/PANEL_API.md` §9.4 once the server plan's Task 3 lands. Needs an API running the server plan's Tasks 1–2.

## Global Constraints

- Series code shown as the setcode it becomes (name from the `archetype` field) or `65536 + id` for a new one; the list says which kind in one word.
- Pickers: `findSetcodes` for `archetype` and `archetypes`, `findCards` for `cards` and `mentions` (both in `app/admin/cards/shared.tsx`); the `archetype` picker excludes codes already in `archetypes` and vice versa.
- No `mode`, `keep`, `cover` fields.
- Verify with `npx tsc --noEmit`, `npx eslint <files>`, `npx vitest run <files> --exclude ".claude/**" --exclude ".worktrees/**"`, and the browser against the dev API; never `next build`. In a worktree, `node_modules` is a junction: run tools with `npx`, never `pnpm`.

## Review Focus

1. Saving a Series whose `archetypes` holds the chosen `archetype` is refused by the API with a `400`: the form shows the API's message, not a generic one. Pinned in Task 1.
2. Editing: the form opens with every field of the Series, and a save with no change sends the whole record (the API's PATCH keeps missing fields anyway). Pinned in Task 1.
3. Deleting asks for confirmation and reloads the list on `204`. Pinned in Task 1.

---

### Task 1: Client and page

**Files:**
- Modify: `utils/panel.ts` (after the ignored-archetypes block), `app/admin/AdminShell.tsx` (nav item `{ href: '/admin/cards/series', label: 'Series' }` after Staples)
- Create: `app/admin/cards/series/page.tsx`, `app/admin/cards/series/SeriesForm.tsx`, `app/admin/cards/series/SeriesForm.test.tsx`
- Test: `utils/panel.test.ts` (extend if it covers the other panel clients)

**Interfaces (Produces):**

```ts
export type SeriesCard = { id: number; name: string | null; kind: string | null }
export type Series = { id: number; code: number; name: string; description: string; archetype: { code: number; name: string | null } | null; archetypes: { code: number; name: string | null }[]; cards: SeriesCard[]; mentions: SeriesCard[]; updatedAt: string }
export type SeriesInput = { name: string; description: string; archetype: number | null; archetypes: number[]; cards: number[]; mentions: number[] }
export const listSeries = (signal?: AbortSignal): Promise<Series[]>           // GET /panel/series → .series
export const getSeries = (id: number, signal?: AbortSignal): Promise<Series>
export const createSeries = (input: SeriesInput): Promise<Series>             // POST
export const updateSeries = (id: number, input: SeriesInput): Promise<Series> // PATCH, whole record
export const deleteSeries = (id: number): Promise<void>                       // DELETE
export const toSeriesInput = (series: Series): SeriesInput                    // pure, for the edit form
```

- [ ] **Step 1: Write the failing tests** — `toSeriesInput` maps `archetype.code`, `archetypes[].code`, `cards[].id`, `mentions[].id`; `SeriesForm` (renderToStaticMarkup) opened on a Series renders its name, its archetype name, each child setcode and each card as a removable chip; the submit payload for an unchanged form deep-equals `toSeriesInput(series)` (test the pure `payloadOf(state)` the form uses); the API error text passes through to the `Alert`.
- [ ] **Step 2:** run them: fail.
- [ ] **Step 3:** implement: the page lists Series (`DataTable`: name, kind "becomes <setcode name>" or "new", counts of setcodes / cards / mentions, updated day) with "New Series", row "Edit" and "Delete" (`window.confirm`); the form holds name, description, the `archetype` lookup (single, clearable), `archetypes` lookup with chips, `cards` and `mentions` lookups with chips; save calls `createSeries` / `updateSeries` then reloads; errors through `panelErrorText`; `NextBuildNote` under the form.
- [ ] **Step 4:** tests pass; `tsc`, `eslint`; browser on the dev server: create a Series over a setcode with one mention, see it listed, edit, delete. Commit `feat(admin): series page`.
