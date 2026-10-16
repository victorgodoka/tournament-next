# Deck editor — design

Date: 2026-10-16
Status: approved in brainstorming, awaiting spec review
Repos: `tournament-next` (front), `omega-server-v3` (API)

## Goal

Rebuild `/deck-editor` (today an empty stub; the previous builder was deleted in `99c53b1`) as the most
complete Yu-Gi-Oh! deck builder available: fast on desktop, first-class on phones, exporting to every
program players use, with decks saved to the user's account, shared publicly, analysed, and versioned.
It uses the Omega Hub design system in `app/styles.css` and the components in `components/ui`.

References the user supplied: the YGO Omega client editor (Main/Extra/Side with type-count boxes, card
detail panel), Duels.ink (filter chip bar, −/+ per card, cost curve, grid/list toggle, hover preview) and
the Runeterra builder (deck strip list, copy dots under pool cards, chip filters).

## Decisions

| Topic | Decision |
|---|---|
| Persistence | User account on omega-server-v3. Logged-out users can build and export; only Save asks to log in |
| Prices and rarities | Out of scope. No data source in the stack; a later sub-project if wanted |
| Scope of this spec | Core editor, account saving, import/export hub, analysis, public decks, version history — shipped in four phases |
| Desktop layout | Hybrid deck-first: deck on the left (hero), card pool on the right, filters in a drawer, card detail as hover preview + sheet |
| Mobile layout | Card pool full screen with a pull-up deck tray |
| Logic placement | Client-side deck core (pure TS); thin server that stores, checks structure, and computes legality badges in SQL |
| Card visuals | Full card scans from `https://ygopro.online/assets/card-images/common/{id}.jpg` (alt-art passcodes resolve), with our own badges on top |
| KONAMI PDF | The official KONAMI decklist form, its fields filled with `pdf-lib` |
| Share image | Canvas PNG with a Duelists Unite Hub signature band |

## Constraints found during exploration

- **Card API** (`GET /cards`, `docs/front/CARDS_API.md`): full search, archetypes, five banlists
  (`GET /banlists`: OCG, TCG, WCS, Genesys, Genesys OCG). Genesys lists have `pointCap: 100` and
  `bannedTypes: ["pendulum","link"]`; a card's `banlists` field lists only the lists that restrict it.
  `limit` max 100 per page.
- **No CORS on ygopro.online.** Images drawn on a canvas must load through Next's optimiser
  (`/_next/image?url=…`, same origin) or the canvas is tainted and cannot export. `next.config.ts`
  already allows `/assets/card-arts/**`; add `/assets/card-images/**` to `images.remotePatterns`.
  `imageSizes`/`deviceSizes` are fixed lists — canvas loads must request a width from them (256 for
  grid tiles, 640 for previews).
- **Omega deck code** = base64 of raw DEFLATE: byte 0 main+extra count, byte 1 side count, then uint32 LE
  passcodes, one per copy (`omega-server-v3/src/modules/profile/deck.ts`). The main/extra boundary is
  not stored; decode splits by card type.
- **Deck labels**: `resolveDeckLabels` (`profile/deck.labels.ts`) already turns a card list into an
  archetype name and art card, cached in `deck_labels` by `hashDeck`.
- **Front verification** is `tsc --noEmit` + eslint (no `next build`). React lint rules treat purity and
  set-state-in-effect as errors.

## Architecture

### Server — `omega-server-v3/src/modules/decks/`

Modeled on the wiki module (`wiki_articles` / `wiki_revisions`). Files: `decks.routes.ts`,
`decks.service.ts`, `decks.repository.ts`, `decks.validation.ts`, `decks.test.ts`, plus
`docs/front/DECKS_API.md` and a `decks` section in `docs/POSTGRES_DB.md`.

**`decks`**

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `owner_id` | FK → `users`, `ON DELETE CASCADE` | |
| `name` | `text` | 1–80 chars |
| `notes` | `text` | 0–5000 chars, Markdown, rendered sanitised |
| `format` | `int` | Banlist id from `GET /banlists`; `NULL` = no format |
| `main`, `extra`, `side` | `int[]` | Passcodes, one per copy, order kept |
| `tags` | `jsonb` | `{ [passcode]: string[] }` role tags (Starter, Extender, Hand trap, Brick, custom) |
| `visibility` | `text` CHECK in (`private`,`unlisted`,`public`) | default `private` |
| `cover_card_id` | `int` | `NULL` = use the label's art card |
| `deck_hash` | `text` | `hashDeck(main + extra)`, joins `deck_labels` |
| `revision` | `int` | Number of the latest revision; optimistic-concurrency token |
| `created_at`, `updated_at` | `timestamptz` | |

