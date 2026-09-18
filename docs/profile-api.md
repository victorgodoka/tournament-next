# Profile API contract

What `/profile/[id]` needs from the backend. Every field below is consumed by a component
today — nothing here is speculative, and nothing the page renders is missing.

Types live in `utils/types.ts`. The mock implementations that these endpoints replace are
`utils/profile.ts` (`getProfile`) and `utils/viewer.ts` (`getViewer`); both are already
`async` and wrapped in `React.cache()`, so swapping the body for a `fetch` is the whole
client-side change.

Base URL: `process.env.NEXT_PUBLIC_API_URL`. All responses `application/json; charset=utf-8`.

---

## 1. `GET /profiles/{id}` — the whole page

The only request needed for first paint. Called from a server component, so it must work
with a forwarded session cookie/bearer token or anonymously.

| | |
|---|---|
| Path param | `id` — the duelist's public profile id (`1234567890` in the mock) |
| Auth | Optional. Affects nothing in the response except that a private profile viewed by its owner may return full data |
| `200` | `Profile` (below) |
| `404` | Unknown id → the page calls `notFound()` and renders the existing 404 |
| `5xx` | Page should surface the generic error; do not render a half-empty profile |

### `Profile`

```jsonc
{
  "id": "1234567890",
  "displayName": "Yami Marufuji",        // masthead <h1>
  "handle": "@marufuji",                 // masthead, and the "Add {handle} as" prompt
  "bio": "I have been on the **TCG**…",  // markdown subset — see §5
  "status": "Online · In lobby",         // status pill; ignored when isPrivate
  "joined": "Joined Mar 2023",           // pill, pre-formatted
  "region": "Region: SA / Brazil",       // pill, pre-formatted
  "duelsPlayed": "1 294",                // meta strip + "N of {duelsPlayed} duels" rail
  "isPrivate": false,                    // see §4
  "avatar":       { "id": "71525232", "name": "Gandora-X the Dragon of Demolition" },
  "favoriteCard": { "id": "71525232", "name": "Gandora-X the Dragon of Demolition" },
  "favoriteDeck": {
    "name": "Mitsurugi",
    "art":  { "id": "13332685", "name": "Ame no Habakiri no Mitsurugi" }
  },
  "socials": [
    { "label": "Discord", "icon": "mdi:discord", "handle": "@marufuji", "href": "https://discord.gg/duelistsunite" }
  ],
  "relation": { "state": "none" },   // viewer's standing with this duelist — see §7.1
  "ladders": [ /* §1.2 */ ],
  "matches": [ /* §1.3 — first page only */ ]
}
```

**`CardArt`** is `{ id, name }` everywhere it appears. `id` is the card passcode; the client
builds the image URL itself as `https://ygopro.online/assets/card-arts/{id}.jpg`
(`CARD_ART_URL` in `utils/const.ts`). Do not send image URLs.

**`socials[].icon`** is an Iconify name. Prefer sending a `network` enum
(`discord | x | twitch | youtube`) and letting the client own the icon mapping — see §6.

### 1.2 `ladders[]` — one entry per format, in display order

A discriminated union on `played`. The page renders two cards side by side.

```jsonc
// played
{
  "format": "TCG",                 // pill label
  "accent": "green",               // "green" | "magenta" — drives elo colour + pill
  "played": true,
  "season": "Season 14 / Sep 2026",
  "elo": "1 842",
  "rank": "#127",
  "tier": "Diamond II",
  "record": "7W – 3L",             // caption beside the streak
  "recent": "WWLWWWLWLW",          // one char per duel, W or L, newest LAST
  "topDeck": { "name": "Mitsurugi", "art": { "id": "13332685", "name": "…" } },
  "topDeckMeta": "68 duels · 61% win rate"
}

// never entered this ladder
{ "format": "Genesys", "accent": "magenta", "played": false }
```

`played: false` renders the "No {format} duels yet" empty card — send **only** those three
fields, no zeroed stats.

`recent` length is not fixed; the card labels itself "Last {recent.length} duels".

### 1.3 `matches[]` — first page of history

```jsonc
{
  "id": "d-8841",                  // stable duel id, used as the React key
  "win": true,                     // from the profile owner's point of view
  "score": "2 – 0",
  "format": "TCG ranked",
  "event": "Ranked ladder",
  "when": "Today 21:14",           // pre-formatted — see §6
  "eloDelta": "+18 elo",           // pre-formatted, includes the unit
  "self":     { "name": "Yami Marufuji", "deck": "Mitsurugi",   "cards": [ /* 3 × CardArt */ ] },
  "opponent": { "name": "Kaibaholic",    "deck": "Sky Striker", "cards": [ /* 3 × CardArt */ ] }
}
```

