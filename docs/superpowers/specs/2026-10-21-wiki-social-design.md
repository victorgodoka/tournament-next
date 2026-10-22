# Wiki articles: views, likes, comments, sharing, covers and more ads — design

Date: 2026-10-21
Status: approved in brainstorming, awaiting spec review
Repos: `omega-server-v3` (API), `tournament-next` (front)

## Goal

A wiki article shows how many people read and liked it, lets signed-in duelists like it and talk
about it, and is one click away from X, Facebook, Reddit, WhatsApp or a copied link. The index
shows each article's cover. Article pages and the index carry more ad units where they fit without
crowding the reading.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Comments | **Signed-in, one level of replies.** Plain text. Author deletes their own; `wiki.write` deletes anyone's. No editing. |
| Likes | **Signed-in only**, one per account, can be undone. Signed-out readers see the count and a sign-in link. |
| Views | **Once per visitor per day.** Browser beacon; visitor = user id, else a keyed hash of the IP. No raw IP stored. |
| Data flow | **Approach A**: a separate `GET /wiki/:slug/social`, read on the server with the cookie beside the article. The article response keeps its public cache. |
| Ads | Fit more units: a content banner between the article and the comments; a full-width banner every 12th card on the index. |

## Background (current code)

- `GET /wiki/:slug` answers `public, max-age=300` for readers (`wiki.routes.ts`). Anything per
  viewer (my like) cannot ride on it.
- The front reads the article on the server, forwarding the cookie (`getArticle`,
  `app/wiki/[slug]/page.tsx`). Every SSR request reaches the API from **one IP**
  (`http/rate-limit.ts`), so anything keyed by the reader's IP must come from the browser.
- The cover is `doc.cover = { asset }`, a key into `doc.assets`; the asset carries `src`, `width`,
  `height`, `alt`, `focal`. The index (`listArticles` in `wiki.repository.ts`) selects no doc fields
  but the summary.
- Ads on an article today: `AdVideo` first in the column, `AdArticle` (Nitro's `article` format,
  spaced through `#wiki-body`), `AdBanner placement="aside"` pinned to the aside's bottom. The index
  has `ad-top` and `ad-bottom` banners. `ArticleCard` is also used on the home and welcome pages.
- Permissions: `wiki.write` (editor), `wiki.delete` (admin, any article), admin has all.
- Daily housekeeping: `server.ts` runs `setInterval(cleanSessions, 24h).unref()`.

## Backend (`omega-server-v3`)

### Schema (`src/db/schema.ts`, after `wiki_redirects`)

```sql
ALTER TABLE wiki_articles ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

-- Dedupe of the view counter: one row per article, day and visitor. Only today's rows matter;
-- the daily job deletes the rest. visitor = 'u:<user id>' or 'i:<hmac of the ip>'.
CREATE TABLE IF NOT EXISTS wiki_views (
  article_id integer NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  day        date    NOT NULL DEFAULT current_date,
  visitor    text    NOT NULL,
  PRIMARY KEY (article_id, day, visitor)
);

CREATE TABLE IF NOT EXISTS wiki_likes (
  article_id integer NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  user_id    text    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);

-- parent_id NULL = a thread; otherwise a reply to a thread (never to a reply: the service checks).
-- deleted_at: soft delete, so a thread with replies stays as "Comment deleted".
CREATE TABLE IF NOT EXISTS wiki_comments (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id integer NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  parent_id  bigint REFERENCES wiki_comments(id) ON DELETE CASCADE,
  author_id  text NOT NULL REFERENCES users(id),
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS wiki_comments_article_idx ON wiki_comments (article_id, parent_id, id);
```

### Routes (`wiki.routes.ts`, new code in `wiki.social.ts`)

All resolve `:slug` to a **published** article by its current slug; a draft, a missing or an old
slug is `404 NOT_FOUND`. Every response is `private, no-store`.

| Route | Auth | Body | Answer |
|---|---|---|---|
| `GET /wiki/:slug/social` | optional | — | `{ views, likes, liked, comments: Thread[] }` |
| `POST /wiki/:slug/views` | optional | — | `204` |
| `PUT /wiki/:slug/like` | required | — | `{ likes, liked: true }` |
| `DELETE /wiki/:slug/like` | required | — | `{ likes, liked: false }` |
| `POST /wiki/:slug/comments` | required | `{ body, parentId? }` | `201` `Comment` |
| `DELETE /wiki/:slug/comments/:id` | required | — | `204` |

```ts
type Comment = {
  id: string              // bigint as a string
  author: Author | null   // null once deleted
  body: string            // '' once deleted
  createdAt: string
  deleted: boolean
  parentId: string | null
}
type Thread = Comment & { replies: Comment[] }
```

- **Views**: skipped (still `204`) when the user-agent matches `/bot|crawl|spider|slurp|preview|headless/i`.
  `INSERT … ON CONFLICT DO NOTHING` into `wiki_views`; only when a row went in, `views = views + 1`.
  Visitor key: `u:<userId>` with a session, else `i:` + HMAC-SHA256(`COOKIE_SECRET`, `request.ip`).
  Rate limit: the existing `rateLimitOptions(60)`.
- **Likes**: `INSERT … ON CONFLICT DO NOTHING` / `DELETE`, then `count(*)`. Idempotent: two `PUT`s
  count once. Rate limit `rateLimitOptions(30)`.
- **Comments**: body trimmed, 1–2000 characters, no U+0000, else `400 BAD_REQUEST` (`ValidationError`). `parentId` must name a
  live thread (not a reply, not deleted) of the same article, else `400`. Rate limit
  `rateLimitOptions(10)`.
- **Delete comment**: author or `wiki.write`, else `403 FORBIDDEN`; unknown id or another article's
  is `404`. Sets `deleted_at`. Idempotent.