Indexes: `(owner_id, updated_at desc)`; `(visibility, updated_at desc) where visibility = 'public'`;
`deck_hash`.

**`deck_revisions`**: `deck_id` FK `ON DELETE CASCADE`, `revision int`, the full saved content
(`name`, `notes`, `format`, `main`, `extra`, `side`, `tags`), `created_at`. PK `(deck_id, revision)`.
Deck and first revision are inserted in one statement (CTE), as the wiki does. Restore writes a new
revision with the old content.

**Routes**

| Route | Auth | Purpose |
|---|---|---|
| `GET /decks/mine` | required | Owner's decks, newest first, cursor paged |
| `POST /decks` | required | Create; body is the deck content + visibility |
| `GET /decks/:id` | optional | Owner sees any; others see `public`/`unlisted`, else `404` |
| `PATCH /decks/:id` | owner | Body carries `baseRevision`; mismatch → `409 { latest: Deck }`. `force: true` skips the check |
| `DELETE /decks/:id` | owner | |
| `GET /decks/:id/revisions` | owner | List: `revision`, `created_at`, card counts |
| `GET /decks/:id/revisions/:rev` | owner | One revision's content (for compare) |
| `POST /decks/:id/revisions/:rev/restore` | owner | New revision with that content |
| `GET /decks` | none | Public browse: `archetype`, `format`, `legal` (`tcg`/`ocg`/`wcs`/`genesys`), cursor paged |

**Structural validation** (server rejects with `400`): main ≤ 60, extra ≤ 15, side ≤ 15; ≤ 3 copies of a
card across all zones, counting alternate arts as the original; every passcode exists in `cards`.
Banlist legality is **not** enforced on write — illegal drafts save.

**Read-time enrichment**: every deck response carries `label` (`{ name, artCardId }` from
`resolveDeckLabels`), `owner` (`{ id, name }`), and `legal: { tcg, ocg, wcs, genesys, genesysOcg }`
computed in SQL against `banlist_cards` (copy limits; Genesys points ≤ cap and no banned types).

### Front — deck core `utils/deck/`

Pure TypeScript, no React, fully unit-tested.

| File | Responsibility |
|---|---|
| `types.ts` | `Deck` (`main`/`extra`/`side` passcode arrays, `format`, `tags`), `Zone`, `CardData` (the API `Card` fields the editor needs) |
| `model.ts` | `add(deck, card, zone?)` (routes extra-deck types to Extra when zone omitted), `remove`, `move`, `reorder`, `sortZone` (game order: monsters by frame type then level desc then name, spells, traps), `copiesOf` (alt arts count as the original) |
| `rules.ts` | `validate(deck, cards, banlist) → Problem[]`: zone sizes (main 40–60, extra/side ≤ 15), copy limit 3, banlist status, Genesys points vs cap and banned types, not released in the format's region (`released.tcg`/`ocg`) |
| `codecs/ydk.ts` | `.ydk` text (`#main`, `#extra`, `!side`) |
| `codecs/ydke.ts` | `ydke://` via the installed `ygopro-deck-encode` |
| `codecs/omega.ts` | Omega code via native `CompressionStream`/`DecompressionStream('deflate-raw')` |
| `codecs/text.ts` | `3 Card Name` lines grouped by `Main/Extra/Side` headers; decode returns names to resolve |
| `codecs/csv.ts` | `qty,name,passcode,zone` |
| `codecs/detect.ts` | Sniffs pasted text: `ydke://`, `#main`/`#created`, base64 that inflates, else text list |
| `odds.ts` | Exact multivariate hypergeometric: P(≥a of group A and ≥b of group B … in n cards); seeded shuffle for the hand simulator |
| `diff.ts` | Per-zone card diff between two decks (used by history and import-merge) |

Card names in imports resolve with `GET /cards?name=` (exact, batched with bounded concurrency);
passcodes with `GET /cards?id=a,b,c` (comma list, `idSearched` maps results back).

### Front — app