`self.name` duplicates `displayName` on purpose: `MatchRow` renders both sides through the
same `MatchSide` component. `cards` is the deck's three representative arts — the layout
assumes 3, more will wrap.

---

## 2. `GET /profiles/{id}/matches` — "Load older duels"

Powers the button at the foot of the history section. Not wired up yet; the button is an
anchor until this exists.

| | |
|---|---|
| Query | `cursor` — opaque, from the previous response. Omit for the first page. |
| | `limit` — default 6 (what the design shows), max 50 |
| `200` | `{ "matches": Match[], "nextCursor": string \| null }` |
| `403` | Profile is private and the caller is not its owner |
| `404` | Unknown id |

`nextCursor: null` means the end of the list — the client hides the button.

Cursor pagination, not offset: duels are appended constantly and offsets would skip rows.

---

## 3. `GET /me` — the Friends / Rivals dock

Independent of the profile being viewed; it is the **signed-in viewer's** own data. The page
fetches it in the same `Promise.all` as the profile, so it must not depend on `{id}`.

| | |
|---|---|
| Auth | Required. `401` when signed out → the client renders no dock |
| `200` | `Viewer` |

```jsonc
{
  "name": "You",
  "avatar": { "id": "26077387", "name": "Sky Striker Ace Raye" },
  "presence": "online",            // online | busy | offline | invisible — see §3.1
  "status": "Thursday tournament at 20:00 — 4 slots left",   // ≤ 70 chars
  "nowPlaying": "Shuffle, Shuffle — Duel Anthems OST",        // null when nothing is playing
  "roster": [
    {
      "id": "kaiba",
      "kind": "friend",            // "friend" | "rival"
      "name": "Kaibaholic",
      "handle": "@kaiba",
      "presence": "busy",
      "status": "Round 3 vs Branded, wish me luck"
    }
  ]
}
```

`roster` is one flat list; the client splits it by `kind` and counts each tab. Sort both lists by
presence (`online`, then `busy`, then `offline`) — the panel's footer claims it is sorted and does
not re-sort.

**Live updates.** Presence goes stale within seconds. `GET /me` is fine for first paint;
a websocket or SSE channel pushing `{ id, presence, status }` deltas is the intended follow-up.
Polling this endpoint is not.

### 3.1 Presence is the duelist's own setting

Presence and the personal message are **visible to everyone, identically**. They are never scoped
to who is looking — a friend, a rival and a stranger all see the same value. What varies is only
what the duelist themselves chose.

| Value | Shown as | Set by |
|---|---|---|
| `online` | Ready to Duel | The duelist |
| `busy` | Busy | The duelist |
| `invisible` | Appear as offline | The duelist |
| `offline` | Offline | Nobody — it means disconnected |

Two rules follow:

- **`invisible` never leaves the server for anyone else.** A duelist who picked "Appear as offline"
  is reported as `offline` in every other viewer's `roster`. The value only ever appears in the
  requesting duelist's own top-level `presence`, so their picker shows what they chose.
- **`offline` is not selectable.** `PATCH /me` must reject it — a duelist cannot declare themselves
  disconnected; that is `invisible`.

---

## 4. Privacy — `isPrivate`

When a profile is private the client hides match history, deck usage, duel counts and the
recent-form streak. **The server must omit those fields too, not merely set the flag** —
hiding in the client still ships the data in the HTML payload.

With `isPrivate: true`, and the caller not being the owner:

| Field | Send |
|---|---|
| `duelsPlayed` | `"Private"`, or omit |
| `matches` | `[]` |
| `ladders[].topDeck`, `topDeckMeta`, `record`, `recent` | omit |
| `ladders[].format`, `accent`, `played`, `season`, `elo`, `rank`, `tier` | keep — standing stays public |
| everything else (`displayName`, `bio`, favorites, `socials`) | keep |
| `GET /profiles/{id}/matches` | `403` |

Note: `LadderStats` in `utils/types.ts` currently marks those four fields required. Omitting
them means widening the union with a third `played: true, detail: false` variant — small
change, worth doing so the privacy rule is enforced by the compiler rather than by review.

---

## 5. `bio` markdown subset

`ProfileBio` parses these and nothing else. Anything outside the list renders as literal text,
which is the safe failure mode — it is parsed to React nodes, never to an HTML string, so
there is no injection surface on the client.

