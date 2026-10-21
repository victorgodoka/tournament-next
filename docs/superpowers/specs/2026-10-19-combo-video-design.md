# Combo simulator: replay video download (MP4 and WebP) — design

Date: 2026-10-19
Status: superseded by `2026-10-20-combo-video-client-capture-design.md` (recorded in the viewer's browser)
Repos: `omega-server-v3` (table, routes, renderer service) and `tournament-next` (render page, download dialog).
Builds on: `2026-10-19-combo-sharing-design.md` (saved combos, the `/simulator/c/<id>` player and its replay timing).

## Goal

Anyone watching a shared combo downloads its replay as a video file to post elsewhere (Discord, X, Shorts). The video
is rendered on the server, frame by frame, from the same board the player shows: MP4 and animated WebP, in 16:9 or
9:16, at the replay speed the viewer picks.

## Decisions

| Topic | Decision |
|---|---|
| Where it renders | A separate `renderer` container (Chromium + ffmpeg) in the same compose; the API never runs Chromium |
| How frames are made | Approach A: a render page the renderer steps through time with `seek(ms)`, one screenshot per frame |
| Who downloads | Anyone with the link, signed out included |
| Formats | Every render writes both files from the same frames: MP4 (H.264) and animated WebP; the viewer picks at download |
| Frame shape | 16:9 (1280×720) or 9:16 (720×1280), the viewer's choice |
| Speed | 0.5x, 1x, 2x or 3x, the replay bar's speeds |
| Length | No limit. Queue caps protect the service instead (see Limits) |
| Storage | A `renders` docker volume on the host; files and their rows are deleted 30 minutes after the render finishes |
| Reuse | One render per (combo, revision, shape, speed) while it is queued, running or ready and unexpired |
| Out of scope | A button in the simulator itself (the owner opens their own link), GIF, audio, custom watermark, notifications |

## Server (`omega-server-v3`)

### Table `combo_renders`

```sql
CREATE TABLE IF NOT EXISTS combo_renders (
  id           TEXT PRIMARY KEY,                    -- 16 hex, like combos
  combo_id     TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  revision     INTEGER NOT NULL,
  shape        TEXT NOT NULL CHECK (shape IN ('landscape', 'portrait')),
  speed        REAL NOT NULL CHECK (speed IN (0.5, 1, 2, 3)),
  status       TEXT NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
  frames_done  INTEGER NOT NULL DEFAULT 0,
  frames_total INTEGER,
  error        TEXT,
  ip           TEXT NOT NULL,                       -- for the per-IP cap only
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS combo_renders_key ON combo_renders (combo_id, revision, shape, speed)
  WHERE status IN ('queued', 'running', 'ready');
CREATE INDEX IF NOT EXISTS combo_renders_queue ON combo_renders (created_at) WHERE status = 'queued';
```

A new table, so `CREATE IF NOT EXISTS` is enough (memory: schema changes need ALTER applies only to existing tables).
A `failed` row never holds the key, so trying again inserts a new row.

### Routes (`combo-renders.routes.ts`, under `/combos`)

- `POST /combos/:id/renders` `{ shape, speed }`, no auth. 404 when the combo does not exist. Looks up the combo's
  current revision; if a row with that key is queued, running, or ready with `expires_at > now()`, returns it (200).
  Otherwise checks the caps and inserts a `queued` row (202). Body validation: `shape` in the two values, `speed` in
  the four, nothing else; 400 `BAD_REQUEST` like `ComboError`. Rate limit `rateLimitOptions(10)`.
- `GET /combos/renders/:renderId` → `{ id, status, shape, speed, framesDone, framesTotal, position, expiresAt }`.
  `position` is the number of rows ahead of a queued one: the rows rendering plus the queued rows created before it
  (0 when running or done). `cache-control: no-store`.
  404 for an unknown id or an expired row.
- `GET /combos/renders/:renderId/:format` (`mp4` or `webp`, anything else 404) streams `${RENDERS_DIR}/<renderId>.<format>` with
  `content-type` `video/mp4` or `image/webp` and `content-disposition: attachment; filename="<title>.<format>"`. The title
  is reduced to letters, digits, spaces, `-` and `_` (max 80 characters, `combo` when nothing is left). 404 unless the
  row is `ready` and unexpired and the file exists. `cache-control: private, max-age=1800`.

### Limits

- At most 2 `queued` or `running` rows per IP (`request.ip`, which honours `TRUST_PROXY`): beyond that 429
  `RENDER_BUSY`.
- At most 20 `queued` rows in total: beyond that 503 `QUEUE_FULL`.
- Reuse is checked before both caps: asking for a render that already exists never counts against them.

### Renderer (`src/renderer/`)

A second entry point in the same repo, `src/renderer/main.ts`, with its own `Dockerfile.renderer` from Playwright's
official image plus `ffmpeg` from apt, run as the image's unprivileged user. New compose service `renderer` and image
`victorgodoka/omega-renderer`. It shares the Postgres settings and the `renders` volume (read-write; the API mounts it
read-only). The images create `/renders` with mode 1777: whichever container mounts the empty volume first, the renderer
can write to it.

- Queue: every 2 s it claims the oldest queued row with
  `UPDATE combo_renders SET status = 'running', started_at = now() WHERE id = (SELECT id FROM combo_renders WHERE
  status = 'queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. One render at a time.
- One Chromium kept open between renders; restarted after a crash, a timeout and every 50 renders.
- Per render:
  1. Open `${FRONTEND_URL}/simulator/c/<comboId>/render?shape=<shape>&speed=<speed>` at the shape's viewport,
     `deviceScaleFactor` 1. Every request is aborted except to the front's origin (`FRONTEND_URL`), the API's
     (`API_URL`: the browser loads the combo and the card data from it) and Iconify's API hosts (`api.iconify.design`,
     `api.simplesvg.com`, `api.unisvg.com`: the board's zone marks).
  2. Await `window.__render.ready` → `{ revision, durationMs }`. The page shows the combo as it is now; a newer
     revision than the row's is rendered under the row's key anyway (a later request for the new revision renders again).
  3. `frames_total = ceil(durationMs / 1000 × RENDER_FPS)`. For each frame `i`: `await page.evaluate(seek, i × 1000 /
     fps)`, `page.screenshot({ type: 'jpeg', quality: 92 })`, write it to ffmpeg's stdin.
  4. One ffmpeg process reads the JPEG stream (`-f image2pipe -framerate <fps>`) and writes both files:
     MP4 `scale=out_range=tv,libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -movflags +faststart` (the JPEGs are
     full range; the MP4 is pinned to tv range whatever the ffmpeg version), and WebP
     `fps=15,libwebp_anim -lossless 0 -quality 70 -loop 0`.
  5. `frames_done` is written every 30 frames. At the end: `status = 'ready'`, `finished_at = now()`,
     `expires_at = now() + RENDER_TTL_MIN`.
- Timeout: `10 × durationMs + 2 min` of wall time → `failed` with `error = 'timeout'`, files removed, Chromium
  restarted. A failed `ready` or an ffmpeg exit code ≠ 0 → `failed` with the message. A page error is logged, not
  fatal: only what holds up `ready`, `seek`, the timeout or ffmpeg fails a render.
- On boot, rows left `running` go back to `queued` (their partial files are removed).
- Cleanup every minute: delete rows whose `expires_at` has passed and `failed` rows older than a day, then every file
  in `RENDERS_DIR` without a `ready` row (expired, deleted combo, partial).
- Settings: `RENDERS_DIR` (both services), `RENDER_FPS=30`, `RENDER_TTL_MIN=30`, the existing `FRONTEND_URL`, and
  `API_URL` (the public API base, the front's `NEXT_PUBLIC_API_URL`).

## Front (`tournament-next`)

### Render page (`app/simulator/c/[id]/render/`)

Noindex, client-only, and nothing but the frame: no site header or footer, no countdown, no controls, no messenger
dock. The frame fills the viewport:

- A title strip on top: combo title, "by <owner>" when the owner has a name, and "YGO Omega Combo Simulator".
- The board, sized to fill the space left: this mode lifts the 84 px cap on `--card-w` and asks `next/image` for the
  width the cards are drawn at. The same 7-column board serves both shapes; only the card size changes.
- The caption under the board, as in the player, and a small step counter (`12/40`) in a corner.

`window.__render`:

- `ready: Promise<{ revision: number; durationMs: number }>`: resolves after the combo loads, every `<img>` on the page
  has settled (its `decode()` resolved or rejected: a broken image never holds the video back), the board's icons have
  loaded from Iconify and `document.fonts.ready`. Rejects when the combo is missing or damaged.
- `seek(ms): Promise<void>`, forward only (a smaller `ms` than the last call rejects). The timeline is a 1 s hold on
  the board at `start`, then each step from `start` for `stepMs(action) / speed`, then a 2 s hold on the final board.
  `seek` turns `ms` into (step, ms inside the step); when the step changed it moves the cursor and waits for React to
  commit (two animation frames), so the step's animations exist, and for the images the step mounted to settle (the
  board's icons, loaded by `ready`, are drawn from memory); then it pauses every `document.getAnimations()` (the FLIP
  moves and the activation glow) at the ms inside the step.

`stepMs` moves out of `use-replay.ts` into `utils/simulator` so the replay and the render page share one timing. The
opening hand drawn before `start` is not animated, as in the player.

### Download dialog (in `combo-player.tsx`)

- "Download video" beside "Operate from here", for everyone.
- Shape (16:9 / 9:16) and speed (0.5x / 1x / 2x / 3x, default 1x), with the estimated length (`~1 min 20 s`) from the
  same timeline.
- "Generate" posts, then polls `GET /combos/renders/:id` every 2 s: "In queue (N ahead)", "Rendering 34%", then two
  buttons, "Download MP4" and "Download WebP" (plain links to the file route).
- Closing the dialog cancels nothing; opening it again with the same choices gets the same render back from the POST.
- 503 → "The queue is full, try again in a few minutes". 429 → "You already have videos rendering, wait for them".
  `failed` → "Could not generate the video" with "Try again". A 404 on the status (expired) → back to "Generate". A ready
  render goes back to "Generate" when its `expiresAt` passes with the dialog open.
- API client in `utils/combos.ts`: `startRender(id, { shape, speed })`, `getRender(renderId)`,
  `renderFileUrl(renderId, format)`; every read uses `cache: 'no-store'`. Strings in en and pt, `Simulator` namespace.

## Errors

| Case | Server | Front |
|---|---|---|
| Combo deleted after the render was queued | Its rows cascade; the renderer's update finds nothing and it drops the job | The poll gets 404 → "Generate" |
| Front unreachable or render page fails | `failed` with the message | "Could not generate the video" |
| Renderer down | Rows stay `queued`; the queue cap still holds | "In queue" until it is back |
| Disk full | ffmpeg fails → `failed` | Same |

## Testing

- Server (node:assert, `test` script): POST validation (shape, speed, extra fields, unknown combo 404); reuse returns
  the same row for the same key and a new one after `failed` or expiry; the per-IP 429 and queue 503, and reuse not
  counting against them; status shape and `position`; file 404 when expired or missing; the filename cleaning.
- Server DB test (local guard, like `combos.db.test.ts`): two concurrent claims never take the same row; deleting a
  combo deletes its renders.
- Renderer: unit tests for the ffmpeg arguments, the timeout, and which rows and files the cleanup removes.
  `pnpm render:smoke <comboId>` renders one combo against local services so the two files can be watched.
- Front (vitest): the timeline (ms → step and offset, holds, speeds, total); `seek` refusing to go back; the dialog's
  states (queued with position, running with percent, ready links, 503, 429, failed + retry, expired → Generate).
- Manual: a real combo in both shapes at 1x and 3x, both files watched, the WebP posted to Discord.

## Deploy

Server first (table and routes), then the renderer (service, image, volume; idle with an empty queue), then the
front (render page and dialog together, so a render can only be queued once the page it opens exists).

## Risks

- A render takes about 2–3× the video's length (one screenshot is ~50–100 ms at 720p). With no length limit, a combo
  of hundreds of steps holds the queue for an hour or more; the caps contain it, they do not prevent it.
- Chromium needs ~300–500 MB of RAM and a full core while rendering; the host must have it to spare.
- `seek` is only exact if React has committed before the animations are paused; the smoke render is its first test.
- Card images are asked at a larger width through the front's image optimiser; each variant is cached 31 days.

## Files

| Repo | File | Change |
|---|---|---|
| server | `src/db/schema.ts` | `combo_renders` table and indexes |
| server | `src/modules/combos/combo-renders.{validation,repository,routes}.ts` + tests | Routes, limits, file streaming |
| server | `src/app.ts` | Register the render routes |
| server | `src/renderer/{main,queue,render,ffmpeg,cleanup}.ts` + tests | The renderer service |
| server | `Dockerfile.renderer`, `docker-compose.yml`, `package.json` | Image, service, volume, scripts, `playwright` dependency |
| front | `utils/simulator/timing.ts` + test | `stepMs` and the render timeline |
| front | `app/simulator/use-replay.ts` | Import `stepMs` from there |
| front | `app/simulator/c/[id]/render/*` | Render page and `window.__render` |
| front | `app/simulator/board.tsx` | Card width and image width overridable by the render page |
| front | `app/simulator/combo-player.tsx`, `video-dialog.tsx` + tests | Download dialog |
| front | `utils/combos.ts` + test | Render API client |
| front | `messages/en.json`, `messages/pt.json` | Dialog strings |
