# Profile API

Everything a client needs to show a duelist's profile page, page through their duel history, and let the signed-in duelist edit their own profile. Framework-agnostic: any browser, SSR, or native client.

Related: sign-in and sessions in [AUTH.md](./AUTH.md). Friend/rival requests, which affect who can see a private profile, are in [MESSENGER.md](./MESSENGER.md). The ladder seasons behind the ladder card, and the admin routes that refresh them, are in [RANKED_API.md](./RANKED_API.md).

---

## 1. Client requirements

| Requirement | Why |
|---|---|
| **Send cookies on every request** (`credentials: 'include'` / `withCredentials: true`). SSR: forward the user's `cookie` header. | Reads work without a session but are **anonymous**: private profiles come back gated. Writes need a session. |
| **Mutations need `Origin` = the frontend origin.** Browsers send it automatically; SSR/native clients must set it. | Otherwise `403 FORBIDDEN` ("Invalid request origin."). |
| **`Content-Type: application/json`** on `PATCH`. | Other content types get `415`; malformed JSON gets `400`. |
| **Treat every ID as a string.** | Duelist IDs are Discord snowflakes and exceed 2^53. |

---

## 2. Conventions

- **Base path:** `/profiles` on the API host.
- **Dates:** ISO 8601 UTC strings. Format them on the client, in the reader's locale and time zone.
- **Numbers** (`elo`, `duelsPlayed`, counts) are raw JSON numbers. Format them on the client.
- **Enums** (`region`, `network`, `visibility`, `tier`, ...) are sent as stable values. Labels, translations, and icons are the client's job.
- **Missing vs `null`:** a field that is **absent** was withheld (privacy, or not applicable). A field that is **`null`** exists but has no value. Don't treat them the same.
- **Errors:**

```json
{ "error": "BAD_REQUEST", "message": "region must be one of: north_america, latam, …" }
```

| Status | `error` | Meaning |
|---|---|---|
| `400` | `BAD_REQUEST` | Validation failed. `message` names the field (written for developers, not end users). |
| `401` | `UNAUTHENTICATED` | Endpoint needs a session and there is none. |
| `403` | `FORBIDDEN` | Profile is private to this viewer (`/matches` only), or a mutation from the wrong `Origin` (`"Invalid request origin."`). |
| `404` | `NOT_FOUND` | Unknown or malformed duelist ID. |
| `5xx` | — | Show a generic error. Never render a half-empty profile. |

Branch on status + `error`, never on `message`.

---

## 3. Endpoints

| Method | Path | Session | Purpose |
|---|---|---|---|
| `GET` | `/profiles/{id}` | Optional | Full profile page in one request |
| `GET` | `/profiles/{id}/matches` | Optional | Older duels (cursor pagination) |
| `GET` | `/profiles/{id}/decks` | Optional | "Decks this season": up to 3 decks per ladder (VIP) |
| `PATCH` | `/profiles/me` | Required | Edit own profile settings |
| `POST` | `/profiles/me/cover/sign` | Required (VIP) | Sign a direct cover-image upload |

**Valid `{id}`:** a Discord snowflake, digits only, no leading zero, at most 20 digits (e.g. `"187263901827563520"`). Anything else is `404`. A signed-in user's own ID is `id` from `GET /auth/me`.

---

### 3.1 `GET /profiles/{id}` — profile page

One request is enough to render the whole page. It works for any duelist in the Omega game database, including ones who never opened the site (they get default settings).

**Query parameters**

| Name | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `6` | Duels to embed. Values below 1 or non-numeric → `6`; above 50 → `50`. |
| `ladder` | `tcg` \| `genesys` | both | Restricts the embedded `matches` to one ladder. Any other value → `400`. Same name as in `/ranked`; `format` is the old name and still works. |
| `season` | season `code` | — | Embedded `matches` from that season only (its ladder). See §3.2. |
| `as` | `visitor` | — | **"View as visitor".** The owner gets the profile exactly as an anonymous visitor would (visibility and VIP privacy applied, `relation: none`, no owner fields). Ignored for anyone else, who already is a visitor. Any other value → `400`. Also on `/matches` and `/decks`. |

**Responses:** `200` Profile · `400` invalid `ladder` / unknown `season` · `403` `PAST_SEASONS_HIDDEN` (§3.2) · `404` unknown/malformed ID.

> **VIP vs non-VIP.** What a visible profile contains depends on whether the
> duelist is VIP and, for VIPs, on their privacy choices. The server already
> removed whatever this viewer may not see; `view` (§4.10) tells you what the
> page should render. Full rules in §6.

#### Visible profile (`isPrivate: false`)

```json
{
  "id": "187263901827563520",
  "displayName": "Yami Marufuji",
  "handle": "@marufuji",
  "avatar": "https://cdn.discordapp.com/avatars/187263901827563520/a1b2c3.png",
  "lastLogin": "2026-09-11T21:14:00.000Z",
  "isVip": true,
  "isDonator": true,
  "isAdmin": false,
  "passDueDate": "2026-12-01T00:00:00.000Z",
  "hasPass": true,
  "isPrivate": false,
  "relation": { "state": "linked", "kind": "friend" },

  "bio": "Since the **first Omega beta**…",
  "coverImage": "https://<uploads>/profile_covers/3f…",
  "region": "brazil",
  "favoriteCard": { "id": 46986431, "name": "Dark Magician" },
  "favoriteDeck": "Mitsurugi with Yummy",
  "socials": [{ "network": "x", "handle": "@marufuji", "href": "https://x.com/marufuji" }],
  "visibility": "everyone",
  "hideLastSeen": false,
  "privacy": { /* ProfilePrivacy, §4.11 — owner only */ },
  "view": { /* ProfileView, §4.10 */ },

  "duelsPlayed": 1294,
  "currentSeasons": [ /* CurrentSeason, §4.9 */ ],
  "ladders": [ /* Ladder, §4.2 */ ],
  "tournaments": { /* PlayerTournaments, §4.8 */ },
  "matches": [ /* Match, §4.3 */ ],
  "nextCursor": "3201510",
  "events": [ /* TimelineEvent, §4.12 */ ],
  "eloDays": [ /* EloDay, §4.12 */ ]
}
```

