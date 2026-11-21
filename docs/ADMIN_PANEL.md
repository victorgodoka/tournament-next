# Admin panel (front)

The panel under `/admin`: what each screen shows, where its data comes from, what it writes, and
what the redesign of 14 Nov 2026 changes. This is the front's own reference. The API contract is
in the server repo (`omega-server-v3/docs/front/PANEL_API.md`, `RANKED_API.md`, `AUDIT_API.md`,
`CARDS_API.md`) and the classification rule in `omega-server-v3/docs/DECK_CLASSIFICATION.md`; this
file points at them and never restates a shape it can link to.

- **Design:** the canvas "Omega Hub Panel" (https://claude.ai/artifact/PMTPvYyooZBrFDHrA1KH4o),
  20 artboards, built with the Omega Hub design system. Artboard names are quoted in each section.
- **Status of this file:** it describes the **target**. Each screen says what already exists in
  `app/admin` and what is new. Everything the design needs that the API does not serve yet is
  collected in [Needs from the API](#needs-from-the-api); nothing there is a contract until the
  server documents it.
- **Built on 14 Nov 2026:** every screen of this file. The layout helpers of the canvas live in
  `app/admin/admin.css`, scoped under `.adm`; shared pieces are in `app/admin/shared.tsx`; the path "Back to
  site" returns to is in `utils/panel-return.ts`; the admin bar is `@ui/admin-bar`. Tournaments, Formats and
  API keys keep their content inside the new shell. **None of it has been compared with the canvas in a
  browser yet.**
- **Differs from the canvas:**
  - *Not served by the API, so not shown:* the `New` chip; "lists with / without the Series" on a child
    setcode; the most included members in the Series rail (it shows the cards by source); frames in the
    filter rail (it splits the loaded results by card type); ranked games and decklists of a season; a
    single list of every season with game counts (the table joins `/statistics/seasons` with the open and
    past standings).
  - *The rollover still stamps the server's `now()`:* the close dialog records and shows the moment the
    button was pressed, and says the server stamps the exact instant.
  - *The admin bar* is on the deck pages of `/statistics` only; tournaments and wiki articles do not have it.
  - The low value cut-off follows `PANEL_API.md` §9.1.1.
  - *Automatic naming (21 Nov 2026)* removed every deck decision from the panel: variations, ignore modes,
    the review count (nav and account menu) and the third-name panel. §4–§6 describe the read-only screens.
- Figures in the canvas are sample data. Card and cover tiles are placeholders coloured by card
  frame; the real screens use card art.

## Contents

1. [Rules that hold on every screen](#1-rules-that-hold-on-every-screen)
2. [Shell and navigation](#2-shell-and-navigation)
3. [Route map](#3-route-map)
4. [Overview](#4-overview)
5. [Identified decks](#5-identified-decks)
6. [Identified deck (detail)](#6-identified-deck-detail)
7. [Series](#7-series)
8. [Filters](#8-filters)
9. [Staples](#9-staples)
10. [Tournaments](#10-tournaments)
11. [Formats](#11-formats)
12. [Statistics job](#12-statistics-job)
13. [Seasons](#13-seasons)
14. [Access and API keys](#14-access-and-api-keys)
15. [Settings](#15-settings)
16. [Activity log](#16-activity-log)
17. [Shared pieces](#17-shared-pieces)
18. [Needs from the API](#needs-from-the-api)
19. [Open questions](#19-open-questions)

---

## 1. Rules that hold on every screen

| Rule | Detail |
|---|---|
| The gate is in the client | `AdminShell` shows `Locked` until `useAuth()` answers, then requires `can(user, 'system.manage')`. The session cookie is scoped to the API host and never reaches the Next server, so no server component can gate. The API refuses anyone else anyway. Access (analysts, editors) also needs `user.manage`. |
| One transport | Every call goes through `request` in `utils/panel.ts`: `credentials: 'include'`, `cache: 'no-store'`, errors thrown as `PanelApiError(status, error, message, details)`. Show a failure with `panelErrorText(error)`. New endpoints get a typed function in `utils/panel.ts` and a test in `utils/panel.test.ts`; pages never call `fetch`. |
| Reads | `useResource(key, (signal) => …)` from `@hooks`. Pass `null` as the key to skip a read (the shell does it until the user is an admin). Abort through the signal. |
| Never log from the client | The server records every admin mutation, denied and failed ones included. The top bar says "Every change is logged" and links to the activity log on every screen except the log itself. |
| Unknown fields are a `400` | Send only the keys the route documents. A form that round-trips an object must strip read-only keys the route does not accept (Series: `code`; see `toSeriesInput`). |
| A deck change shows in two steps | Names in profiles, match history and tournament decklists change on their next read. `/statistics` changes after the next build (the nightly job, or Reclassify on the job page). Every screen that changes classification ends with this note (`NextBuildNote` in `app/admin/cards/shared.tsx`). |
| Season-scoped reads | The deck and staple reads need `?season=ID` (`400` without it). Use `useSeason` and `SeasonSelect` from `app/admin/cards/shared.tsx`. |
| Numbers | Rates one decimal (`58.3%`, helper `percent`), counts with a comma (`4,812`), a missing value is `—`. Times 24-hour, dates short (`Sat 14 Nov`). Passcodes and setcodes in mono. |
| Copy | English, sentence case titles, title case buttons with the verb first, no "we". Card and archetype names exactly as printed. The interface has no emoji. Labels grow in other languages: never size a control to its English label. |
| Components | Controls come from `components/ui` (`@ui/button`, `@ui/chip`, `@ui/field`, `@ui/choice`, `@ui/lookup`, `@ui/data-table`, `@ui/panel`, `@ui/rail-head`, `@ui/stat-grid`, `@ui/dialog`, `@ui/alert`, `@ui/avatar`, `@ui/breadcrumbs`, `@ui/side-nav`). A page keeps only its own layout. Colors are theme tokens; an off-system color fails to compile. |
| Destructive actions | `danger-outline` button when the action is not the point of the screen, `danger` only for the confirming button of a dialog. Anything that cannot be undone goes through a dialog that says so. |
| Metadata | `app/admin/layout.tsx` sets `noIndexMetadata`. Keep every admin route out of the index. |

---

## 2. Shell and navigation

Artboards: "Shell · side navigation", "On the site · the way into the panel". File:
`app/admin/AdminShell.tsx` (exists; the `NAV` constant and the top bar change).

### 2.1 Side navigation

The groups changed. `Deck classification › Decks`, `Ignored setcodes` and `Setcode covers` are
gone as screens (their routes stay on the server); their jobs moved into Identified decks.

| Group | Item | Route | Count shown |
|---|---|---|---|
| (none) | Overview | `/admin` | — |
| Decks | Identified decks | `/admin/decks` | — |
| Decks | Series | `/admin/series` | — |
| Decks | Filters | `/admin/filters` | — |
| Decks | Staples | `/admin/staples` | — |
| Tournaments | Schedule | `/admin/tournaments` | upcoming tournaments (already there: `listTournaments({ upcoming: true, limit: 200 }).length`) |
| Tournaments | Formats | `/admin/formats` | — |
| Ranked | Statistics job | `/admin/statistics/sweep` | — |
| Ranked | Seasons | `/admin/seasons` | — |
| People | Access | `/admin/access` | — |
| People | API keys | `/admin/api-keys` | — |
| System | Settings | `/admin/settings` | — |
| System | Activity log | `/admin/activity` | — |

- The current item is the longest matching path prefix (`locate` already does this). Settings,
  Analysts and Wiki editors used to share `/admin/staff` through hash links; they are now two
  real routes, so `pathOf` and the "first of equals" rule can go.
- Brand row: the "Omega Hub" wordmark and the gold `Panel` chip, as today.
- Footer: avatar, name, "Admin · system.manage", as today.
- A count of `0` renders nothing.

### 2.2 Back to site

A block under the brand row, above the first group: a left arrow, "Back to site" and, under it in
mono, the path it returns to.

- When the panel is entered from the site, store the path the admin was on. Use its own
  sessionStorage key (for example `panel-return-to`) with the same safety check as
  `utils/return-to.ts` (same-origin rooted path, no control characters). Do not reuse the
  `return-to` key: that one is taken once after sign-in and cleared.
- The path is kept while the admin moves inside the panel (read, not taken).
- With nothing stored (the panel was opened by URL), the block reads "Back to site" with `/` and
  goes home.
- Never store a path under `/admin`.

### 2.3 Top bar

Left: breadcrumbs `Panel / <group> / <item> [/ <sub>]`. `Panel` links to `/admin`; the group is
plain text; the item links to its list when a sub-screen is open. Sub labels: a Series or deck
name, `New`, `#<id>`.

Right, in order: "Every change is logged", the `Activity log` link (both hidden on the log
itself), and a secondary mono button that opens the **public twin** of the screen in the same tab:

| Panel screen | Button | Target |
|---|---|---|
| Overview | Open site | the stored return path, else `/` |
| Identified decks, Statistics job | View /statistics | `/statistics` |
| Identified deck | View /statistics/<deck> | that deck's public page |
| Staples | View /statistics/staples | the public staples view, if there is one; otherwise `/statistics` |
| Tournaments, tournament form | View /tournaments | `/tournaments` |
| Seasons | View /leaderboard | `/leaderboard` |
| Series, Filters, Formats, Access, API keys, Settings | — | no public twin, no button |

### 2.4 The way in, on the site

- **Account menu.** `components/ui/header` already has "Admin panel" (gold) for admins. Rename it
  `Panel`. It links
  to `/admin` and stores the current path first (§2.2).
- **Admin bar.** On public pages that have a panel screen, admins see a one-line gold bar under
  the navbar: the `Admin` chip, "This page reads **Identified decks › Dark Magician**. Only admins
  see this bar.", and two links: the deep link (`Edit this deck`) and `Open panel`. Nobody else
  gets the markup.

| Public page | Deep link |
|---|---|
| A deck in `/statistics` | `/admin/decks/<code>` |
| A tournament | `/admin/tournaments/<id>` when it has a schedule |
| A wiki article | the wiki editor (already exists outside the panel) |
| A profile | none yet |

### 2.5 Widths

The shell is a row from `lg` and a column below it (as today). Below `lg` the nav stacks above the
content. Toolbars wrap; every table sits in a horizontally scrolling box; the side rails of the
editors (Series, Filters, tournament form) drop under the main column.

---

## 3. Route map

| Route | File | Artboard | State |
|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | Overview | **New content** (today it redirects) |
| `/admin/decks` | `app/admin/decks/page.tsx` | Identified decks | **New** |
| `/admin/decks/[code]` | `app/admin/decks/[code]/page.tsx` | Identified deck · Dark Magician | **New** |
| `/admin/series` | `app/admin/series/page.tsx` | Series | Moved from `/admin/cards/series`, list restyled |
| `/admin/series/new`, `/admin/series/[id]` | `app/admin/series/…` | Series · edit | Moved; the form (`SeriesForm`, `SeriesCards`) gains Only as child, filters and the resolved-cards rail |
| `/admin/filters` | `app/admin/filters/page.tsx` | Filters | **New** |
| `/admin/filters/new`, `/admin/filters/[id]` | `app/admin/filters/…` | Filter · build | **New** |
| `/admin/staples` | `app/admin/staples/page.tsx` | Staples | Moved from `/admin/cards/staples`, gains thumbs and source chips |
| `/admin/tournaments` | exists | Tournaments | Same content |
| `/admin/tournaments/new`, `/admin/tournaments/[id]` | exists (`TournamentForm`) | Tournament · new | Same content |
| `/admin/formats` | exists | Formats, Formats · new format open | Same content |
| `/admin/statistics/sweep` | exists | Statistics job | Sections reordered, last run at the bottom |
| `/admin/seasons` | `app/admin/seasons/page.tsx` | Seasons, Seasons · close and open next | Replaces `/admin/tools`; rename and close split |
| `/admin/access` | `app/admin/access/page.tsx` | Access | Analysts and Wiki editors, split out of `/admin/staff` |
| `/admin/api-keys` | exists | (not drawn) | Unchanged |
| `/admin/settings` | `app/admin/settings/page.tsx` | Settings | `Settings.tsx` split out of `/admin/staff` |
| `/admin/activity` | exists | Activity log | Gains grouping |

**Removed screens:** `/admin/cards/decks` (and `Setcodes.tsx`), `/admin/cards/ignored`,
`/admin/cards/covers`. **Redirects** to keep old links and audit targets working:

| Old | New |
|---|---|
| `/admin/cards/decks`, `/admin/cards/ignored`, `/admin/cards/covers` | `/admin/decks` |
| `/admin/cards/series[/…]` | `/admin/series[/…]` |
| `/admin/cards/staples` | `/admin/staples` |
| `/admin/tools` | `/admin/seasons` |
| `/admin/staff`, `/admin/staff#settings` | `/admin/settings` |
| `/admin/staff#analysts`, `/admin/staff#editors` | `/admin/access` (a hash never reaches the server: redirect `/admin/staff` to settings and keep a client check for the two hashes) |

---

## 4. Overview

Artboard "Overview". Route `/admin`. New.

| Block | Shows | Source |
|---|---|---|
| Eyebrow | "Panel · Read HH:MM" (when the reads answered) | client clock |
| Stat row | Upcoming tournaments · Waiting for a link · Last statistics job | see below |
| 01 Recent activity | Last 5 log entries: when, who, action, target, outcome | `listAudit({ limit: 5 })` |
| On the site | Four links (Statistics, Tournaments, Leaderboard, Wiki) | static |
| Statistics job | Last run chip and one-line summary, `Reclassify open seasons`, `Open the job` | `getAnalyticsSync()`, `buildOpenSeasons()` |
| Open seasons | One line per ladder: ladder chip, label, duelists | `listSeasons()` |

- Upcoming and Waiting for a link come from `listTournaments`: upcoming is the `upcoming: true`
  list; waiting is a schedule whose `startsAt` is past and whose `omegaTournamentId` is `null`;
  broken is `omegaTournamentId` set with `omega: null`. These three are already computed in
  `app/admin/tournaments/page.tsx`; lift them into a shared helper.
- Last statistics job: `running` not null → chip "Running" (cyan) and the current day; `last.error`
  → "Failed" (negative) with the message; otherwise "Finished" (positive) with `finishedAt` and
  the duration.
- Every block reads on its own and fails on its own: one failed read shows an inline alert in its
  block and leaves the others alone.

---

## 5. Identified decks

Artboard "Identified decks". Route `/admin/decks`. New. Replaces Decks, Ignored setcodes and
Setcode covers.

One row per archetype or Series the build found in ranked lists (a **lead** code), not per deck
key.

### 5.1 Header and stats

- Eyebrow: "Decks · N identified · Built <date of the last build>".
- Season select, top right. A build covers the open season of each ladder, so the select offers
  pairs or single seasons, whatever the API serves; the two ladders are columns of the same table.
- Stat row: Identified · Versions · Low value · Series. Deck names are set by the build (automatic naming,
  server `docs/DECK_CLASSIFICATION.md`): nothing on these screens is decided by hand except covers.

### 5.1.1 Signals, above the table

Three blocks help shape what the build names, before the table of leads ("04 Every lead"):

| Block | Shows | Action |
|---|---|---|
| 01 Looks like a generic package | `DeckList.noise`: archetypes that join versions of 5+ different leads as 2nd or 3rd name (cover, name, leads, lists) | `Make its cards staples` (`setArchetypeStaples`), with Undo in the toast (`resetArchetypeStaples`). A Series says "adjust it in its editor" instead |
| 02 Name changes | `getVersionChanges(7)`: "New versions" and "No longer a version" this week, each a link to its lead | — |
| 03 Closest to naming decks | `getSeasonUnder(season)`, TCG / Genesys toggle: the top 15 sets under the minimum, any lead, with lists "of <minLists>", share "of <versionShare>" and where their lists go | — (tune `versionShare` in Settings) |

### 5.2 Toolbar

| Control | Behaviour |
|---|---|
| Find a deck | Filters the loaded rows by archetype name, Series name or setcode (hex or decimal) |
| Low value | `Show` / `Hide` (default) / `Only` |
| Cut-off | Percent of lists; default from settings (`lowValueShare`, needs API). A deck is low value when its share is under the cut-off in **both** ladders |
| Sort | `Lists` (default, descending) · `Win rate` · `Versions` · `A–Z` |
| Filter chips | `All` · `Has versions` · `No cover` · `Series`, each with its count; one at a time |
| Count line | "181 shown · 231 low value hidden" |

Low value, cut-off and sort are remembered per admin (localStorage).

### 5.3 Columns

| Column | Content |
|---|---|
| Deck | Cover (square art crop; a dashed "?" tile when there is none), name, kind (`Setcode` · `Series over setcode` · `Series, new archetype`) and code in mono |
| State | Chip `No cover` (neutral) when no cover is pinned, and `Pick`: opens a row under it with the cover candidates (`CoverPicker`, from the TCG season, else Genesys) and `Or any card`; a pick saves at once with Undo |
| TCG lists · TCG share · TCG win rate | Lists led by it, share of all TCG lists (bar plus percent), win rate |
| Genesys lists · Genesys share | Same for Genesys |
| As secondary | Lists led by another deck where it is the second or third name |
| Decks | Its versions plus the pure deck when the pure deck has lists (`deckCount`) |
| Action | `Open` → `/admin/decks/<code>` |

A row is a link as a whole; `Open` is the accessible name.

### 5.4 States

- Loading: the table skeleton. Empty season: "No lists in this season yet."
- No row after filters: "No deck matches." with `Clear filters`.
- `Load more` pages the list (the list can pass 400 rows).

---

## 6. Identified deck (detail)

Artboard "Identified deck · Dark Magician". Route `/admin/decks/[code]`. New. `code` is the lead
setcode (or Series code, `65536 + id`).

### 6.1 Header panel

| Part | Behaviour |
|---|---|
| Cover as lead | Large art tile, the cover card's name under it |
| Eyebrow, title, line | Kind, code; "Leads N versions besides the pure deck" or "Named alone" |
| Pick the cover | The most included cards of its lists as tiles (card, name, "98.4% of lists"); a click sets the cover. `Or any card` is a `Lookup` (`findCards`). The pinned one carries a cyan ring |
| How it is named | Read only: a version of up to three names is a deck from `versionShare` of a season's lists; to shape names, make a card a staple or group cards in a Series |
| Edit Series | Shown when the lead is a Series → `/admin/series/<id>` |

Cover writes: a plain setcode uses `setCover(code, card)` / `clearCover(code)`
(`/panel/archetype-covers`); a Series uses `updateSeries(id, { …, cover })`. A Series that becomes
a setcode keeps its own cover when it has one. Show `Reset to automatic` when a cover is pinned.

### 6.2 Ladder tabs and stats

Tabs `TCG · <season label>` and `Genesys · <season label>`, each underlined in its ladder color
(`ladder-tcg`, `ladder-genesys`). The tab is in the URL (`?ladder=genesys`). Everything below
belongs to the picked ladder.

Stat row: Lists as lead (and share of the ladder) · Duelists (and lists each) · Win rate (first
and second) · Pure lists (no second archetype) · Named cards (mean, min–max) · As secondary.

### 6.3 Section 01 · Decks

**Named by the build.** The pure deck and every version this code leads in the picked season
(`DeckDetail.decks`), with the same numbers as /statistics. No actions, no states.

| Column | Content |
|---|---|
| Deck | The cover of each name (`covers`; the lead shows its cover here), the composed name with `Near the minimum` (amber) when `near`, and "The pure deck" or "Seen since <day> · <seasonShare> of the season (needs <versionShare>)" |
| Lists · Of its lists | Count, and share of the lead's lists as a bar |
| Duelists · Win rate · vs pure | `—` for duelists on the pure row; `vs pure` in points, green or red |
| Cards of the others | Mean cards of each other name in those lists |
| Action | `Open <name>` for each other name |

Low value `Show` / `Hide` / `Only` with its own cut-off (percent of this deck's lists, default 2) dims
versions only.

**Under the minimum** (a second table, lists shown "of <minLists>"): `DeckDetail.under`, the sets it leads that are not versions:
the set, its lists, its share of the season against `versionShare`, and "Counted as" the deck its lists
go to.

### 6.4 Section 02 · Where it is a secondary

One row per version of **another** lead that includes this deck (`secondaryIn`): the name, lists, this
deck's mean cards there, win rate, and `Open <lead>`.

### 6.5 Section 03 · Played alongside

Over the lists led by this deck in the picked ladder, **staples left out**.

Toolbar: Show `Everything` / `Archetypes` / `Cards`; Zone `All zones` / `Main` / `Extra` / `Side`;
Low value `Show` / `Hide` / `Only` with a cut-off (percent of lists, default 2).

One table, three groups in this order: **Main deck**, **Extra deck**, **Side deck**. Each group
has a header line with a note (main: counts; extra: "Counts for a name only when the main deck
carries it too"; side: "Never names a deck · shown for staple and tech decisions") and two blocks:
"Archetypes and Series", then "Cards with no archetype".

| Column | Archetype row | Card row |
|---|---|---|
| Name | Cover, name, sub line ("In a version with it" or "Not in a version with it") | Card thumb, name, passcode |
| In lists | Bar and percent of the lead's lists | same |
| Lists · Duelists | counts | counts |
| Copies | Mean cards over the lists that play it | Mean copies |
| Min–max | Range of that count | Range of copies |
| Distinct cards | Mean distinct cards | `—` |
| Win rate with · vs without | Win rate of the lead's lists holding the row, and the difference to those that don't | same |
| Mostly with | The co-occurring archetypes with the highest share, or `Pure N%` | same |
| Action | `See the deck` (scrolls to section 01) when they share a version | `Add to Series` (→ the Series editor with the card pre-added) and `Staple` (`setStaple(card, true)`) |

Footnote: "Copies is the mean over the lists that play it. Win rate with and without compare
lists that hold the row against those that don't, game 1 only. A row under the low value cut-off
is dimmed."

### 6.6 States

- `404`: the code is not a lead in that season → "Not a deck of this season" with a link back.
- A ladder with no list for the deck shows its tab with an empty state, not a hidden tab.
- Every write failure shows inline next to the control and leaves the previous value.

---

## 7. Series

Artboards "Series", "Series · edit". Routes `/admin/series`, `/admin/series/new`,
`/admin/series/[id]`. Exists as `app/admin/cards/series` (`page.tsx`, `SeriesForm.tsx`,
`SeriesCards.tsx`); moved and extended. API: `PANEL_API.md` §9.4 (`listSeries`, `getSeries`,
`listSeriesMembers`, `createSeries`, `updateSeries`, `deleteSeries`, `toSeriesInput`).

A Series names a deck. Its children only decide which cards count for it.

### 7.1 List

Header buttons: `Filters` (secondary) and `New Series` (primary). Toolbar: `Find a Series` (name,
setcode or a member card) and filter chips `All` · `Becomes a setcode` · `New archetype` · `Uses a
filter`.

| Column | Content |
|---|---|
| Series | Cover, name, code in mono |
| Kind | "becomes <setcode name>" or "new" |
| Members | The first four member card thumbs and the total |
| Setcodes · Cards · Mentions · Filters | Counts of each child kind |
| Only as child | How many children have the switch on |
| Updated | Short date |
| Action | `Edit`, `Delete` (danger; a confirm dialog that says the decks fall back to their other names) |

### 7.2 Editor

Head: eyebrow "Series · <code> · Updated <date>", the name as title, `Cancel` and `Save Series`.
Top bar button `Open as identified deck` → `/admin/decks/<code>`. Two columns: the form, and a
sticky rail on the right.

**Identity panel**

| Field | Rules |
|---|---|
| Name | Required, 1–80 characters, unique ignoring case (`409` → "A series named "X" already exists.") |
| Kind | Segmented `New archetype` / `Becomes a setcode`. New: `archetype: null`, the code is `65536 + id`. Becomes: pick the setcode with a `Lookup` (`findSetcodes`); its cards are members by definition |
| Becomes setcode | Shown for the second kind: cover, name, hex code, card count, `Change`. An ignored setcode is refused (`ignored setcode: unignore it first`) |
| Description | Optional, up to 2000 characters |

**01 · Child setcodes** (at most 32). A `Lookup` adds one. Each row: cover, name, hex code, four
thumbs, card count, lists with the Series, lists without it, the **Only as child** switch with a
state line, `Remove`. A setcode the Series becomes cannot be a child, and neither can one another
Series becomes or holds (the API's `400` messages name the Series; show them as is).

**Only as child** (new, needs API), explained in a gold note above the table:

- **On:** the setcode or card is left out of every other calculation and scores for this Series
  alone.
- **Off:** it can still name other decks, but in a deck that holds this Series it scores for the
  Series only.

**02 · Cards** (at most 200). A `Lookup` (`findCards`) adds one. Each card is a tile: art, name,
passcode, what it is on its own ("No archetype", "Also Springans", "Staple · counts with a Series
card in the main"), the **Only as child** switch, `Remove`. An alternate art is saved as its
original.

**03 · Mentions** (at most 200). A `Lookup` adds the quoted card. Each mention shows the card, its
name in quotes, the passcode, `Remove`, and "Quoted by N cards" with their thumbs. Every card
whose text quotes the name is a member; the quoted card itself is not. **No Only as child here.**

**04 · Filters** (new, needs API). Attached filters, each: name, "N match · N excluded · N count
for the Series", its rules as pills (excluded cards struck through), a strip of thumbs, `Open
filter`, `Detach`. Below: `Attach a filter` (a select of saved filters) and `Build a filter` →
`/admin/filters/new`. A filter widens the Series to every card it matches; it never names
anything.

**05 · Cover.** Tiles to pick from: the pinned one (cyan ring), the first mention, then the most
included cards, each with its note; plus `Or any card`. With nothing pinned the chain in
`DECK_CLASSIFICATION.md` ("Cover") applies; say so under the tiles.

**Rail · Cards in this Series.** The resolved total, a bar per source (the setcode, child
setcodes, cards, mentions, filters; a card can come from more than one, so the bars do not sum to
the total), then the most included members with their source and share, and `All N cards`.
Today's `SeriesCards.tsx` already resolves members from `listSeriesMembers` plus `GET
/cards?archetype={code}&archetypeMatch=setcode`; filters add a fifth source.

**Save.** The record is written whole. `PATCH` merges, so send every key the form owns; `[]`
clears a list. The form must strip `code` and send numbers, not objects (`toSeriesInput`). Limits
are checked client-side before the request (32 setcodes, 200 cards, 200 mentions). After a save,
stay on the editor and show the two-step note.

---

## 8. Filters

Artboards "Filters", "Filter · build". Routes `/admin/filters`, `/admin/filters/new`,
`/admin/filters/[id]`. **New, needs API** for storage; the search itself is `GET /cards`
(`CARDS_API.md`).

A filter is a saved card search a Series can attach. Every card it matches counts for that
Series, minus the cards excluded by hand.

### 8.1 List

Cards in a grid, one per filter: name, updated date, the count (cards that count), the rules as
pills, a strip of thumbs with "+N", then "N match · N excluded · Used by <Series>" and `Edit`,
`Delete`. A filter used by a Series cannot be deleted: disable `Delete` and say which Series use
it. Header button `New filter`.

### 8.2 Builder

Head: `Cancel`, `Save filter`. Two columns: sections on the left, a sticky rail on the right.

**Identity:** Name (1–80, unique), Description.

**01 · Card rules.** A table of rules, one per row: the rule and its hint, its values, and what is
picked (`Any` in muted text when nothing is). A card must pass every rule that has something
picked; inside one rule, any picked value passes. `Clear every rule` in the section head.

| Group | Rule | Control | `GET /cards` parameter |
|---|---|---|---|
| Card | Card type | Segmented Monster / Spell / Trap | `kind` |
| Card | Deck | Segmented Any / Main deck / Extra deck | `extraDeck` |
| Monster | Attribute | Pills, multi | `attribute` (any of) |
| Monster | Monster type | Pills, multi; `All 26 types` opens the full list | `race` (any of) |
| Monster | Frame | Pills, multi | `types`: `normal` `effect` `ritual` `fusion` `synchro` `xyz` `pendulum` `link` |
| Monster | Ability | Pills, multi | `types`: `tuner` `flip` `gemini` `spirit` `union` `toon` |
| Numbers | Level, Rank or Link | From / To | `levelMin`, `levelMax` (0–13) |
| Numbers | ATK | From / To | `atkMin`, `atkMax` (`?` is `-2`) |
| Numbers | DEF | From / To | `defMin`, `defMax` (Link monsters never match) |
| Spell and Trap | Kind | Pills, multi | `spellTrapType` |

`types` matches **all** the values sent, while the builder's Frame and Ability pills read as "any
of the picked". Either the filter evaluation runs server-side with that meaning, or the builder
makes those pills single-pick; settle it with the API. The Monster and Numbers groups are
disabled while the card type is Spell or Trap, and the Spell and Trap group while it is Monster.

**02 · Name or text contains.** A text input with an `Add` button on its right (Enter adds too).
Each term becomes a pill with a remove button; a duplicate or an empty term is not added. Two
segmented controls under the pills: `Every term` / `Any term`, and where to look: `Name and
text` / `Name` / `Text` (`q` is full text over both, `fname` is the name alone). With no term the
text is not checked.

**03 · Mentions.** A card `Lookup`, the same block as the Series' Mentions: the picked card, its
name in quotes, passcode, `Remove`, and "Quoted by N cards" with thumbs. Only cards whose text
quotes the name pass (see [Open questions](#19-open-questions)).

**04 · Cards found.** Segmented `All N` / `Counting` / `Excluded`, a `Find in the results` input,
and a grid of card tiles: art, name, a line of stats (`Level 6 · 1800 / 2400`), and the state.
**Clicking a tile excludes the card or puts it back**; an excluded tile is greyed and reads
`Excluded · put back`. Results follow the rules with a short debounce; `Load more` pages them
(`GET /cards` pagination).

**05 · Excluded by hand.** A table of the excluded cards: thumb, name, stats, why it matched, `Put
back`. An excluded card stays out even when the rules still match it and through card database
updates.

**Rail · This filter.** Match · Excluded · Count; "Reads as" (every rule, term and mention as a
pill); a bar per frame; `Used by` with a link to each Series. A card added to the database later
joins when it matches.

Saving changes the members of every Series that uses the filter: show the two-step note, and name
those Series in the confirm when there are any.

---

## 9. Staples

Artboard "Staples". Route `/admin/staples`. Exists as `app/admin/cards/staples`; moved. API:
`PANEL_API.md` §9.3 (`listStaples(season)`, `setStaple`, `resetStaple`).

- Toolbar: `SeasonSelect`, a card `Lookup` "Make a card a staple" (`setStaple(card, true)`), and
  filter chips `All` · `Found by the build` · `Set by hand` · `Disabled`.
- Columns: Card (thumb, name, passcode) · Decided by (`Build` neutral, `Manual` cyan) · Staple
  (Yes / No) · In decks (bar and `share`) · Main (`mainShare`) · Side (`sideShare`) · Foreign
  (`foreignShare`) · Action.
- Actions: an auto row → `Disable` (`setStaple(card, false)`). A manual row → `Disable` or
  `Enable`, and `Back to build` (`resetStaple`). A disabled row is dimmed.
- The four shares can be `null` (no figure for the card in that season): show `—`.
- Order as the API sends it: enabled first, then share descending.
- Footnote: what In decks and Foreign mean, and that the cut-offs are in Settings.

---

## 10. Tournaments

Artboards "Tournaments", "Tournament · new". Exists (`app/admin/tournaments`: `page.tsx`,
`TournamentForm.tsx`, `LinkDialog.tsx`, `params.ts`). Content unchanged; only the shell and
breadcrumbs (`Panel / Tournaments / Schedule / New`) change. API: `PANEL_API.md` §3, §5, §6.

### 10.1 Schedule

- Header: `Formats` (secondary), `New tournament` (primary).
- Stat row: Upcoming · Next start · Waiting for a link (gold) · Broken links (crimson).
- 01 Upcoming: segmented `Upcoming` / `All`, `Limit` select (1–200, default 50). Columns: ID,
  Starts (BRT), Format, Banlist, Mode, Timer, Start LP, Card pool, Budget, Rules, System, Actions
  (copy command, edit, delete). Empty: "Nothing scheduled." with `Schedule the first one`.
- 02 Link what ran: schedules whose start has passed. Columns: ID, Scheduled (BRT), Format, Omega
  tournament, Status, Players, Actions (`Link` opens `LinkDialog`, `Unlink`). Linking is manual on
  purpose; show `linkedTo` in the picker so a taken tournament is not picked (`409
  ALREADY_LINKED`). A linked id whose `omega` is `null` is a broken link: keep showing the id.

### 10.2 Form (new and edit)

Five numbered panels and a sticky steel rail.

| Panel | Fields |
|---|---|
| 01 Format and start | Format (select; "No format" first; fills banlist and card window, anything changed below wins). Starts at: date and time in the admin's time (BRT), sent as ISO 8601 UTC |
| 02 Card pool | Banlist (from `options.banlists`, with its tournament count), Released from, Released until (`YYYY-MM-DD`, booster release dates; empty = no bound; from after until is a `400`) |
| 03 Duel | Mode (Single / Match / Tag), Master rule (MR1–MR5; the label is built client-side), Region (the raw number; never translate it), Duel rule (0–7, no names), Timer (0–255 s), Draw count (0–31), Start hand (0–31), Start LP (0–102 000) |
| 04 Extra rules | The presets of `options.extraRulesPresets` as option cards (banlists, tournament count, bits), newest first, and `Value sent`: a string, decimal or `0x…`. Never a number |
| 05 Event | System (Swiss / Single elimination), Budget in R$ (sent as `budgetCents`, an integer), Requires battlepass, Reward TP |

- Limits come from `options.ranges`, so the form and the API cannot drift.
- **Command order** (the rail): the 16 arguments in the contract's order with their current
  values, and the command box. The server builds the command on save; the front renders and copies
  it and **never rebuilds or reorders it**. Under the rail: `Schedule tournament` (or `Save`) and
  `Cancel`.
- On edit, sending a different `formatId` re-pulls banlist and window from the new format.

---

## 11. Formats

Artboards "Formats", "Formats · new format open". Exists (`app/admin/formats/page.tsx`). Content
unchanged. API: `PANEL_API.md` §4.

- Header: `Schedule` (secondary), `New format` (primary; disabled while the panel is open).
- Table: Name, Banlist, Card window, Description, Scheduled. Empty: "No formats yet."
- "Banlists outside the card database": `options.banlistsNotInCardDb` as a grid of cells (list
  name, tournament count).
- **New / edit panel**, on the right of the table (under it below `lg`), with a cyan edge: eyebrow
  "New format" and the name as title ("Untitled" while empty), `Close`; Name (unique ignoring
  case, `409 ALREADY_EXISTS`); Banlist (validated against the card database); Released from /
  until; Description; `Save format`, `Cancel`; and the note "Editing a format doesn't change
  tournaments already scheduled from it."
- Delete: show the format's `tournaments` count before offering it; those tournaments stay and
  lose their provenance.

---

## 12. Statistics job

Artboard "Statistics job". Route `/admin/statistics/sweep`. Exists; sections reordered. API:
`PANEL_API.md` §8 (`getAnalyticsSync`, `startAnalyticsSync`, `rebuildOpenSeasons`,
`buildOpenSeasons`, `clearStatisticsCache`).

Order on the page:

| # | Section | Content |
|---|---|---|
| 01 | A range of days | From, To (days in the job's time zone; both empty = yesterday, only From = that day, at most 366 days, To not after today). Format segmented `Both` / `TCG` / `Genesys`. `Dispatch job`. A note on backfilling a season |
| 02 | Reclassify only | Sweeps nothing; reclassifies the open seasons with the current identified decks, Series, filters, staples and settings. `Reclassify open seasons`. This is the button to press after a round of deck decisions |
| 03 | Rebuild the open seasons | `Rebuild open seasons`. `409 NOTHING_TO_REBUILD` when no open season has a day to sweep |
| 04 | Statistics cache | `Clear statistics cache` |
| 05 | **Last run** | At the **bottom** of the page |

**Last run.** A run can have many days, so the table lives last and scrolls inside itself:

- Chip (`Running` cyan, `Finished` positive, `Failed` negative) and the time, then a summary line:
  range, formats, "N days in <duration>".
- Table: Day · Ranked matches · Rows written · Took, from `done[]`.
- **At most 10 rows are visible; past that the box scrolls** (a fixed max height on the table's
  box, `overflow-y: auto`) with a sticky header. The rail head says "14 days · 10 shown, scroll
  for the rest".
- Under it: the totals of the run.
- While `running` is not null, poll `getAnalyticsSync` every few seconds; `current` and `done` do
  not advance mid-run, and after a dispatch `running` stays null for the minute or two the runner
  takes to start, so show "Dispatched, waiting for the runner" in between. `last.error` shows the
  message and the day it stopped at.
- `status: "unavailable"` from a dispatch means nothing started (no dispatch token on the API):
  say so; do not show it as success.

---

## 13. Seasons

Artboards "Seasons", "Seasons · close and open next". Route `/admin/seasons`. Replaces
`/admin/tools` ("Ranked ops"). API: `RANKED_API.md` §3 (`listSeasons`, `rolloverSeason`,
`renameSeason`, `syncRanked`, leaderboard refresh).

**Renaming and closing are separate.** Nothing on the open-season card renames, and the rename
never sits next to the close button.

### 13.1 Open seasons

One card per ladder (always both, always TCG then Genesys): ladder chip, label, code in mono;
Opened (and days open), Ranked games, Duelists; and one button, `Close this season`
(`danger-outline`), which opens the dialog of §13.4. `season: null` renders "No open season".

### 13.2 All seasons

A table of every season, open and closed, newest first: Ladder · Label · Code · State (`Open`
positive, `Closed` neutral) · Opened · Closed · Ranked games · Duelists · Action.

- `Rename` turns the row's label into an input (`Save label`, `Cancel`; Enter saves, Escape
  cancels). **Only the label is editable; the code is read only everywhere on this screen**, on
  open and closed seasons alike. Label: 1–60 characters, trimmed.
- The write is `renameSeason(code, { label })`. The route also accepts `code`; the panel does not
  send it.
- Closed seasons come from `GET /ranked/seasons/past?ladder=` (public); see what that list lacks
  in [Needs from the API](#needs-from-the-api).

### 13.3 Ranked data

Two rows: "Update ranked data · Does now what the nightly job does." (`Run update`,
`syncRanked()`; a `busy` answer says another run holds the lock) and "Refresh the leaderboard ·
Rebuilds the cached board now instead of at the next 30-minute read." (`Refresh now`).

### 13.4 Close and open next (dialog)

Opened by `Close this season`. **Record the moment the button is pressed**: that instant is the
new season's start.

Two columns:

| Season closing (read only) | New season |
|---|---|
| Ladder chip | Ladder chip |
| Code, Label | **Starts:** the moment `Close this season` was pressed, with the note "not the moment you confirm. Games from then on count for the new season." Read only |
| Opened, Closes (the same pressed moment) | **Code** and **Label**, both pre-filled and both editable here |
| Days open, Ranked games, Duelists, Decklists | "Both are filled in for you and can be changed here. After this the code is fixed." |
| "The label can still be renamed later; the code never changes." | What happens: the snapshot is kept, ratings start the new season, `/statistics` shows it after its first build |

- Defaults: code `<ladder>-<ordinal + 1>` (the API's own default); label as the API defaults it
  (`Season <ordinal + 1>`) unless a naming rule is decided (open question).
- Code rules: lowercase letters, digits, single hyphens, at most 40 characters, unique.
- A gold line: "This can't be undone. A closed season doesn't reopen."
- Buttons: `Cancel` (ghost) and `Confirm closing and new season` (danger).
- The request: `rolloverSeason({ ladder, season: <ordinal shown>, code, label })`. Always send
  `season`: it turns a double click or a stale tab into `409 SEASON_MISMATCH`.

| Answer | Show |
|---|---|
| `200` | Close the dialog, reload both lists, toast with `closed.standings` duelists frozen |
| `409 CODE_TAKEN` | Under the Code field; the old season is still open |
| `409 SEASON_MISMATCH` | "Another season is open now." and reload |
| `409 SEASON_EMPTY` | "Nobody has played this season yet, so there is nothing to close." |
| `409 SEASON_CLOSED` | "Someone else just closed it." and reload |

The start moment the dialog shows is not something today's rollover accepts (it closes at the
server's `now()`): see [Needs from the API](#needs-from-the-api). Until then the dialog still
shows the pressed moment and says the server stamps the exact instant.

---

## 14. Access and API keys

Artboard "Access". Route `/admin/access`, split out of `/admin/staff`. Needs `user.manage`.

Two panels side by side, same shape:

| Panel | Reads | Adds | Removes |
|---|---|---|---|
| 01 Analysts | `listAnalysts()` | `promoteAnalyst(userId)`, button `Make analyst` | `demoteAnalyst(userId)` |
| 02 Wiki editors | `listEditors()` | `promoteEditor(userId)`, button `Make editor` | `demoteEditor(userId)` |

- The input takes a Duelist ID. `404` → "They must have signed in once." `403` → the target is an
  admin.
- Each row: avatar (with `cosmetics`), name, id in mono, role chip. Admins are listed with the
  gold `Admin` chip and "Always" instead of `Remove`.
- The analyst role is exclusive: an editor made analyst stops being an editor. Removing an analyst
  sets them back to a duelist; removing an editor keeps their articles.
- Roles apply on the next request; no sign-in needed.
- A last panel links to API keys.

**API keys** (`/admin/api-keys`, exists, not redrawn): `listApiAccounts()` and
`updateApiAccount(discordId, { rateLimit, blocked })`; rate limit 1–10000 requests a minute. It
keeps its current screen inside the new shell.

---

## 15. Settings

Artboard "Settings". Route `/admin/settings`; `Settings.tsx` moves out of `app/admin/staff`. API:
`PANEL_API.md` §10 (`getSettings`, `updateSettings`; defaults in `utils/panel.ts`).

Head: "No changes" / "N changes" and `Save settings`, disabled while nothing changed. One `PATCH`
with only the changed keys. A `400` names the key: put the message under that field.

| Panel | Field | Setting | Shown as |
|---|---|---|---|
| 01 Tiers | Tier 1 · second deck, Tier 2, Tier 3 | `analytics.tiers.t1Gap`, `t2Gap`, `t3Gap` | Points (the rate × 100), smallest first |
| 01 Tiers | Minimum meta share, per format | `analytics.filters.<Format>.tierShare` | Percent |
| 01 Tiers | Minimum duelists, per format | `analytics.filters.<Format>.tierPlayers` | Integer |
| 02 Deck classification | Version: in lists | `analytics.classification.versionShare` | Percent of a season's lists |
| 02 Deck classification | Low value cut-off | `analytics.classification.lowValueShare` | Percent of lists |
| 02 Deck classification | Staple: in decks, Staple: foreign | `stapleShare`, `stapleForeign` | Percent |
| 03 Sample filters | Player games, List games, Deck games, per format | `minPlayerGames`, `minListGames`, `minKeyGames` | Integers, 0 turns it off |
| 03 Sample filters | Rating cap, per format | `eloCap` | Integer |
| 03 Sample filters | Aggregate floor, per format | `aggregateFloor` | Select of `BAND_NAMES` |
| 03 Sample filters | Dropped last build | read only | One line per format |

Each panel's rail head says when the value is read ("/statistics · next build", "Names now ·
/statistics next build"). `analytics.player` has no fields in the design; keep whatever the
current screen does with it.

---

## 16. Activity log

Artboard "Activity log". Route `/admin/activity`. Exists; gains grouping. API: `AUDIT_API.md`
(`listAudit`, `getAuditEntry`, `listAuditActions`).

- Filters: Who (Duelist ID → `actor`), Action (select from `listAuditActions()`), Target, From,
  To; Outcome segmented `All` / `Success` / `Rejected` / `Denied` / `Error`. Filters live in the
  URL.
- Columns: When (date and time) · Who (name and role) · Action (mono) · Target · Status (HTTP) ·
  Outcome chip (`success` positive, `rejected` amber, `denied` and `error` negative).
- **Group repeats of one action** (a switch, on by default): consecutive entries with the same
  actor, action and outcome within the same minute collapse into one row with an "N times" chip
  and a target summary ("8387, 115, 254 and 29 more"). The row opens to its single entries.
  Grouping is client-side over the loaded page.
- A row opens the entry with its `body` (`getAuditEntry`).
- `Load more` follows `nextCursor`; `null` is the last page even when the page is full.
- The top bar's "Every change is logged · Activity log" is hidden here.

---

## 17. Shared pieces

Already in `app/admin/cards/shared.tsx` (move it to `app/admin/shared.tsx` with the routes):
`findCards`, `findSetcodes` (lookup sources), `Thumb` (card art by id), `percent`, `useSeason`,
`SeasonSelect`, `NextBuildNote`.

To add, each used on more than one screen:

| Piece | Used by | Notes |
|---|---|---|
| `Cover` | Decks list and detail, Series, Overview | Square art crop of a card, sizes 32 / 44 / 72 / 176; a dashed "?" tile when there is none. Build image URLs from the card's `imageId`, not `id` |
| `CardTile` | Cover pickers, Series cards, filter results | Art, name, one or two lines, optional action; a `selected` ring and an `excluded` (grey) state |
| `ShareBar` | Every "In lists" / share column | A 6px bar and the percent, right aligned, tabular figures |
| `LowValueControl` | Decks list, Variations, Played alongside | Segmented Show / Hide / Only and the cut-off field; one component, three scopes |
| `OnlyAsChildSwitch` | Series setcodes and cards | The switch and its state line |
| `MentionBlock` | Series, Filters | The quoted card and "Quoted by N cards" |
| `RulePills` | Filters list, Series filters, filter rail | A filter's rules, terms, mentions and exclusions as pills |
| `TwoStepNote` | Every classification screen | `NextBuildNote`, restyled as the gold note |

Card art is decoration nowhere in the panel: thumbs and covers are shown in full color, never
with the duotone wash.

---

## Needs from the API

What the design asks for and the server does not serve today (checked against `PANEL_API.md`,
`RANKED_API.md` and `DECK_CLASSIFICATION.md` on 14 Nov 2026). The left column is what the screen
has to show or do; the right is what exists. **Nothing here is a contract.** Build each screen
against the real route once the server documents it, and keep the function in `utils/panel.ts`.

### Classification model

**Replaced on 21 Nov 2026 by automatic naming** (server `docs/superpowers/specs/2026-11-21-automatic-deck-naming-design.md`):
the routes below for variations and ignore modes, the cover of a secondary inside a variation and the settings
`maxNames`, `candidateCards`, `candidatePoints` no longer exist. Kept as history.

**Served since 14 Nov 2026** (server branch with the curated classification; shapes in `PANEL_API.md`
§9.2, §9.2.2, §9.2.3, §9.4, §10): approved variations and three-name variations (`/panel/variations`),
ignore with a mode on one exact code (`PUT /panel/archetypes/{code}/ignore`), the cover of a secondary
inside a variation (`PUT /panel/variations/cover`), Only as child on child setcodes and cards of a
Series, filters (`/panel/filters`, `filters` on a Series, `via` on its members), and the settings
`candidateCards`, `candidatePoints`, `lowValueShare`. Every existing variation starts as a candidate. The
table below is kept as the record of what the design asked for; the counts of a variation beyond `lists`
are still under "Statistics the deck screens read".

| The front needs | Today |
|---|---|
| **Approved variations.** A deck is named by its lead alone unless a pair or triple is approved for that lead. Per lead: list the variations with a state (`on`, `candidate`, `refused`), approve, refuse, turn off, restore | The classifier names every secondary that has 2 distinct cards and 5 points, with no approval step |
| **Three-name variations** approved explicitly under a pair | `maxNames` (default 3) caps the names; no per-triple decision |
| **Ignore with a mode, per archetype:** `lead`, `secondary`, `full`, applying to that archetype only (not its sub-families) | `ignored-archetypes` is one list: fully ignored, and a family ignores its sub-families |
| **Cover of a secondary inside one variation**, falling back to that archetype's cover as lead | One cover per setcode (`archetype-covers`) and one per Series |
| **Only as child**, per child setcode and per card of a Series (not mentions) | Children have no flag. An ignored setcode as a child counts for the Series only, which is close to "on" but is set on the setcode, not on the Series |
| **Filters:** a stored card search (rules, text terms with any/every and name/text scope, mentions, cards excluded by hand), CRUD, the cards it resolves to, the Series that use it; and a `filters` list on a Series | Nothing. `GET /cards` can run most of a search, but nothing stores one or ties it to a Series |
| **Low value cut-off** and the **candidate minimums** (distinct cards, points) as settings | `analytics.classification` has `maxNames`, `stapleShare`, `stapleForeign`; the 2 cards / 5 points minimum is fixed in the rule |

### Statistics the deck screens read

**Served since 14 Nov 2026** by `/panel/decks` (`PANEL_API.md` §9.1.1): one row per lead with both
ladders, the lead's summary, the variations with their counts and `vsPure`, where it is the secondary,
played alongside by zone with win rate with and without, the third-name co-occurrence, cover candidates,
the review count (`GET /panel/decks/review`) and the date of the last build. Two things differ from the
canvas: there is no `New` chip (the build keeps no history of when a deck first appeared), and "Mostly
with" is the three raw names most seen with the row, by lists. Low value in the list is "under the
cut-off in both ladders"; a candidate counts for review when its lists reach the cut-off of the lead's
lists over the two seasons shown. The table below is kept as the record of what the design asked for.

| The front needs | Today |
|---|---|
| **One row per lead** with, per ladder: lists, share, win rate, lists as secondary, counts of approved variations and candidates, cover, ignore mode, flags for new and needs review | `GET /panel/analytics/decks?season=` is one row per **key** of one season: `decks`, `games`, `share`, `players`; no win rate, no ladder pair |
| **A lead's summary** per ladder: lists, share, duelists, win rate overall and going first / second, pure-list share, named cards (mean, min, max), lists as secondary | Not served by the panel routes |
| **Per variation:** lists, share of the lead's lists, duelists, win rate, mean cards of the secondary, first seen, decided at | Not served |
| **Co-occurrence for a pair:** the archetypes its lists also play (share, lists, mean cards, win rate), for the third name | Not served |
| **Where a deck is the secondary:** the other leads' variations that include it, with lists, its mean cards, win rate and the cover it takes there | Not served |
| **Played alongside, by zone** (main, extra, side), staples left out: per archetype and per card with no archetype: lists, share, duelists, mean and min–max copies, distinct cards, win rate with and without, top co-occurrences | `GET /panel/analytics/decks/{key}` gives setcodes of a key over main and extra together: `decks`, `share`, `mean`, `min`, `max`. No cards, no side, no win rates |
| **Cover candidates:** the most included cards of a lead's lists with their share | Not served as a list |
| **Review count** for the nav, the account menu and the Overview | Not served |
| **Date of the last build** per season | Only through `getAnalyticsSync().last` |

### Seasons

| The front needs | Today |
|---|---|
| **Start of the new season = the moment `Close this season` was pressed**, sent with the rollover | `POST /ranked/seasons/rollover` takes `ladder`, `season`, `label`, `code` and stamps the server's `now()` |
| **Every season in one admin list**, open and closed, both ladders, with ranked games | Open: `GET /ranked/seasons` (`standings`, no game count). Closed: `GET /ranked/seasons/past?ladder=` per ladder (`code`, `label`, `ordinal`, `startsAt`, `endsAt`, `standings`) |
| **Ranked games and decklists of a season** for the cards and the close dialog | Not served; `standings` is the duelist count |

Nothing needed for renaming: `PATCH /ranked/seasons/{code}` with `{ label }` already works on open
and closed seasons.

### Site

| The front needs | Today |
|---|---|
| The public URL of a lead's page (`/statistics/<deck>`) from its code, for the top bar button and the admin bar | Built by the statistics pages from the deck key; expose the helper |

---

## 19. Open questions

1. **Mentions in a filter.** Settled: in a filter a mention narrows (only cards that quote the name
   pass); in a Series it adds members.
2. **"Any of" for Frame and Ability.** Settled: filters run server-side (`GET /panel/filters/preview`),
   and inside one rule any picked value passes. The builder does not use `GET /cards` for results.
3. **Default label of a new season.** The design shows a pre-filled label; the API's default is
   `Season <ordinal + 1>`, while real labels look like "10.2026 Zenna is Dead". No rule is
   written down.
4. **Dates and times in forms.** The canvas shows `dd/mm/yyyy` and 24-hour time; the current
   native inputs show `mm/dd/yyyy` and AM/PM in an en-US browser. Pick one for the panel.
5. **Season select on Identified decks.** Settled: one season per ladder
   (`GET /panel/decks?tcg=ID&genesys=ID`), each defaulting to the open one.
6. **Low value.** The list uses "under the cut-off in both ladders"; inside a deck the cut-off is
   a share of that deck's lists. Confirm both.
7. **`maxNames`.** Settled: the API allows 1–3.
8. **API keys.** Not redrawn; it keeps today's screen.