| Path | Contents |
|---|---|
| `app/deck-editor/page.tsx` | Server entry, metadata; renders the client editor. Reads `?d=<ydke>` for unsaved share links |
| `app/deck-editor/[id]/page.tsx` | Edit a saved deck (owner); others are redirected to `/decks/[id]` |
| `app/deck-editor/` components | Editor shell, toolbar, deck zones, card pool, filters drawer, detail sheet, mobile tray, dialogs |
| `app/deck-editor/deck-editor.reducer.ts` | Editor state: deck, undo/redo stacks (cap 100), view mode, selection, dirty flag |
| `app/deck-editor/use-card-cache.ts` | In-memory `Map<passcode, CardData>` filled from every search and lookup, so validation never waits on the network |
| `app/decks/page.tsx` | Public browse |
| `app/decks/[id]/page.tsx` | Read-only deck page, metadata, OG image route |
| `utils/decks.ts` | API client for the decks routes, same style as `utils/cards.ts` |

Strings go in `messages/en.json` and `messages/pt.json`.

## Editor UX

### Desktop (≥ 1024 px)

- **Toolbar**: inline-editable name; format picker (from `GET /banlists`); validity pill (`Legal` or
  `N problems`, opens the problems list); undo/redo; sort; Import; Export; Share; Save (dot when dirty);
  History; ⋯ (My decks, New, Delete).
- **Deck area (left, ~62%)**: Main, Extra, Side sections, each with `TypeCounts` and a count. View modes:
  **Grid** (card scans), **List** (rows with − / +), **Stacked** (copies collapsed into one tile with ×N).
  The view mode is remembered per device. Collapsible analysis strip below.
- **Card pool (right, ~38%)**: search with a name / card-text toggle (`fname` vs `q`, debounced 250 ms);
  quick chips (Monster, Spell, Trap, Extra, the 7 attributes); sort; "Only legal in format" (on by
  default when a format is set); **Filters drawer** with every API filter — archetype lookup
  (`GET /archetypes`), `types` (all-of), race, level/ATK/DEF/scale ranges, link-arrow picker, release
  window (requires format region), banlist status or Genesys points. Infinite scroll, 60 per page.
  Each tile shows copy dots (cards already in the deck) and a limit or points badge.
- **Card detail**: hover preview (fine pointers only, 300 ms delay) with the scan and full text.
  Enter / double-click opens the detail sheet: full text, PT/JP names, erratas, status on every
  banlist, alt-art picker (stores that passcode), − / + per zone.

### Interactions

| Input | Effect |
|---|---|
| Click pool card | +1 to Main (Extra for extra-deck types) |
| Right-click or Shift+click pool card | +1 to Side |
| Click deck card | −1 |
| Drag | Between zones, from pool, or reorder within a zone |
| `/` | Focus search |
| Arrow keys | Move focus across cards |
| `+` / `−` / `S` | Add / remove / add to Side for the focused card |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+S` | Save |

Adding a card that is at its limit does nothing visible except a short shake and a live-region message
("Ash Blossom is at 3 copies"). Counts are announced in an `aria-live="polite"` region.

### Mobile (< 1024 px)

- Card pool fills the screen; search and chips pinned at the top; filters in a full-height sheet.
- Tap a card → detail sheet with − / + per zone. Long-press → +1 to Main (haptic tick where
  `navigator.vibrate` exists).
- **Deck tray** pinned to the bottom: zone counts, validity flag, last 5 added. Drag up (or tap) for the
  full deck: Main / Extra / Side / Stats tabs, toolbar actions under ⋯. Swipe a deck row left to remove
  one copy.
- Tap targets ≥ 44 px. No hover-only affordances.

### Validation display

Live, never blocking. Problem cards get a crimson edge (`--color-crimson-lift`); the problems list links
to each card. Genesys shows a points meter (`used / 100`).

### Persistence

- Draft autosaves to `localStorage` on every change (debounced 500 ms), keyed by deck id or `new`.
  Every read/write wrapped in try/catch; the editor works without storage.
- `beforeunload` warns when there are unsaved server changes.
- Opening a saved deck with a newer local draft offers "Restore draft" or "Discard".

## Import, export, share

| Format | Export | Import |
|---|---|---|
| `.ydk` | Download, copy | File drop, paste |
| `ydke://` | Copy | Paste |
| Omega code | Copy | Paste |
| Text list | Copy, `.txt` | Paste (names resolved via API) |
| CSV | Download | File drop |
| Share image (PNG) | Download, `navigator.share` with file | — |
| KONAMI decklist PDF | Download | — |
| Share link | `/decks/[id]` when saved, else `/deck-editor?d=<ydke>` | Opening the link |

- **Import dialog**: one paste box with auto-detect, plus file drop anywhere on the editor. Unmatched
  passcodes or names are listed back ("2 cards couldn't be matched: …"). Choose Replace or Merge
  (merge shows the `diff.ts` preview).