#### Private profile (`isPrivate: true`)

Only the identity header comes back. Every other field is **absent**:

```json
{
  "id": "187263901827563520",
  "displayName": "Yami Marufuji",
  "handle": "@marufuji",
  "avatar": "https://cdn.discordapp.com/avatars/187263901827563520/a1b2c3.png",
  "lastLogin": "2026-09-11T21:14:00.000Z",
  "isVip": true,
  "isDonator": true,
  "isAdmin": false,
  "passDueDate": "2026-12-01T00:00:00.000Z",
  "hasPass": true,
  "isPrivate": true,
  "relation": { "state": "none" }
}
```

The identity header and `relation` are always sent, so a private page can still show whose profile it is and offer a friend/rival request.

#### Fields

**Identity header. Always present:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Duelist ID. |
| `displayName` | string \| null | Discord display name, falling back to the username. `null` if the duelist never linked Discord. |
| `handle` | string \| null | `"@username"`, or `null`. |
| `avatar` | string \| null | Ready-to-use image URL, or `null` (show a placeholder). |
| `lastLogin` | date \| null | Last game-server login ("Last seen"). **Absent** when the duelist hides it (`hideLastSeen`) and the viewer is not the owner. Any duelist can hide it, VIP or not. |
| `isVip` | boolean | Game `accountrank >= 1`. The only claim the profile makes about rank. The raw rank is **not** exposed: `1` = VIP, `2` = Judge, `3` = Mod, `4` = Staff, `5` = Dev, and staff roles are not a public badge. |
| `isDonator` | boolean | **Deprecated** — alias of `isVip`, kept so existing clients don't break. It used to mean rank `=== 1` exactly, which wrongly excluded staff (they are VIP too). Read `isVip`. |
| `isAdmin` | boolean | The one full admin, currently a fixed duelist ID. **Not derived from the game rank** — that one is the game's staff ladder, not the site's. This is only the badge; what actually gates a route is the site `role`, see [AUTH.md](./AUTH.md). |
| `passDueDate` | date \| null | The **future** date and time the battlepass ends. Usually goes `null` once it ends, but don't rely on that. |
| `hasPass` | boolean | `passDueDate` is set **and still in the future**. Use this instead of checking `passDueDate !== null`: a date in the past is an expired pass, not a valid one. |
| `isPrivate` | boolean | Computed **for this viewer**: `true` when a VIP set `visibility: nobody` and the viewer is not the owner. A non-VIP profile is never private. |
| `relation` | Relation | Viewer ↔ duelist link, §4.1. Always `{ "state": "none" }` for anonymous viewers and for the owner. |
| `cosmetics` | object | Equipped items, slot → item. Visible profile: the `profile` and `avatar` types (background, song, badge, animated favorites, frame). Private profile: only the `avatar` ones (frame). `{}` when nothing is equipped. |

**Present only when `isPrivate` is `false`:**

| Field | Type | Notes |
|---|---|---|
| `view` | ProfileView | How this profile shows to **this viewer**: VIP or not, history window, timeline, charts, … §4.10. Render from this. |
| `bio` | string | **VIP only** (absent on non-VIP profiles). Markdown subset, max 2000 chars. `""` if unset. See §3.3 for what it can contain. Render it with a Markdown renderer that doesn't allow raw HTML. |
| `coverImage` | string \| null | **VIP only** (absent on non-VIP profiles). Cover image URL, original file — size it with `next/image`. `null` = no cover. |
| `region` | Region \| null | §4.5. |
| `favoriteCard` | CardArt \| null | §4.4. |
| `favoriteDeck` | string \| null | Free text the duelist wrote ("Mitsurugi with Yummy"). No art. `null` = not set. |
| `socials` | Social[] | **VIP only** (absent on non-VIP profiles). 0–5 entries, §4.6. |
| `duelsPlayed` | number | Lifetime TCG + Genesys record total (wins + losses + draws). |
| `ladders` | Ladder[] | Always exactly 2: `TCG` then `Genesys`. §4.2. |
| `tournaments` | PlayerTournaments | Tournament totals, titles and the 3 latest tournaments. §4.8. |
| `matches` | Match[] | Newest first, up to `limit`, inside this viewer's history window (§6). Only the ladder in `ladder`, when given. **Absent** when a VIP hides the history from this viewer (`view.matches: false`). §4.3. |
| `nextCursor` | string \| null | Pass to `/matches` to load older duels. `null` = no more (including "the window ends here"). Absent together with `matches`. |
| `events` | TimelineEvent[] | Events in the time span of this page of duels, newest first. **Present only when `view.events` is `true`** (VIP profile with the history visible). §4.12. |
| `eloDays` | EloDay[] | Elo change per day and ladder in the time span of this page. Present only when `view.events` and `view.charts` are `true`. §4.12. |

**Present only when the viewer is the owner:**

| Field | Type | Notes |
|---|---|---|
| `visibility` | Visibility | The owner's privacy setting, §4.7. Its presence tells you the viewer can edit this profile. |
| `hideLastSeen` | boolean | The owner hides `lastLogin` from everyone else. |
| `privacy` | ProfilePrivacy | The owner's VIP privacy choices, §4.11. Sent even when the owner is not VIP (they are kept, just not applied). |

---

### 3.2 `GET /profiles/{id}/matches` — older duels

Powers "load more". Same `Match` shape as the embedded list.