- **Reading comments**: threads newest first, replies oldest first. A deleted reply is left out; a
  deleted thread is left out unless it has a live reply, then it comes with `deleted: true`, empty
  body and no author. `ponytail:` at most 200 threads, cursor pagination when an article gets there.
- **Daily job**: `pruneViews()` (`DELETE FROM wiki_views WHERE day < current_date`) beside
  `cleanSessions` in `server.ts`.
- Comments and likes vanish with the article (`CASCADE`). A deleted account keeps its comments
  (`author_id` has no `ON DELETE`, as on `wiki_articles`).

### Index cover

`listArticles` also selects `a.doc -> 'assets' -> (a.doc -> 'cover' ->> 'asset') AS cover`;
`ArticleSummary.cover: WikiAsset | null`. Legacy Markdown articles and docs without a cover give
`null`. Same field on the other summary readers that feed `ArticleCard` (`getLatestArticles` goes
through `listArticles`).

### Docs

`docs/front/WIKI_API.md`: the six routes, the `cover` field, the errors above.

## Front (`tournament-next`)

### `utils/articles.ts` + `utils/types.ts`

`ArticleSocial`, `WikiComment`, `WikiThread` types; `ArticleSummary.cover?: WikiAsset | null`.
`getSocial(slug, cookie)` (server, `null` on failure), `countView(slug)` (browser, `keepalive`,
errors swallowed), `likeArticle(slug)`, `unlikeArticle(slug)`, `postComment(slug, body, parentId?)`,
`deleteComment(slug, id)` — all through the existing `request`.

### Article page (`app/wiki/[slug]/page.tsx`)

- `getSocial` runs in parallel with `getArticle` (same `cache`d loader pattern). Only for a published
  article: a draft shows no bar and no comments.
- **Article bar** (`components/omega/wiki/article-bar.tsx`, client): views, like toggle (count +
  pressed state; signed out it links to `/login` with `setReturnTo`), comments count linking to
  `#comments`, then share. Block articles: passed through `lead` before `AdVideo`. Markdown articles:
  under the byline. Sends `countView` once on mount.
- **Share**: plain links, `target="_blank" rel="noopener noreferrer"`, `@iconify` mdi icons, each with an
  accessible name:
  - X `https://x.com/intent/post?url=…&text=…`
  - Facebook `https://www.facebook.com/sharer/sharer.php?u=…`
  - Reddit `https://www.reddit.com/submit?url=…&title=…`
  - WhatsApp `https://wa.me/?text=…`
  - Copy link (`navigator.clipboard`, "Copied" for 2 s) — covers Discord
  - Share… (`navigator.share`), rendered only where the browser has it.
  The URL is `seo.canonical` when present, else `${SITE_URL}/wiki/${slug}`.
- **Comments** (`components/omega/wiki/comments.tsx`, client), `id="comments"`, in the article column
  **after** the `<article id="wiki-body">`, so the `article` ad format never spaces units through
  comments. Composer (textarea, 2000-character counter, Post), threads with `Byline` + `LocalTime`,
  Reply opens a composer under a thread, Delete (author or `wiki.write`) with a confirm step. After a
  write the list is updated from the answer, not refetched. Errors map to copy like `ArticleActions`
  (401 → "Your session expired. Sign in again.", 429 → "Slow down a moment."). Social load failed:
  "Comments couldn't load. Reload the page in a moment."
- `ArticleView` gets a `footer` prop rendered in the article column after the `<article>`; the column
  becomes a wrapper `div` holding the `order-*` classes. The editor preview passes nothing.

### Index covers (`components/omega/wiki/article.tsx`)

`ArticleCard` starts with a 1200×630 (`aspect-[40/21]`) `next/image` from `imageSource(cover, 640)`,
`object-cover`, `objectPosition` from `focal`, `alt=""` (the title is the link text), `sizes` for the
1/2/3-column grid. No cover: the same box as a plain `bg-surface-200` panel, so rows line up. Home and
welcome pick it up with no change of their own.

### More ads

- **Article page**: `AdBanner id="ad-comments" placement="content"` between the article and the
  comments, on both article kinds. On phones (aside hidden) this is the second in-column unit after
  the video, besides the `article` units and the anchor.
- **Index**: `ArticleList` inserts `<li className="col-span-full"><AdBanner id="ad-list-N" …/></li>`
  after every 12th card when another card follows (12 is whole rows at 2 and 3 columns). A 24-card page
  carries one; each "Load more" adds one. The rule lives in a small pure helper with a test.
- Considered and left out: a second aside unit (pushes Contents down inside a viewport-tall sticky
  aside) and 300×600 in the aside (the box reserves 250px; a taller fill would shift).

## Error handling

- Social fetch fails on the server: the article still renders; bar shows no counts, comments show
  the load error. A broken API never takes the article down.
- View beacon fails: ignored.
- Like / comment failures: the button returns to its previous state and a polite inline message
  shows; nothing is optimistic for comments (they appear when the API answers).

## Testing

- API (`wiki.test.ts`, run in the container): two `PUT /like` count once; second view the same day
  doesn't count, a bot UA doesn't count; reply to a reply is `400`; deleting someone else's comment is
  `403`, an editor's delete works; draft is `404` on every social route; deleted thread with a reply
  reads as `deleted: true`; index carries `cover`.
- Front: `tsc --noEmit` + `eslint`; a vitest for the index ad interleave helper; browser check of an
  article (bar, like, comment, reply, delete, share links, banner) and of `/wiki` (covers, list
  banner).

## Out of scope

View and like counts on index cards, editing comments, reply notifications, comment reporting,
user blocks applied to comments, Bluesky share (no mdi icon; add as a text link if wanted).
