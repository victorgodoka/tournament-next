# Wiki social (views, likes, comments, share, covers, ads) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wiki articles count views, take likes and threaded comments from signed-in duelists, link out to share; the index shows covers; both pages carry more ad units.

**Architecture:** API: new tables and a `wiki.social` service in the wiki module, served under `/wiki/:slug/*` from a child plugin with its own rate limit. Front: the article page reads `GET /wiki/:slug/social` on the server beside the article; a client bar and a client comments section do the writes from the browser.

**Tech Stack:** omega-server-v3 (Fastify, `pg`, node:assert tests run with tsx), tournament-next (Next App Router, React 19, Tailwind, `@iconify/react` mdi, vitest + React Testing Library).

**Spec:** `docs/superpowers/specs/2026-10-21-wiki-social-design.md` (tournament-next). Read it first; this plan does not repeat its decisions.

## Global Constraints

- Work on branch `feat/wiki-social` in **both** repos, created from `main` in the main checkouts (the API container bind-mounts the omega-server-v3 checkout; the front dev server runs from the tournament-next checkout on port 5173).
- Never push. A push to tournament-next `main` deploys the front.
- Commit messages: Conventional Commits, **no `Co-Authored-By` trailer** (user rule).
- Edit files with the Edit tool only: no `sed -i`, python or node rewrites (Git Bash flips CRLF/LF in omega-server-v3).
- API code comments in Portuguese without accents, matching the module; front comments in English. Match the surrounding comment density.
- Comment body: trimmed, 1–2000 characters by JS `.length`, no U+0000. The front counter uses the same `.length`.
- Rate limits: views `60`/min, likes `30`/min, comment writes `10`/min, via `rateLimitOptions(max)` from `src/http/rate-limit.ts`.
- Every social route answers `cache-control: private, no-store`.
- Bot test: `/bot|crawl|spider|slurp|preview|headless/i`; a missing user-agent counts as a bot.
- Index ad: after every **12th** card when another card follows; ids `ad-list-1`, `ad-list-2`, …
- Article ad id `ad-comments`, `placement="content"`.
- React hooks lint: no `setState` in effects, no `Date.now()` in render (user's lint rules are errors).

## Review Focus

1. A comment of only spaces, or with a U+0000 inside → `400`, never a Postgres `500`. Test in Task 1.
2. Replying to a thread that was deleted after the page loaded → `400` with a clear message, and the front shows it. Test in Task 1 (`assertReplyTarget`) and copy in Task 8.
3. Double-click on Post → one comment. Test in Task 8 (button disabled while pending).
4. Comment text with HTML or Markdown → shown as literal text, line breaks kept, long unbroken URLs wrap. Test in Task 8; wrap checked in Task 9's browser pass.
5. A request with no user-agent (curl, scripts) → not counted as a view. Test in Task 1.

---

### Task 1: API pure helpers for social

**Files:**
- Create: `omega-server-v3/src/modules/wiki/wiki.social.ts`
- Test: `omega-server-v3/src/modules/wiki/wiki.test.ts` (append a `// ---- social` section)

**Interfaces:**
- Produces (all exported from `wiki.social.ts`):
  - `MAX_COMMENT = 2000`, `MAX_THREADS = 200`
  - `interface CommentRow { id: string; parent_id: string | null; author_id: string; author_name: string | null; author_avatar: string | null; body: string; created_at: Date; deleted_at: Date | null }`
  - `interface Comment { id: string; parentId: string | null; author: Author | null; body: string; createdAt: Date; deleted: boolean }` (`Author` from `wiki.repository.ts`)
  - `interface Thread extends Comment { replies: Comment[] }`
  - `validateComment(input: unknown): { body: string; parentId: string | null }` — throws `ValidationError`
  - `isBot(userAgent: string | undefined): boolean`
  - `visitorKey(userId: string | null, ip: string, secret: string): string` — `u:<id>` or `i:` + HMAC-SHA256 hex (`node:crypto`)
  - `buildThreads(rows: CommentRow[]): Thread[]` — rows arrive in `id` order; threads newest first, replies oldest first; deleted reply dropped; deleted thread kept only with a live reply, then `author: null`, `body: ''`, `deleted: true`
  - `assertReplyTarget(parent: { parentId: string | null; deleted: boolean } | null): void` — throws `ValidationError('parentId must name a comment on this article')` when null, `'replies go under a comment, not under a reply'` when `parentId !== null`, `'that comment was deleted'` when deleted
  - `canDeleteComment(authorId: string, actor: Actor): boolean` — author or `wiki.write` (`Actor` from `wiki.service.ts`)

- [ ] **Step 1: Write the failing tests** (append to `wiki.test.ts`, importing from `./wiki.social.js`)

```ts
assert.deepEqual(validateComment({ body: '  oi  ' }), { body: 'oi', parentId: null })
assert.deepEqual(validateComment({ body: 'x', parentId: '12' }), { body: 'x', parentId: '12' })
assert.throws(() => validateComment({ body: '   ' }), /body must be 1-2000/)
assert.throws(() => validateComment({ body: 'a\u0000b' }), /body must be 1-2000/)
assert.throws(() => validateComment({ body: 'x'.repeat(2001) }), /body must be 1-2000/)
assert.throws(() => validateComment({ body: 'x', parentId: 'abc' }), /parentId/)
assert.throws(() => validateComment({ body: 'x', author: '1' }), /unknown fields/)

assert.equal(isBot(undefined), true)
assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true)
assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0) Chrome/130'), false)

assert.equal(visitorKey('42', '1.2.3.4', 's'), 'u:42')
assert.match(visitorKey(null, '1.2.3.4', 's'), /^i:[0-9a-f]{64}$/)
assert.notEqual(visitorKey(null, '1.2.3.4', 's'), visitorKey(null, '1.2.3.5', 's'))
assert.ok(!visitorKey(null, '1.2.3.4', 's').includes('1.2.3.4'))

// rows: 1 thread live, 2 thread deleted with live reply 4, 3 thread deleted alone, 5 deleted reply of 1, 6 reply of 1
const threads = buildThreads(rowsFixture)
assert.deepEqual(threads.map((t) => t.id), ['2', '1'])
assert.deepEqual(threads[0], { ...threads[0], deleted: true, body: '', author: null })
assert.deepEqual(threads[1]!.replies.map((r) => r.id), ['6'])

assert.throws(() => assertReplyTarget(null), /parentId must name/)
assert.throws(() => assertReplyTarget({ parentId: '1', deleted: false }), /not under a reply/)
assert.throws(() => assertReplyTarget({ parentId: null, deleted: true }), /was deleted/)
assertReplyTarget({ parentId: null, deleted: false })

const user = { userId: '7', permissions: [] }
assert.equal(canDeleteComment('7', user), true)
assert.equal(canDeleteComment('8', user), false)
assert.equal(canDeleteComment('8', { userId: '9', permissions: permissionsFor('EDITOR') }), true)
```

`rowsFixture` is a `CommentRow[]` built in the test with the six rows the comment describes.

- [ ] **Step 2: Run to verify it fails**

Run (host, no DB): `cd omega-server-v3 && npx tsx src/modules/wiki/wiki.test.ts`
Expected: FAIL, cannot find module `./wiki.social.js`.

- [ ] **Step 3: Implement the helpers in `wiki.social.ts`.** `validateComment` reuses `only`-style unknown-field check like `wiki.validation.ts` (`unknown fields: …`); `parentId` must match `/^[1-9]\d{0,17}$/`.

- [ ] **Step 4: Run to verify it passes** — same command, exits 0, no output.

- [ ] **Step 5: Commit** — `git add src/modules/wiki/wiki.social.ts src/modules/wiki/wiki.test.ts && git commit -m "feat(wiki): comment validation and thread assembly"`

### Task 2: API schema, repository and service

**Files:**
- Modify: `omega-server-v3/src/db/schema.ts` (after the `wiki_articles_hub_idx` line): the SQL block from the spec, verbatim.
- Create: `omega-server-v3/src/modules/wiki/wiki.social.repository.ts`
- Modify: `omega-server-v3/src/modules/wiki/wiki.social.ts` (service functions)
- Modify: `omega-server-v3/src/server.ts:33-35` (daily prune beside `cleanSessions`)

**Interfaces:**
- Consumes: Task 1 types and helpers.
- Produces (repository, all `async`):
  - `findPublishedId(slug: string): Promise<number | null>` — current slug only, `published_at IS NOT NULL`
  - `recordView(articleId: number, visitor: string): Promise<void>` — one statement: CTE `INSERT … ON CONFLICT DO NOTHING RETURNING 1`, then `UPDATE wiki_articles SET views = views + 1 … WHERE EXISTS (SELECT 1 FROM ins)`. Never touch `updated_at`.
  - `pruneViews(): Promise<number>`
  - `setLike(articleId: number, userId: string, liked: boolean): Promise<number>` — returns the new count
  - `loadStats(articleId: number, userId: string | null): Promise<{ views: number; likes: number; liked: boolean }>`
  - `listCommentRows(articleId: number, maxThreads: number): Promise<CommentRow[]>` — the newest `maxThreads` threads plus all their replies, `ORDER BY id`, author joined from `users`
  - `findComment(articleId: number, id: string): Promise<{ authorId: string; parentId: string | null; deleted: boolean } | null>`
  - `insertComment(articleId: number, authorId: string, body: string, parentId: string | null): Promise<CommentRow>`
  - `softDeleteComment(id: string): Promise<void>` — `deleted_at = COALESCE(deleted_at, now())`
- Produces (service, `wiki.social.ts`):
  - `interface Social { views: number; likes: number; liked: boolean; comments: Thread[] }`
  - `loadSocial(slug: string, viewerId: string | null): Promise<Social>`
  - `countView(slug: string, visitor: string): Promise<void>`
  - `like(slug: string, userId: string, liked: boolean): Promise<{ likes: number; liked: boolean }>`
  - `addComment(slug: string, authorId: string, input: { body: string; parentId: string | null }): Promise<Comment>`
  - `removeComment(slug: string, id: string, actor: Actor): Promise<void>` — unknown id → `WikiError(404, 'NOT_FOUND', 'Comment not found.')`; not allowed → `WikiError(403, 'FORBIDDEN', 'Only the author or an editor can delete this comment.')`
  - Every service function: `findPublishedId` null → `WikiError(404, 'NOT_FOUND', 'Article not found.')`.

- [ ] **Step 1: Add the schema block, repository and service** as above. `toComment(row)` maps a `CommentRow` to `Comment` (export it from `wiki.social.ts`; `buildThreads` uses it).
- [ ] **Step 2: Add `pruneViews` to `server.ts`** with the `cleanSessions` pattern: `const cleanViews = () => pruneViews().catch((err) => app.log.error(err))`, run once and on the same 24 h `setInterval(...).unref()`.
- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` exits 0.
- [ ] **Step 4: Restart the API so the schema runs** — `docker restart omega-server-v3-app-dev-1`, then `curl -s localhost:3000/health` → `{"status":"ok"}`.
- [ ] **Step 5: DB smoke check (throwaway)** — `docker cp` a `/tmp/wiki-social-smoke.mts` importing `/app/src/modules/wiki/wiki.social.ts` and `/app/src/db/index.ts`; run with `docker exec omega-server-v3-app-dev-1 sh -c 'cd /app && node --import tsx /tmp/wiki-social-smoke.mts'`. It picks one published slug and one draft slug from `wiki_articles` and two user ids from `users`, then asserts:
  - `like(slug, a, true)` twice → `likes` up by exactly 1; `like(slug, a, false)` → back down by 1
  - `countView(slug, 'i:smoke')` twice → `views` up by exactly 1
  - `addComment` a thread, a reply to it, then a reply to the reply → `ValidationError`
  - `removeComment` of `a`'s thread by `b` (no permissions) → 403; by `a` → ok; `loadSocial` shows it `deleted: true` with the reply
  - every function on the draft slug → 404
  - cleanup: delete the smoke comments, likes and `wiki_views` rows, restore `views`
  Expected: exits 0.
- [ ] **Step 6: Commit** — `git add src/db/schema.ts src/modules/wiki/wiki.social.ts src/modules/wiki/wiki.social.repository.ts src/server.ts && git commit -m "feat(wiki): views, likes and comments storage"`

### Task 3: API routes and docs

**Files:**
- Create: `omega-server-v3/src/modules/wiki/wiki.social.routes.ts` (`wikiSocialRoutes`)
- Modify: `omega-server-v3/src/modules/wiki/wiki.routes.ts` (`await fastify.register(wikiSocialRoutes)` right after the `cosmeticsHook` line, so comment authors get their frames too)
- Modify: `omega-server-v3/docs/front/WIKI_API.md` (new §4.15–4.20, one per route, request/answer/errors as in the spec)

**Interfaces:**
- Consumes: Task 2 service.
- Produces: the six routes of the spec's table, JSON `Comment.createdAt` as ISO string, `id`/`parentId` strings.

- [ ] **Step 1: Write `wikiSocialRoutes`.** Register `rateLimit` with `rateLimitOptions(60)` for the plugin; per-route `config: { rateLimit: { max: 30 } }` on like routes, `max: 10` on comment writes. Views route: `optionalAuth`, skip `countView` when `isBot(request.headers['user-agent'])`, visitor from `visitorKey(request.auth?.userId ?? null, request.ip, env.cookieSecret)`, reply `204`. Slug through `parseSlug` from `wiki.validation.ts` (`null` → `WikiError(404, 'NOT_FOUND', 'Article not found.')`; not `slugOf` from `wiki.routes.ts`, which would make an import cycle), comment id through a `/^[1-9]\d{0,17}$/` guard (`404 Comment not found.` otherwise). All replies `cache-control: private, no-store`.
- [ ] **Step 2: Typecheck + tests** — `npx tsc --noEmit` and `npx tsx src/modules/wiki/wiki.test.ts` exit 0.
- [ ] **Step 3: HTTP check** against the running container (it restarts or watches; restart if routes 404):
  - `curl -s -o /dev/null -w '%{http_code}' -X POST -A 'Mozilla/5.0 Chrome/130' localhost:3000/wiki/<published>/views` → `204`
  - `curl -s localhost:3000/wiki/<published>/social` → `{"views":…,"likes":…,"liked":false,"comments":[…]}`
  - `curl -s -o /dev/null -w '%{http_code}' -X PUT localhost:3000/wiki/<published>/like` → `401`
  - `curl -s -o /dev/null -w '%{http_code}' localhost:3000/wiki/<draft>/social` → `404`
  - `curl -sI localhost:3000/wiki/<published>/social | grep -i cache-control` → `private, no-store`
- [ ] **Step 4: Commit** — `git add src/modules/wiki/wiki.social.routes.ts src/modules/wiki/wiki.routes.ts docs/front/WIKI_API.md && git commit -m "feat(wiki): social routes"`

### Task 4: API index cover

**Files:**
- Modify: `omega-server-v3/src/modules/wiki/wiki.repository.ts` (`ArticleSummary`, `Row`, `toSummary`, the `listArticles` SELECT)
- Modify: `omega-server-v3/docs/front/WIKI_API.md` §4.1 (the `cover` field)

**Interfaces:**
- Produces: `ArticleSummary.cover: WikiAsset | null` (type from `wiki.doc.ts`); `Row.cover?: WikiAsset | null`; select `a.doc -> 'assets' -> (a.doc -> 'cover' ->> 'asset') AS cover`. `toSummary` maps `row.cover ?? null`, so readers that don't select it give `null`.

- [ ] **Step 1: Implement.** Only `listArticles` selects the column.
- [ ] **Step 2: Typecheck + tests** — as Task 3 Step 2.
- [ ] **Step 3: HTTP check** — `curl -s 'localhost:3000/wiki?limit=5'` → every article has a `cover` key; one with a doc cover shows `src`/`width`/`height`, a legacy one `null`.
- [ ] **Step 4: Commit** — `git commit -m "feat(wiki): cover on the article index"`

### Task 5: Front types and API client

**Files:**
- Modify: `tournament-next/utils/types.ts` (beside `ArticleSummary`)
- Modify: `tournament-next/utils/articles.ts`

**Interfaces:**
- Produces:
  - `ArticleSummary.cover?: WikiAsset | null` (import type from `@utils/wiki-doc`)
  - `WikiComment = { id: string; parentId: string | null; author: WikiUser | null; body: string; createdAt: string; deleted: boolean }`
  - `WikiThread = WikiComment & { replies: WikiComment[] }`
  - `ArticleSocial = { views: number; likes: number; liked: boolean; comments: WikiThread[] }`
  - `getSocial(slug: string, cookie?: string | null): Promise<ArticleSocial | null>` — `null` on any failure, logged
  - `countView(slug: string): void` — `fetch` POST with `credentials: 'include'`, `keepalive: true`, errors swallowed
  - `likeArticle(slug: string): Promise<{ likes: number; liked: boolean }>` (PUT), `unlikeArticle(slug)` (DELETE)
  - `postComment(slug: string, body: string, parentId?: string): Promise<WikiComment>`
  - `deleteComment(slug: string, id: string): Promise<void>`
  - `socialError(cause: unknown): string` — 401 → `'Your session expired. Sign in again.'`, 429 → `'Slow down a moment.'`, 400 → the API `message`, 404 → `'This article or comment is gone. Reload the page.'`, else `"Couldn't save that."`

- [ ] **Step 1: Implement** through the existing `request` and `json` helpers.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` exits 0.
- [ ] **Step 3: Commit** — `git add docs/superpowers/specs/2026-10-21-wiki-social-design.md docs/superpowers/plans/2026-10-21-wiki-social.md utils/types.ts utils/articles.ts && git commit -m "feat(wiki): social API client"` (the spec and this plan ride along on the first front commit).

### Task 6: Front index covers and list ads

**Files:**
- Modify: `tournament-next/components/omega/wiki/article.tsx` (`ArticleCard`)
- Create: `tournament-next/app/wiki/ad-breaks.ts`, Test: `tournament-next/app/wiki/ad-breaks.test.ts`
- Modify: `tournament-next/app/wiki/ArticleList.tsx`

**Interfaces:**
- Consumes: `ArticleSummary.cover` (Task 5), `imageSource` from `@utils/wiki-doc`, `AdBanner` from `@omega/ads/ad-banner`.
- Produces: `adAfter(index: number, total: number, every = 12): number | null` — the ad's ordinal (1-based) to place after the card at `index`, or `null`.

- [ ] **Step 1: Write the failing test**

```ts
expect(adAfter(11, 24)).toBe(1)
expect(adAfter(23, 24)).toBeNull()      // last card: the bottom banner follows
expect(adAfter(23, 25)).toBe(2)
expect(adAfter(0, 24)).toBeNull()
expect(adAfter(11, 12)).toBeNull()
expect([...Array(48).keys()].map((i) => adAfter(i, 48)).filter(Boolean)).toEqual([1, 2, 3])
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run app/wiki/ad-breaks.test.ts --exclude ".claude/**" --exclude ".worktrees/**"` → FAIL (module missing).
- [ ] **Step 3: Implement `adAfter`; use it in `ArticleList`** to render `<li className="col-span-full"><AdBanner id={`ad-list-${n}`} placement="content" /></li>` after the card (wrap each item in a `Fragment` keyed by `article.id`).
- [ ] **Step 4: Run to verify it passes** — same command → PASS.
- [ ] **Step 5: Cover in `ArticleCard`.** First child of the link: a `relative aspect-[40/21] -mx-4.5 -mt-4.5` box (bleeds to the card edge over its `p-4.5`) with `next/image` `fill`, `{...imageSource(cover, 640)}`, `alt=""`, `sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"`, `className="object-cover"`, `objectPosition` from `focal` as `ArticleView` does; no cover → the same box `bg-surface-200`.
- [ ] **Step 6: Typecheck + lint** — `npx tsc --noEmit` and `npx eslint app/wiki components/omega/wiki` exit 0.
- [ ] **Step 7: Commit** — `git commit -m "feat(wiki): covers on article cards, banner every 12 cards"`

### Task 7: Front article bar (views, like, share)

**Files:**
- Create: `tournament-next/components/omega/wiki/article-bar.tsx` (client)
- Create: `tournament-next/components/omega/wiki/share.ts`, Test: `tournament-next/components/omega/wiki/share.test.ts`

**Interfaces:**
- Consumes: Task 5 client; `useAuth` from `@contexts/auth/auth.context`; `setReturnTo` from `@utils/return-to`; `Icon` from `@iconify/react`.
- Produces:
  - `shareLinks(url: string, title: string): { id: 'x' | 'facebook' | 'reddit' | 'whatsapp'; label: string; href: string; icon: string }[]` — the four URLs of the spec, `encodeURIComponent` on both values; icons `mdi:twitter`, `mdi:facebook`, `mdi:reddit`, `mdi:whatsapp`
  - `ArticleBar({ slug, url, title, social }: { slug: string; url: string; title: string; social: ArticleSocial | null })`

- [ ] **Step 1: Write the failing test**

```ts
const links = shareLinks('https://site.gg/wiki/a-b?x=1', 'Blue-Eyes & friends')
expect(links.map((l) => l.id)).toEqual(['x', 'facebook', 'reddit', 'whatsapp'])
expect(links[0]!.href).toBe('https://x.com/intent/post?url=https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1&text=Blue-Eyes%20%26%20friends')
expect(links[3]!.href).toBe('https://wa.me/?text=Blue-Eyes%20%26%20friends%20https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1')
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/omega/wiki/share.test.ts --exclude ".claude/**" --exclude ".worktrees/**"` → FAIL.
- [ ] **Step 3: Implement `shareLinks`, then `ArticleBar`:**
  - `countView(slug)` once in a mount effect (no state set in it).
  - Views: `Intl.NumberFormat('en', { notation: 'compact' })`, label "views".
  - Like: `<button aria-pressed>`; signed out → `Link` to `/login` with `onClick={() => setReturnTo(location.pathname)}`; while pending the button is disabled; on failure the previous state comes back and `socialError` shows in an `aria-live="polite"` line.
  - Comments: `<a href="#comments">` with the count (threads + replies, deleted left out).
  - Share: the four links (`target="_blank" rel="noopener noreferrer"`, `aria-label={`Share on ${label}`}`), Copy link (`navigator.clipboard.writeText(url)`, "Copied" for 2 s), Share… only when `navigator.share` exists, read with `useSyncExternalStore(() => () => {}, () => 'share' in navigator, () => false)` (no `setState` in an effect, no hydration mismatch).
  - `social === null` → views and likes hidden, share still shown.
- [ ] **Step 4: Run to verify it passes** — same command → PASS; `npx tsc --noEmit` exits 0.
- [ ] **Step 5: Commit** — `git commit -m "feat(wiki): article bar with views, like and share"`

### Task 8: Front comments

**Files:**
- Create: `tournament-next/components/omega/wiki/comments.tsx` (client)
- Test: `tournament-next/components/omega/wiki/comments.test.tsx` (RTL, pattern of `app/wiki/editor/AssetLibrary.test.tsx`)

**Interfaces:**
- Consumes: Task 5 client and types; `Byline`, `ARTICLE_DATE_TIME` from `./article`; `LocalTime` from `@omega/profile/local-time`; `can` from `@utils/articles`.
- Produces: `Comments({ slug, initial }: { slug: string; initial: WikiThread[] | null })` — root `<section id="comments" aria-labelledby="comments-head">`.

- [ ] **Step 1: Write the failing tests** (mock `@utils/articles` `postComment`/`deleteComment` and `@contexts/auth/auth.context` `useAuth`):
  - `initial === null` → text "Comments couldn't load. Reload the page in a moment."
  - signed out → a "Sign in to comment" link, no textarea
  - signed in, type "hi", click Post twice fast → `postComment` called once (`toHaveBeenCalledTimes(1)`), then "hi" listed
  - a body `'<b>x</b>\nline'` renders the literal `<b>x</b>` text (no `b` element)
  - a deleted thread renders "Comment deleted" and its reply
  - Delete shows for the author and for a `wiki.write` user, not for anyone else
  - `postComment` rejecting with `WikiApiError(400, 'BAD_REQUEST', 'that comment was deleted')` → that message shows in the reply composer
- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/omega/wiki/comments.test.tsx --exclude ".claude/**" --exclude ".worktrees/**"` → FAIL.
- [ ] **Step 3: Implement `Comments`.** State: the thread list, seeded from `initial`. Composer: textarea `maxLength={2000}`, `{length}/2000` counter, Post disabled when trimmed empty or pending. Reply opens one composer under that thread (one open at a time). Delete has a confirm step like `ArticleActions`. Body: `whitespace-pre-line [overflow-wrap:anywhere]`. Updates come from the API answer (new comment prepended / appended to its thread; delete → marks deleted, or drops it when it has no live reply).
- [ ] **Step 4: Run to verify it passes** — same command → PASS; `npx tsc --noEmit` and `npx eslint components/omega/wiki` exit 0.
- [ ] **Step 5: Commit** — `git commit -m "feat(wiki): comments with replies"`

### Task 9: Front page wiring, ad and end-to-end check

**Files:**
- Modify: `tournament-next/components/omega/wiki/article-view.tsx` (`footer?: React.ReactNode` prop: the article column becomes a wrapper `div` with the `order-2 lg:order-1` classes holding `<article id={bodyId}>` and then `footer`)
- Modify: `tournament-next/app/wiki/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getSocial` (Task 5), `ArticleBar` (Task 7), `Comments` (Task 8), `AdBanner`.

- [ ] **Step 1: Wire the page.** `loadSocial = cache(async (slug) => getSocial(slug, cookie))` started beside `loadArticle` (`Promise.all`). Published only (`article.publishedAt`): block article → `lead={<><ArticleBar …/><AdVideo …/></>}` and `footer={<><AdBanner id="ad-comments" placement="content" className="mt-12" /><Comments …/></>}`; Markdown article → bar under the byline, banner + comments after `</article>` inside the same grid column. Share URL: `article.seo?.canonical ?? `${SITE_URL}/wiki/${article.slug}``.
- [ ] **Step 2: Typecheck, lint, all front tests** — `npx tsc --noEmit`, `npx eslint`, `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**"` → all pass.
- [ ] **Step 3: API full tests in the container** — `docker exec omega-server-v3-app-dev-1 sh -c 'cd /app && pnpm test'` → passes, except the two known data-state flakes (`cards.test.ts:113`, `panel.test.ts:607`), which must fail the same way on `main`.
- [ ] **Step 4: Browser check** (dev server on 5173 points at the local API; open with `preview_start {url}`, widen to 1700px for the ad rail; verify with `get_page_text` / `read_page` / `javascript_tool`, screenshots time out on this app):
  - `/wiki`: cards show covers, placeholders line up; with more than 12 articles the `ad-list-1` box sits after card 12 (with 12 or fewer the unit test is the proof)
  - a published block article and a Markdown one: bar with views/likes/share, `POST …/views` in network requests, the `ad-comments` box, `#comments` section after the article column and outside `#wiki-body`
  - signed in (the user's local session, if the pane has one): like toggles, post a thread, reply, delete; a 2000-char URL-like comment wraps without horizontal scroll at 375px
  - a draft (editor session): no bar, no comments
- [ ] **Step 5: Commit** — `git commit -m "feat(wiki): views, likes, comments, share and ads on articles"`