| Syntax | Renders |
|---|---|
| blank line | paragraph break |
| `- item` / `* item` (whole block) | bullet list |
| `**bold**` | `<strong>` |
| `*italic*`, `_italic_` | `<em>` |
| `~~struck~~` | `<del>` |
| `` `code` `` | `<code>` |
| `[text](url)` | `<a target="_blank" rel="noopener noreferrer">` |

The server still owns the real validation: cap the length, and reject or strip raw HTML before
storing. Links are rendered verbatim — restrict schemes to `http`/`https` server-side.

---

## 6. Formatted strings — one decision to make

These arrive as display-ready strings today, matching how the design was written:

`joined`, `region`, `duelsPlayed`, `elo`, `rank`, `record`, `topDeckMeta`, `season`,
`score`, `when`, `eloDelta`, `socials[].icon`

That is the cheapest contract and needs no client change. Two are worth reconsidering before
you build it:

- **`when`** — send ISO 8601 (`"2026-09-11T21:14:00Z"`) and let the client render
  "Today 21:14". Relative time computed on the server is wrong the moment the page is cached
  or the reader is in another timezone.
- **`socials[].icon`** — send `network` as an enum. Icon names are a client concern and pin
  the backend to Iconify.

Everything else can stay a string; none of it is sorted, compared or localised.

---

## 7. Writes — what the UI already offers

The controls exist and hold local state; none of them persist yet.

### 7.1 Friend / rival links need consent from both sides

Filing a duelist is a **request**, not an instant link. `Profile.relation` (§1) carries where it
stands, and the button renders one of four states:

| `relation` | Button | Menu offers |
|---|---|---|
| `{ state: "none" }` | Add player to list | Friend · Rival |
| `{ state: "outgoing", kind }` | Friend request sent / Rival request sent | Cancel request |
| `{ state: "incoming", kind }` | Wants to be friends / Wants a rivalry | Accept · Decline |
| `{ state: "linked", kind }` | On friends list / On rivals list | Move to the other kind · Remove from list |

| Action | Endpoint | Body | Returns |
|---|---|---|---|
| Send or change a request | `PUT /me/roster/{profileId}` | `{ "kind": "friend" \| "rival" }` | `202` + `RelationStatus` |
| Accept an incoming request | `POST /me/roster/{profileId}/accept` | — | `200` + `RelationStatus` |
| Cancel · Decline · Remove | `DELETE /me/roster/{profileId}` | — | `204` |

Three rules make the flow behave:

- **`PUT` returns the resulting status, it does not assume `outgoing`.** If the other duelist
  already has a pending request to you of the same kind, accepting is redundant — link them
  immediately and return `{ "state": "linked", "kind": … }`. The client renders whatever comes back.
- **`DELETE` covers three UI actions** — cancelling your own request, declining theirs, and
  unfiling an accepted link. All three end at `{ "state": "none" }`, so one route is honest here.
  Reject it with `404` only when there was nothing to drop.
- **Changing kind re-opens consent.** Moving an accepted friend to rivals drops the link and sends a
  fresh request; it must not silently re-file them. `PUT` with the kind they are already linked as
  is a no-op — return the existing `linked` status.

`kind` is never inferred from who asked, and it changes nothing about visibility — a rival sees
exactly what a friend sees, because presence is the duelist's own setting (§3.1). `kind` only
decides which tab they appear under.

### 7.2 Incoming requests must be reachable off the profile

`GET /me` gains the pending requests aimed at the viewer, so they are not stranded behind
"happen to open that duelist's profile":

```jsonc
"requests": [
  { "profileId": "1234567890", "kind": "friend", "name": "Yami Marufuji", "handle": "@marufuji" }
]
```

Outgoing requests do not need to ship here — the client only shows them on the profile they
point at.

> **Client gap.** The Friends / Rivals dock renders accepted entries only; nothing surfaces
> `requests` yet. The route should carry the field from day one, but a pending section in the
> panel is still to build.

### 7.3 Presence and status message

| Control | Endpoint | Body | Returns |
|---|---|---|---|
| Presence `<select>` | `PATCH /me` | `{ "presence": "busy" }` | `204` — reject `offline` |
| Personal message `<input>` | `PATCH /me` | `{ "status": "…" }` | `204` |

Both fields are independent; accept either or both. Debounce the status input client-side (it fires
per keystroke today) and cap it at 70 characters server-side — the input's `maxLength` is a
convenience, not a constraint.