- **Export dialog**: one tile per format with Copy / Download. States which programs read each format.
  Master Duel and Neuron use closed in-game codes; the dialog says the text list is the way across.
- **Share image**: `<canvas>` 1200 px wide. Header: deck name, archetype label, format, validity,
  `TypeCounts`. Body: Main / Extra / Side grids of scans, stacked copies as ×N. Footer signature band:
  Duelists Unite Hub mark, "Built on Duelists Unite Hub", owner handle when saved, site URL. Scans load
  through `/_next/image` at width 256. The same layout drives the `/decks/[id]` OG image (rendered
  server-side with `next/og` at 1200×630, cropped to header + Main).
- **KONAMI PDF**: the official TCG decklist form in `public/forms/`; `pdf-lib` (new dependency,
  dynamically imported only when this export runs) fills its fields. Player name, KONAMI ID, event and
  date come from a small form remembered in `localStorage`. Cards grouped Monster / Spell / Trap / Extra /
  Side with quantity and name. If a section has more unique cards than the form has rows, the export
  stops and lists what does not fit.

## Analysis

- **Breakdown**: `TypeCounts` with bar; Monster / Spell / Trap ratio; level/rank/link, attribute and race
  distributions (`BarList` from `components/ui/chart`). Clicking a bar highlights those cards in the deck.
- **Role tags**: tag deck cards Starter, Extender, Hand trap, Brick, or a custom tag; stored in `tags`.
- **Odds calculator**: exact multivariate hypergeometric over tag groups or hand-picked cards; going
  first (5) or second (6), plus "+N draws". Example output: "≥1 Starter and ≥1 Hand trap: 71.4%".
- **Hand simulator**: deal 5 or 6, redraw, draw next; seeded shuffle, seed in the URL so a hand can be
  shared and reproduced.

## Versions

- Every server save writes a revision; local autosaves do not.
- History sheet: revisions with time and a diff summary ("+2 Ash Blossom, −1 Called by the Grave").
- Compare any two revisions side by side by zone. Restore writes a new revision.
- Conflicts: `PATCH` sends `baseRevision`; on `409` the user picks "Load latest" or "Save mine anyway"
  (`force: true`).

## Public pages

- `/decks`: public decks, newest first, filters for archetype, format and legal-in, cursor paged.
- `/decks/[id]`: read-only deck, analysis, every export, "Open in editor" (copies into a new draft),
  page metadata and OG image. Unlisted decks open by link and never appear in `/decks`.
- "My decks" sheet in the editor lists the owner's decks (`GET /decks/mine`).

## Error handling

| Failure | Behaviour |
|---|---|
| Save fails (network/5xx) | Draft stays local; toast with Retry |
| Save `409` | Conflict dialog (see Versions) |
| Save `401` | Log-in prompt; draft kept and saved after login |
| Card search fails | Inline notice with Retry; deck stays editable |
| Damaged share link / paste | "This deck link is damaged"; editor opens empty or unchanged |
| Image load fails on canvas | Tile drawn as a frame-coloured placeholder with the card name; export still completes |
| `pdf-lib` load fails | Export dialog shows the error and offers the text list |

No failure discards local work.

## Testing

- **Front (Vitest)**: every codec with round trips on real `.ydk` / `ydke` / Omega fixtures; `detect.ts`;
  `rules.ts` against each banlist family (copy limits, Genesys points and banned types, region release);
  `odds.ts` against hand-computed values; `model.ts`; the reducer (undo/redo).
- **Server**: route tests modeled on `wiki.test.ts` — auth, visibility, structural validation, `409`
  conflict, revisions and restore, legality badges.
- **Checks**: `tsc --noEmit` and eslint in the front; browser pass on the 5173 dev server at desktop and
  375 px.

## Phases

Each phase gets its own implementation plan and ships on its own.

1. **Core**: server `decks` + `deck_revisions` and all routes; `utils/deck` model, rules, ydk / ydke /
   Omega / text codecs; editor on desktop and mobile; local drafts; save and load; My decks.
2. **Import/export hub**: import dialog with detect and merge; CSV; share image; KONAMI PDF; share link.
3. **Analysis**: breakdown, role tags, odds calculator, hand simulator.
4. **History and public**: history sheet and compare; `/decks`; `/decks/[id]`; OG image.

## Open items

- The official KONAMI TCG decklist PDF must be added under `public/forms/`; its form field names are read
  from the file at the start of phase 2.

## Out of scope

Prices, rarities and collection tracking; Rush/Speed Duel; deck comments, likes and follows; editing
decks inside the game client (DNX).