**Match history is ranked only.** Every entry comes from the ranked ladder — the
two ranked rooms, `TCG ranked` and `Genesys ranked`, and nothing else. Casual
duels are not part of a duelist's history and the backend does not read the
casual table at all, so there is no filter to turn them on and no `"…casual"`
value to handle.

**Query parameters**

| Name | Type | Default | Notes |
|---|---|---|---|
| `cursor` | string | — | `nextCursor` from the previous response (profile or matches). Omit (or send empty) for the first page. Opaque: pass it back unchanged and never build one. An invalid cursor is `400`. |
| `ladder` | `tcg` \| `genesys` | both | One ladder only. Any other value → `400`. Keep it the same across a cursor walk: the pages of one walk must all use the same filter. `format` is the old name and still works. |
| `limit` | integer | `6` | Same rules as above (1–50). |
| `season` | season `code` | — | Only that season's duels (its ladder). Open season: the normal window, cut at the season start. **Closed season:** the whole season, only if `view.pastSeasonMatches` is `true` — otherwise `403 PAST_SEASONS_HIDDEN`. Unknown code → `400`. With `ladder` too, both must agree (else `400`). Keep it the same across a cursor walk. |

**The window.** Every page stays inside this viewer's history window (§6): the
last 14 days for a non-VIP duelist, the VIP's choice (7/14/28 days or the whole
season) for visitors of a VIP, nothing for a VIP looking at their own profile —
and with the VIP's **24-hour delay** on, nothing younger than 24 h. The cursor
walk simply ends (`nextCursor: null`) at the edge of the window.

**`200 OK`**

```json
{ "matches": [ /* Match */ ], "nextCursor": "3195556", "events": [ /* §4.12 */ ], "eloDays": [ /* §4.12 */ ] }
```

`events` and `eloDays` follow the same rules as on the profile (§3.1, §4.12): each page carries the ones of its own time span.

- `nextCursor: null` is the stop condition, and it comes on the last page itself: a full last page no longer hands out a cursor to an empty one.
- It uses cursors, not offsets: duels finished while someone is paging are never skipped or repeated.
- The cursor is still **opaque** — pass it back unchanged. One that is not a valid cursor (including the old base64 pair from an earlier deploy) is `400 BAD_REQUEST`; restart from the first page.

**Other responses:** `400 BAD_REQUEST` invalid `ladder`, `cursor` or `season` · `403 FORBIDDEN` profile private to this viewer · `403 MATCHES_HIDDEN` the VIP hides their history from this viewer · `403 PAST_SEASONS_HIDDEN` closed `season` not shown · `404` unknown/malformed ID.

---

### 3.2.1 `GET /profiles/{id}/decks` — decks this season

The "Decks this season" card: the duelist's most played decks in the current season of each ladder, **up to 3 per
ladder**, counted in **matches** (duels), not games. Draw the two ladders separately.

**Who gets it:** `view.deckStats` (§4.10) — a VIP profile whose owner shows charts and decks to this viewer (the owner
always). Otherwise `403 DECKS_HIDDEN`. Same visibility gate as `/matches` (`403 FORBIDDEN` when private). Query: `as`
(§3.1).

```json
{
  "ladders": [
    {
      "format": "TCG",
      "season": { "code": "tcg-2", "label": "Season 2" },
      "decks": [
        { "key": "482", "name": "Mitsurugi", "art": { "id": 13332685, "name": "Ame no Habakiri no Mitsurugi" },
          "matches": 34, "wins": 22, "loses": 11, "draws": 1 }
      ]
    },
    { "format": "Genesys", "season": null, "decks": [] }
  ]
}
```

| Field | Notes |
|---|---|
| `ladders` | Always TCG then Genesys. |
| `season` | The newest season of the ladder the analytics has swept. `null` = nothing swept yet (then `decks: []`). |
| `decks` | Most matches first, at most 3. A match whose deck no archetype names is left out. |
| `name` | Archetype name (`"Snake-Eye / Fire King"` for a mixed deck), or `null` if unknown. |
| `art` | The deck's representative card, or `null`. Build the image from the passcode. |
| `matches` / `wins` / `loses` / `draws` | Matches with a result; a match is won by winning more games. Win rate = `wins / matches`. |

Comes from the daily analytics sweep (up to ~24 h behind) and is cached 5 minutes.

---

### 3.3 `PATCH /profiles/me` — edit own profile

**Session required.** Send **any non-empty subset** of the fields below. Omitted keys stay unchanged; `null` clears a nullable field.

**VIP fields.** `bio`, `socials`, `coverImageId`, `privacy` and a private
profile (`visibility: "nobody"`) are VIP features.
A non-VIP who sends a non-empty `bio`, a non-empty `socials`, a non-null
`coverImageId`, any `privacy` or `"visibility": "nobody"` gets `403 VIP_REQUIRED` and **nothing** in the
request is saved. Clearing (`"bio": ""`, `"socials": []`, `"coverImageId": null`, `"visibility": "everyone"`)
is always allowed, so a duelist whose VIP ran out can delete what they left
behind. Everything a VIP saved stays stored when the VIP ends; it just stops
showing until they are VIP again.

**Request**

```http
PATCH /profiles/me
Content-Type: application/json
```

```json
{
  "bio": "Since the **first Omega beta** — [my site](https://example.com \"Home\")",
  "region": "brazil",
  "visibility": "nobody",
  "hideLastSeen": true,
  "favoriteCardId": 46986431,
  "favoriteDeckName": "Mitsurugi with Yummy",
  "socials": [{ "network": "x", "handle": "@marufuji", "href": "https://x.com/marufuji" }],
  "coverImageId": "profile_covers/3f2a…",
  "privacy": { "matchWindow": "28d", "delayMatches": true }
}
```

| Field | Type | Nullable | Rules |
|---|---|---|---|
| `bio` | string | no (use `""`) | **VIP.** Max 2000 chars. **Raw HTML is rejected** (any `<` followed by a letter, `/` or `!`, which includes `<https://…>` autolinks). Every Markdown link, inline `[t](url)`, `[t](url "title")` or reference `[1]: url`, must be an absolute `http(s)` URL, a site path (`/wiki/…`; not `//host` or `/\host`) or an `#anchor` (max 500 chars). |
| `region` | Region | yes | One of §4.5. |
| `visibility` | Visibility | no | One of §4.7. `nobody` is **VIP**. |
| `hideLastSeen` | boolean | no | Hide `lastLogin` from everyone else. Free for every duelist. |
| `favoriteCardId` | integer | yes | Card passcode, 1–2147483647. |
| `favoriteDeckName` | string | yes | Free text, max 64 chars. Trimmed; `""` clears like `null`. Sent back as `favoriteDeck`. |
| `socials` | Social[] | no (use `[]`) | **VIP.** Max 5, one per `network`. Replaces the whole list. Each `href` must be an absolute `http(s)` URL (max 500 chars). `handle` is a string (max 64) or `null`. |
| `coverImageId` | string | yes | **VIP.** The `key` from §3.4, after the upload. The server reads the object itself: it must exist, be a real JPEG/PNG and pass moderation: `404` not uploaded, `422 UNPROCESSABLE` not a JPEG/PNG or rejected by moderation (the upload is deleted), `503 UNAVAILABLE` uploads not configured. Any other string → `400`. |
| `privacy` | Partial ProfilePrivacy | no | **VIP.** Any subset of §4.11; merged key by key into what is saved. Unknown key or wrong type → `400`. |

Rejected with `400`: an empty body `{}`, any unknown key (almost always a typo), or a wrong type.

**`200 OK`: the saved settings.** Render from this, not from what you sent (URLs come back normalized, card names resolved).

```json
{
  "bio": "Since the **first Omega beta** — [my site](https://example.com \"Home\")",
  "region": "brazil",
  "visibility": "nobody",
  "hideLastSeen": true,
  "favoriteCard": { "id": 46986431, "name": "Dark Magician" },
  "favoriteDeck": "Mitsurugi with Yummy",
  "socials": [{ "network": "x", "handle": "@marufuji", "href": "https://x.com/marufuji" }],
  "coverImage": "https://<uploads>/profile_covers/3f2a…",
  "privacy": { "hideElo": "none", "showPastSeasons": true, "hideMatches": false, "matchWindow": "28d", "showPastSeasonMatches": false, "hideTimeline": false, "hideDecks": false, "delayMatches": true, "hideCharts": false }
}
```

The response always carries the **saved** values, VIP or not (`privacy` complete, with defaults filled in).

**Other responses:** `400 BAD_REQUEST` · `401 UNAUTHENTICATED` · `403 VIP_REQUIRED` · `403 FORBIDDEN` (origin) · `404` / `422` / `503` (cover, see the table).

`favoriteDeckCardId` no longer exists: sending it is `400` (unknown key).

**Prefilling a settings form:** `GET /auth/me` → `GET /profiles/{thatId}` with the session. As the owner you always get the full profile, including `visibility` and `privacy`. `isVip` tells you whether to enable the VIP fields.

---

### 3.4 `POST /profiles/me/cover/sign` — cover upload (VIP)

The browser uploads the image **straight to S3** (presigned POST); the API only signs the
upload and later checks it.

```json
{ "contentType": "image/png" }
```

`contentType` is `image/jpeg` or `image/png` (the file's type): it goes into the signature.

```json
{
  "uploadUrl": "https://<bucket>.s3.<region>.amazonaws.com/",
  "fields": { "key": "incoming/profile_covers/3f2a…", "Content-Type": "image/png", "Policy": "…",
              "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": "…", "X-Amz-Date": "…", "X-Amz-Signature": "…" },
  "key": "profile_covers/3f2a…"
}
```

1. `POST /profiles/me/cover/sign { contentType }`.
2. `POST` a `multipart/form-data` to `uploadUrl` with **every** entry of `fields` unchanged, then `file` **last** (S3 ignores fields after the file). Changing any field breaks the signature; S3 answers `204` on success.
3. `PATCH /profiles/me { "coverImageId": key }` (the top-level `key`, not `fields.key`). Render `coverImage` from the response.

jpg/png only (Rekognition can't read webp; no gif, no svg), **2 MB at most** (recommended 1500 × 350): S3 itself refuses
a bigger file in step 2. Every upload goes through moderation; a rejected image fails step 3 with `422`. A new `key`
every time, valid for 5 minutes — sign again for each upload.

**Responses:** `200` · `400` (`contentType`) · `401` · `403 VIP_REQUIRED` · `503 UNAVAILABLE` (uploads not configured).

---

---

## 4. Shared types

### 4.1 Relation

```json
{ "state": "none" }
{ "state": "outgoing", "kind": "friend" }
```

| `state` | Meaning |
|---|---|
| `none` | No link, or anonymous viewer, or the viewer is the owner. `kind` is absent. |
| `outgoing` | Viewer sent a request that hasn't been accepted yet. |
| `incoming` | The duelist sent the viewer a request. |
| `linked` | Accepted. |

`kind`: `friend` \| `rival` — **the viewer's own** choice. Present on `outgoing` and `linked`; absent on `none` and `incoming` (the other side's kind is private, always). Relations no longer affect privacy (§4.7). Requests are sent and accepted through the messenger API.

### 4.2 Ladder

Two variants, discriminated by `played`.

```json
{ "format": "Genesys", "accent": "magenta", "played": false }
```

```json
{
  "format": "TCG",
  "accent": "green",
  "played": true,
  "elo": 1842,
  "tier": "Master",
  "allTime": { "wins": 812, "loses": 640, "draws": 12 },
  "seasons": [
    {
      "code": "tcg-2", "label": "Season 2", "ordinal": 2, "open": true,
      "startsAt": "2026-11-02T18:00:00.000Z", "endsAt": null,
      "elo": 1842, "tier": "Master", "rank": 127,
      "eloHistory": [
        { "day": "2026-11-03", "seasonDay": 2, "elo": 1790 },
        { "day": "2026-11-04", "seasonDay": 3, "elo": 1815 }
      ],
      "wins": 31, "loses": 20, "draws": 0
    },
    {
      "code": "tcg-1", "label": "Season 1", "ordinal": 1, "open": false,
      "startsAt": "2026-05-18T18:16:00.000Z", "endsAt": "2026-11-02T18:00:00.000Z",
      "elo": 2210, "tier": "Diamond", "rank": 58,
      "wins": 240, "loses": 171, "draws": 4
    }
  ],
  "recent": null,
  "topDeck": null,
  "topDeckMeta": null
}
```

| Field | Type | Notes |
|---|---|---|
| `format` | `"TCG" \| "Genesys"` | Only these two ranked ladders exist. **`Genesys` is what MySQL stores in its `ocg*` columns** — there is no OCG queue, and the client should never render the word. |
| `accent` | `"green" \| "magenta"` | Suggested theme color (TCG green, Genesys magenta). |
| `played` | boolean | `false` → **only** the three keys above exist. `true` = at least one lifetime game in the ladder. |
| `eloHidden` | `true` | Present only when a VIP hides this ladder's elo from this viewer. Then `elo`, `tier` and, in every season, `elo` / `tier` / `rank` / `eloHistory` are **absent**. The W/L record stays. |
| `elo` | integer | Live rating, rounded. Read from MySQL on every request, **never from the snapshot** — it is current, not as-of-last-sync. **Can be negative.** |
| `tier` | Tier | Derived from `elo` (table below). This *is* the rank; there's no leaderboard position field at this level. |
| `allTime` | `{ wins, loses, draws }` | Lifetime record for the ladder, live from MySQL. |
| `seasons` | LadderSeason[] | Newest first. The **open** season is always there (even at 0-0-0) — show it by default. Closed seasons appear only if the duelist played them — and only if the VIP shows past seasons (`view.pastSeasons`). |
| `recent` | string \| null | e.g. `"WWLWD"`, oldest → newest, variable length. Currently `null`. |
| `topDeck` | `{ name: string, art: CardArt }` \| null | Currently `null`. **Absent** when a VIP hides their decks (`view.decks: false`). |
| `topDeckMeta` | `{ duels: integer, wins: integer }` \| null | Win rate = `wins / duels`. Currently `null`. Absent together with `topDeck`. |

**LadderSeason**

| Field | Type | Notes |
|---|---|---|
| `code` | string | Season identifier — the one `GET /ranked/seasons/{code}/standings` takes. Editable by an admin, so don't persist it as a key. |
| `label` / `ordinal` | string / integer | "Season 2" / `2`. Show `label`; `ordinal` is the number within this ladder. |
| `open` | boolean | Exactly one `true` per ladder: the current season. |
| `startsAt` / `endsAt` | ISO string / ISO string \| null | `endsAt` is `null` on the open season. |
| `elo` / `tier` | integer / Tier | Open: the live rating (same as the ladder's `elo`). Closed: the rating frozen at the rollover. |
| `rank` | integer \| null | Position in that season's standings. Open: from the last sync, `null` before the duelist's first game of the season is synced. Closed: the final position. |
| `wins` / `loses` / `draws` | integer | Games played **in that season**. Open: live — lifetime minus the season's baseline, so it moves as soon as a game ends. Closed: frozen at the rollover. |
| `eloHistory` | `{ day, seasonDay, elo }[]` | **Open season only** (absent on closed ones), and **only when `view.charts` is `true`**: never on a non-VIP profile, not when a VIP hides charts or this ladder's elo. Every day recorded since the season opened, oldest first — one point per day from the daily ladder sync. `day` is `YYYY-MM-DD` in the job's timezone, `seasonDay` 1 = the day the season opened, `elo` the rating at the last sync of that day. Days before the duelist's first game in the ladder are left out; `[]` when there is nothing yet. Today's live value is the season's `elo`, not the last point. |

How the season record is computed (lifetime counter minus the baseline taken when
the season opened) is in [RANKED_API.md §1](./RANKED_API.md).

**A closed season's record can be larger than the ladder's `allTime`.** The game
wipes an account's lifetime ranked counters at its own reset, so a duelist can
show 906 wins in `tcg-1` and a lifetime of 5. That is not a bug to work around:
the closed season is a snapshot taken before the wipe, and keeping that history is
the whole reason the snapshot exists. The **open** season is derived from the live
counter and is always `<= allTime`. So don't validate one against the other, and
don't compute a "career total" by summing seasons against `allTime`.

`recent`, `topDeck` and `topDeckMeta` need a job that walks the ~30 GB duel table
and doesn't exist yet. Design the UI to work without them.

**The season can change under you.** An admin rollover closes a format's season
and opens the next one: the new season shows up first in `seasons` with
`open: true` at 0-0-0, and the closed one moves down with its final results. The
rating is reset together with the rollover. Nothing in the response tells the
client a rollover happened — don't cache a ladder card across a long-lived
session.

| Tier | Elo |
|---|---|
| `Iron` | below 50 (including negatives) |
| `Bronze` | 50 – 199 |
| `Silver` | 200 – 349 |
| `Gold` | 350 – 599 |
| `Platinum` | 600 – 999 |
| `Diamond` | 1000 – 1449 |
| `Master` | 1450 – 1999 |
| `Omega` | 2000+ |

Use the `tier` the API sends. Don't recompute it.

### 4.3 Match

Always from the **profile owner's** point of view.

```json
{
  "id": "ranked:3201510",
  "win": true,
  "score": { "self": 2, "opponent": 1 },
  "format": "TCG ranked",
  "event": "Ranked ladder",
  "when": "2026-09-11T21:14:00.000Z",
  "self":     { "id": "187263901827563520", "name": "Yami Marufuji", "avatar": "https://cdn.discordapp.com/avatars/…", "deck": null, "cards": [{ "id": 46986431, "name": "Dark Magician" }], "cosmetics": {} },
  "opponent": { "id": "298471029384710293", "name": "Kaibaholic",    "avatar": null, "deck": null, "cards": [], "cosmetics": {} }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Always `"ranked:<n>"`. Unique and stable, safe as a list key. |
| `win` | boolean \| null | `null` = draw or unfinished. **Not a loss.** The game stores the winner as the first duelist of the row, so this is `true` when the profile's duelist is that one. |
| `score` | `{ self, opponent }` | Games won by each side (0–3). |
| `format` | string | `"TCG ranked"` or `"Genesys ranked"` (`"Unknown"` would mean an unrecognised room, which the live data doesn't contain). This is the room the duel was played in; the `ladder` query parameter is the lowercase `tcg` / `genesys` filter. |
| `event` | string | Always `"Ranked ladder"`. |
| `when` | date \| null | Duel start. |
| `self` / `opponent` | MatchSide | See below. |
| `timeline` | boolean | `true` = `GET /analytics/matches/{id}/timeline` (the play-by-play built from the duel's card usage) answers for this viewer through this profile. Show the timeline button only when `true`. Always `false` on a non-VIP profile. |

MatchSide:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Duelist ID. Link to `/profiles/{id}`. |
| `name` | string \| null | Display name or username. `null` if unknown. |
| `avatar` | string \| null | Discord avatar URL, or `null` (show a placeholder). |
| `deck` | string \| null | Deck name (`"Branded"`, `"Snake-Eye / Fire King"` for a mixed deck), the same rule as the global analytics. `null` when no archetype names the deck, the deck can't be read, or it is hidden. |
| `cards` | CardArt[] | **0–2 images.** `cards[0]` = the main archetype's art; `cards[1]`, only in a mixed deck, = the secondary archetype's art — draw it smaller, overlapping the bottom-right corner of the first. A deck no archetype names gets one card (its first distinct card). Empty if the deck couldn't be read or is hidden. |
| `deckHidden` | `true` | `self` only. The VIP hides their decks from this viewer: `deck` is `null` and `cards` is `[]`. Show a "hidden deck" placeholder. |
| `cosmetics` | object | That duelist's equipped `avatar` items (frame), slot → item. `{}` when nothing is equipped. Present on both sides, in the profile's `matches` and in `/matches`. |

Per-duel Elo change isn't available.

### 4.4 CardArt

```json
{ "id": 46986431, "name": "Dark Magician" }
```

- `id`: card passcode (integer). **The API never sends image URLs.** Build card art URLs from the passcode using your own asset host.
- `name`: English name, or `null` if the passcode is unknown or the card database is briefly unavailable (e.g. right after a deploy). Treat `null` as "no label", not as an error.

### 4.5 Region

Server regions, not countries:

`north_america` · `latam` · `brazil` · `eu_west` · `eu_east` · `middle_east` · `africa` · `asia` · `oceania`

### 4.6 Social

```json
{ "network": "youtube", "handle": "@channel", "href": "https://youtube.com/@channel" }
```

| Field | Type | Notes |
|---|---|---|
| `network` | `instagram` \| `x` \| `youtube` \| `twitch` \| `website` | One entry per network. Discord isn't listed because it's the account itself. |
| `handle` | string \| null | Display text. Fall back to the URL host when `null`. |
| `href` | string | Absolute `http(s)` URL. Still open it with `rel="noopener noreferrer"`. |

### 4.7 Visibility

Controls the **whole** profile (everything except the identity header) and `/matches`.

| Value | Who sees the full profile |
|---|---|
| `everyone` | Anyone, including anonymous visitors. Default. |
| `nobody` | Owner only. **VIP only**: a non-VIP profile is always visible to everyone, whatever is saved. |

Friends and rivals no longer open a private profile (the old `friends_rivals` and `friends` values were migrated to
`nobody`). A saved `nobody` comes back into force when the duelist is VIP again.

### 4.8 PlayerTournaments

The duelist's record in the game's Swiss tournaments. Full detail, including
every round and decklist, is in [TOURNAMENT_API.md](./TOURNAMENT_API.md).

```json
{
  "played": 270,
  "titles": 78,
  "wins": 475,
  "loses": 254,
  "draws": 3,
  "points": 1428,
  "recent": [
    {
      "tournament": { "id": 1108, "format": "Edison", "status": "finished", "…": "TournamentSummary" },
      "standing": { "rank": 4, "points": 0, "wins": 0, "loses": 3, "draws": 0, "…": "Standing" }
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `played` | number | Tournaments entered, ever. |
| `titles` | number | Tournaments won (1st place). Ties on points are resolved by the Konami tiebreaker, so this is the real number of wins, not "finished on the top score". |
| `wins` / `loses` / `draws` | number | Tournament **matches**, summed across every tournament. Byes count as wins. |
| `points` | number | Match points summed across every tournament (`3 × wins + draws`). |
| `recent` | PlayerEntry[] | The 3 latest tournaments, newest first. Each is `{ tournament, standing }` with the same `TournamentSummary` and `Standing` shapes as the Tournament API, and `standing.deck` is this duelist's decklist. |

For the full history with pagination, call `GET /tournaments/players/{id}`
([TOURNAMENT_API.md §3.3](./TOURNAMENT_API.md)). A duelist who never entered a
tournament gets `played: 0` and `recent: []`, never a missing field.

---

### 4.9 CurrentSeason

The open season of each ladder, one entry per ladder, **in the same order as
`ladders`** (TCG, then Genesys).

```json
[
  { "format": "TCG", "code": "tcg-2", "label": "Season 2", "ordinal": 2,
    "accent": "green", "startsAt": "2026-09-22T00:00:00.000Z" },
  { "format": "Genesys", "code": "genesys-1", "label": "Season 1", "ordinal": 1,
    "accent": "magenta", "startsAt": "2026-09-20T00:00:00.000Z" }
]
```

Nothing about the duelist is in here — it is just "which season is running now".
Use it when you need to name the season on a profile where
`ladders[].seasons` **isn't there**: that array only exists for a ladder the
duelist has actually played (`played: true`), so a duelist who never duelled has
no season to read otherwise. When the ladder *was* played, the entry here is the
same season as its `open: true` one.

Costs no extra query — same rows that build `ladders`.

### 4.10 ProfileView

How **this** profile shows to **this** viewer, already applied by the server.
Present on every visible profile.

```json
{ "vip": true, "matches": true, "matchWindow": "28d", "delayed": true, "pastSeasonMatches": false,
  "timeline": true, "decks": true, "charts": true, "pastSeasons": true, "customization": true }
```

| Field | Type | Notes |
|---|---|---|
| `vip` | boolean | Same as `isVip`. |
| `matches` | boolean | `false` → no `matches` / `nextCursor`, and `/matches` is `403 MATCHES_HIDDEN`. Show "This duelist hides their match history". |
| `matchWindow` | `"7d" \| "14d" \| "28d" \| "season"` \| null | How far back the history goes. `"season"` = since the open season of each ladder started. `null` = no limit (a VIP on their own profile). |
| `delayed` | boolean | The history skips the last 24 h. Worth a hint ("shown with a 24 h delay"). |
| `pastSeasonMatches` | boolean | `?season=<closed season>` works. Offer a past-season picker only when `true`. |
| `timeline` | boolean | The profile shows play-by-play timelines. Per duel, read `Match.timeline`. |
| `decks` | boolean | `false` → the owner's side of every duel has `deckHidden: true`, and the ladders have no `topDeck`. |
| `charts` | boolean | Draw charts (the elo graph, …). `false` → no `eloHistory`; keep the simple layout. |
| `pastSeasons` | boolean | Closed seasons are in `ladders[].seasons`. |
| `customization` | boolean | `bio`, `coverImage` and `socials` are in the response. |
| `events` | boolean | `events` (and, with `charts`, `eloDays`) come with every page of the history: VIP profile with the history visible. §4.12. |
| `deckStats` | boolean | `GET /profiles/{id}/decks` answers: VIP profile showing charts and decks. §3.2.1. |

### 4.11 ProfilePrivacy

The VIP's choices about what **visitors** see. The owner always sees everything.
Defaults below (also what an account that never chose gets).

```json
{ "hideElo": "none", "showPastSeasons": true, "hideMatches": false, "matchWindow": "14d",
  "showPastSeasonMatches": false, "hideTimeline": false, "hideDecks": false, "delayMatches": false, "hideCharts": false }
```

| Field | Type | Default | Effect for visitors |
|---|---|---|---|
| `hideElo` | `"none" \| "tcg" \| "genesys" \| "both"` | `"none"` | Ladders listed get `eloHidden: true` (no elo, tier, rank, elo chart). |
| `showPastSeasons` | boolean | `true` | Closed seasons in the ladder cards. |
| `hideMatches` | boolean | `false` | No match history at all. |
| `matchWindow` | `"7d" \| "14d" \| "28d" \| "season"` | `"14d"` | How far back the history goes. |
| `showPastSeasonMatches` | boolean | `false` | Allow browsing the history of closed seasons (`?season=`). |
| `hideTimeline` | boolean | `false` | No play-by-play timeline. |
| `hideDecks` | boolean | `false` | The owner's deck name and images are hidden in the history (and no `topDeck`). Also turns the timeline off, since it carries the whole decklist. |
| `delayMatches` | boolean | `false` | The history only shows duels that started more than 24 h ago. |
| `hideCharts` | boolean | `false` | No chart data (`eloHistory`). |

### 4.12 TimelineEvent and EloDay

The duel history of a VIP profile is a timeline: duels grouped by day, with events between them. Each page of the
history (the profile's embedded one and every `/matches` page) covers a span of time — from the start of its oldest
duel (or the edge of the window, on the last page) up to the start of the previous page's oldest duel (or now, on the
first) — and carries the events and day changes of that span. Merge them with the duels by time.

Events are **gone with the history** (`view.matches: false`), follow the same window and 24 h delay, and the ladder
filter: a `ladder` or `season` query keeps only that ladder's events, and **tournaments only show with both ladders**
(no `ladder`, no `season`).

```json
[
  { "id": "tier:tcg:2026-11-02", "kind": "tier", "ladder": "TCG", "day": "2026-11-02",
    "direction": "up", "from": "Diamond", "to": "Master", "elo": 1460 },
  { "id": "tournament:1108", "kind": "tournament", "at": "2026-11-01T19:20:00.000Z",
    "tournament": { "id": 1108, "format": "Edison", "players": 64, "…": "TournamentSummary" },
    "standing": { "rank": 1, "wins": 5, "loses": 0, "draws": 0, "…": "Standing" } },
  { "id": "season:tcg-2:start", "kind": "season", "ladder": "TCG", "phase": "start",
    "at": "2026-11-02T18:00:00.000Z", "code": "tcg-2", "label": "Season 2" },
  { "id": "season:tcg-1:end", "kind": "season", "ladder": "TCG", "phase": "end",
    "at": "2026-11-02T18:00:00.000Z", "code": "tcg-1", "label": "Season 1",
    "standing": { "rank": 58, "tier": "Diamond", "elo": 2210, "wins": 240, "loses": 171, "draws": 4 } }
]
```

| `kind` | Notes |
|---|---|
| `tier` | Promotion (`direction: "up"`) or demotion (`"down"`) on one ladder, `from` → `to` tier, `elo` the rating at the end of that day. **Day only, no time** (`day`, `YYYY-MM-DD`): the data is the daily ladder sync. Place it at the top of its day. Not sent for a ladder whose elo is hidden. |
| `tournament` | Every finished Swiss tournament the duelist played: `tournament` (TournamentSummary) and `standing` (Standing, with the duelist's `rank`), the same shapes as `tournaments.recent`. `at` is when it ended. Highlight the podium (`standing.rank <= 3`). |
| `season` | A season of the ladder opened (`phase: "start"`) or closed (`"end"`). On a close, `standing` is the duelist's final result when they played it and the profile shows past seasons; `rank`, `tier` and `elo` are absent when that ladder's elo is hidden. |

- `id` is stable: the same event can come on two pages that share a boundary day — key by `id`.
- Newest first; a `tier` event sorts at the end of its `day`.

**EloDay** — the change of each ladder's rating on a day the duelist played it, newest first:

```json
[{ "day": "2026-11-02", "ladder": "TCG", "elo": 1842, "delta": 22 }, { "day": "2026-11-02", "ladder": "Genesys", "elo": 1512, "delta": -4 }]
```

- `day` is a `YYYY-MM-DD` in the ladder sync's time zone (UTC). **Group the duels by the same UTC day** for the deltas to
  match the duels under them.
- One entry per ladder per day; today's comes from the live rating. Days across a season rollover (the rating reset)
  are left out. Missing for a ladder whose elo is hidden, and entirely when charts are hidden (`view.charts: false`).
- Like events, a day on the boundary of two pages can come on both: key by `day` + `ladder`.

## 5. Recommended client flow

```text
Profile page /profile/:id
  └─ GET /profiles/:id  (with cookies)
       ├─ 404            → not-found page
       ├─ isPrivate      → header (avatar, name, handle, lastLogin) + relation action
       └─ otherwise      → full page
            ├─ "visibility" present → show "Edit profile"
            ├─ tournaments.played > 0 → tournament card (titles, record,
            │                          tournaments.recent) + "See all"
            └─ nextCursor != null   → show "Load older duels"

Ladder tab (TCG / Genesys)
  └─ GET /profiles/:id/matches?ladder=tcg|genesys
       └─ replace the list and the cursor; keep the same ladder while paging

Ladder card season picker
  └─ no request: every season is already in ladders[].seasons
       ├─ default → the entry with open: true
       ├─ pick a closed one → show its elo / tier / rank / record
       └─ "See full standings" → GET /ranked/seasons/{code}/standings (RANKED_API.md §3.8)

"Load older duels"
  └─ GET /profiles/:id/matches?cursor=<nextCursor>[&ladder=<same as the tab>]
       ├─ append matches; store new nextCursor
       ├─ nextCursor == null → hide button
       └─ 403 → profile became private: re-fetch the profile

"See all" (tournaments)
  └─ GET /tournaments/players/:id  → TOURNAMENT_API.md §3.3

Edit profile
  └─ PATCH /profiles/me  { changed fields only }
       ├─ 200 → replace local settings with the response
       ├─ 400 → show a field error (map by field, don't show message raw)
       ├─ 403 VIP_REQUIRED → offer VIP (bio, socials, cover, privacy)
       └─ 401 → session gone: send to sign-in

Cover (VIP)
  └─ POST /profiles/me/cover/sign → upload to S3 → PATCH /profiles/me { coverImageId }

Duel timeline (Match.timeline == true)
  └─ GET /analytics/matches/{id}/timeline  → ANALYTICS_API.md §1

```

Nothing here is rate limited, and there is no caching layer. Avoid polling the profile. Live presence and relation changes come from the messenger stream.

---

## 6. VIP and non-VIP profiles

`isVip` (game `accountrank >= 1`) decides which rules a profile follows. The
server applies them; `view` (§4.10) reports the result.

| | Non-VIP | VIP — visitors | VIP — the owner |
|---|---|---|---|
| Ladder data (TCG, Genesys) and tournaments | Always shown | Elo can be hidden per ladder; past seasons can be hidden | Everything |
| Match history | Always shown | Can be hidden | Everything |
| History window | Last **14 days**, fixed | 7 / 14 / 28 days or the whole season | No limit |
| 24 h delay | No | Optional | No |
| Past seasons' history (`?season=`) | No | Optional | Yes |
| Deck name and images in the history | Shown | Can be hidden | Shown |
| Play-by-play timeline | **Never** (not even for the owner) | Optional | Yes |
| Charts (`eloHistory`, `eloDays`) | **Never** | Optional | Yes |
| Timeline events (`events`) | **Never** | With the history | Yes |
| Decks this season (`/decks`) | **Never** | With charts and decks | Yes |
| Private profile (`visibility: nobody`) | **Never** (always visible) | Optional | — |
| Bio, cover image, social links | **Never** | Shown | Shown, editable |
| Hide last seen (`hideLastSeen`) | Optional | Optional | — |

- A non-VIP profile follows the non-VIP column for **every** viewer, the owner
  included: these are features of the account, not privacy choices.
- `visibility` (§4.7) applies to everyone, VIP or not, before any of this.
- Saved VIP data (bio, cover, socials, privacy) is kept when the VIP ends and
  comes back when it returns.
- The statistics page is VIP-only too; its API comes later.
