# Combo Video Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone watching a shared combo downloads its replay as MP4 or animated WebP, 16:9 or 9:16, rendered on the server frame by frame.

**Architecture:** The API (`omega-server-v3`) queues renders in a `combo_renders` table and serves finished files from a shared volume. A separate `renderer` container (same repo, Playwright Chromium + ffmpeg) claims queued rows, opens a render page in the front (`tournament-next`) that exposes `window.__render.seek(ms)`, screenshots each frame and pipes them to one ffmpeg that writes both files. The shared player gets a "Download video" dialog that posts, polls and links the files.

**Tech Stack:** Fastify 5 + pg, node:assert tests run with tsx; Playwright (Chromium) + ffmpeg (libx264, libwebp_anim); Next 16 / React 19, next-intl, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-combo-video-design.md` (tournament-next, branch `claude/combo-video`).

**Worktrees:** front: `tournament-next/.claude/worktrees/combo-video` (branch `claude/combo-video`, already holds the spec and this plan). Server: create `omega-server-v3/.claude/worktrees/combo-video` on a new branch `claude/combo-video` from `main` (`ded9bbc`) before Task 1.

## Global Constraints

- Server: ESM with `.js` import suffixes; tests are `node:assert/strict` scripts run with `tsx`, and every new pure test file is appended to the `test` script in `package.json`. Server comments are Portuguese without accents, like the surrounding code; front comments are English.
- Server errors extend `HttpError` (`src/http/errors.ts`); render errors use `ComboError` from `combos.validation.ts`. Body: `{ error, message, details? }`.
- DB tests (`*.db.test.ts`) write to Postgres: never in the `test` script, and they refuse a non-local `PGHOST` with the same guard as `combos.db.test.ts`. Run them as `PGHOST=127.0.0.1 PGPORT=5432 pnpm exec tsx <file>`. Never point anything at a remote database.
- The renderer never imports `src/config/env.ts` (it requires Discord and MySQL settings the renderer does not have); it reads its own settings from `process.env`. `src/db/index.ts` is safe to import.
- Values, verbatim from the spec: shapes `landscape` 1280×720 and `portrait` 720×1280; speeds `0.5, 1, 2, 3`; `RENDER_FPS` 30; WebP at 15 fps, lossy quality 70, loop 0; MP4 `libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -movflags +faststart`; JPEG screenshots quality 92; `RENDER_TTL_MIN` 30; caps 2 active per IP → 429 `RENDER_BUSY`, 20 queued → 503 `QUEUE_FULL`; POST rate limit 10/min; poll every 2 s; holds 1000 ms at the start and 2000 ms at the end; timeout `10 × durationMs + 120000` ms; Chromium restart every 50 renders; progress written every 30 frames; cleanup every 60 s; `failed` rows deleted after 1 day.
- Front: React 19 lint (no set-state in effects, no impure render); strings in `messages/en.json` and `messages/pt.json` under `Simulator`; API reads use `cache: 'no-store'`.
- Commits follow each repo's style (`feat(combos): …`, `feat(simulator): …`, `feat(renderer): …`). No "Co-Authored-By" and no "Generated with" lines.

## Review Focus

1. Two POSTs for the same key at the same moment: the second insert hits the partial unique index (`23505`); it must return the row the first one made, never a 500. (Task 2 db test.)
2. A file asked for after `expires_at` but before the cleanup ran: 404, even though the file is still on disk. (Task 2 db test.)
3. `seek` jumping over more than one step in a single call (a low fps, or a step shorter than a frame at 3x): the cursor lands on the right step with the right offset. (Task 5 timeline test, Task 6 seek test.)
4. The first frame taken before the card images decoded: blank cards in the video. `ready` must wait for every `<img>` to decode. (Task 6 test.)
5. The renderer killed mid-render: rows stuck `running` forever. Boot puts them back to `queued` and removes their partial files. (Task 3 db test.)

---

### Task 1: `combo_renders` table and render validation (server)

**Files:**
- Modify: `src/db/schema.ts` (after the `combos` section)
- Create: `src/modules/combos/combo-renders.validation.ts`
- Test: `src/modules/combos/combo-renders.test.ts`; append `&& tsx src/modules/combos/combo-renders.test.ts` to the `test` script

**Interfaces:**
- Produces: `SHAPES = ['landscape', 'portrait'] as const`, `type Shape`; `SPEEDS = [0.5, 1, 2, 3] as const`, `type Speed`; `FORMATS = ['mp4', 'webp'] as const`, `type RenderFormat`; `MAX_ACTIVE_PER_IP = 2`; `MAX_QUEUED = 20`; `validateRenderInput(raw: unknown): { shape: Shape; speed: Speed }`; `isRenderFormat(raw: string): raw is RenderFormat`; `contentDisposition(title: string, format: RenderFormat): string`.

- [ ] **Step 1: Add the table** — the spec's SQL, with the `combos` id default: `id text PRIMARY KEY DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 16) CHECK (id ~ '^[0-9a-f]{16}$')`, lowercase types like the rest of `schema.ts`, `speed real`, and a Portuguese comment on what the table is. Both indexes from the spec.

- [ ] **Step 2: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { ComboError } from './combos.validation.js'
import { MAX_ACTIVE_PER_IP, MAX_QUEUED, contentDisposition, isRenderFormat, validateRenderInput } from './combo-renders.validation.js'

assert.deepEqual(validateRenderInput({ shape: 'landscape', speed: 1 }), { shape: 'landscape', speed: 1 })
assert.deepEqual(validateRenderInput({ shape: 'portrait', speed: 0.5 }), { shape: 'portrait', speed: 0.5 })
const bad = (raw: unknown, re: RegExp) =>
  assert.throws(() => validateRenderInput(raw), (e: unknown) => e instanceof ComboError && e.status === 400 && e.code === 'BAD_REQUEST' && re.test(e.message))
bad(null, /body must be an object/)
bad({ shape: 'square', speed: 1 }, /shape must be landscape or portrait/)
bad({ shape: 'landscape', speed: 1.5 }, /speed must be 0.5, 1, 2 or 3/)
bad({ shape: 'landscape', speed: '1' }, /speed must be/)
bad({ shape: 'landscape', speed: 1, fps: 60 }, /unknown fields: fps/)
assert.equal(isRenderFormat('mp4'), true)
assert.equal(isRenderFormat('webp'), true)
assert.equal(isRenderFormat('gif'), false)
assert.deepEqual([MAX_ACTIVE_PER_IP, MAX_QUEUED], [2, 20])
// letras (qualquer alfabeto), digitos, espaco, - e _; o resto some; 80 no maximo; vazio vira combo
assert.equal(contentDisposition('Tenpai: OTK!', 'mp4'), `attachment; filename="Tenpai OTK.mp4"; filename*=UTF-8''Tenpai%20OTK.mp4`)
assert.equal(contentDisposition('炎王 line', 'webp'), `attachment; filename="_ line.webp"; filename*=UTF-8''%E7%82%8E%E7%8E%8B%20line.webp`)
assert.equal(contentDisposition('!!!', 'mp4'), `attachment; filename="combo.mp4"; filename*=UTF-8''combo.mp4`)
assert.equal(contentDisposition('x'.repeat(100), 'mp4').match(/filename="(x+)\.mp4"/)![1]!.length, 80)
```

- [ ] **Step 3: Run it to see it fail** — `pnpm exec tsx src/modules/combos/combo-renders.test.ts` → fails: module not found.

- [ ] **Step 4: Implement `combo-renders.validation.ts`** — same `fail()` / unknown-fields style as `combos.validation.ts`. `contentDisposition`: clean with `/[^\p{L}\p{N} _-]/gu` → `''`, collapse spaces, trim, cut to 80, `'combo'` when empty; the quoted `filename` is that name with every non-ASCII character replaced by one `_` (consecutive ones collapse to one); `filename*` is `encodeURIComponent` of the clean name plus the extension.

- [ ] **Step 5: Run the test and `pnpm exec tsc --noEmit`** — both pass.

- [ ] **Step 6: Commit** — `feat(combos): combo_renders table and render request validation`

### Task 2: Render routes, queue caps and file streaming (server)

**Files:**
- Modify: `src/config/env.ts` (add `rendersDir: process.env.RENDERS_DIR ?? 'renders'`)
- Create: `src/modules/combos/combo-renders.repository.ts`, `combo-renders.service.ts`, `combo-renders.routes.ts`
- Modify: `src/app.ts` (register `comboRenderRoutes` with prefix `/combos`, after `comboRoutes`)
- Test: `src/modules/combos/combo-renders.db.test.ts` (DB test, not in the `test` script)

**Interfaces:**
- Consumes: Task 1's validation exports; `ComboError`; `rateLimitOptions`; `db`.
- Produces: the HTTP contract the front (Task 7) and renderer (Task 4) rely on:
  - `POST /combos/:id/renders` `{ shape, speed }` → 202 (new) or 200 (reused) with a `RenderInfo`.
  - `GET /combos/renders/:renderId` → 200 `RenderInfo`, `cache-control: no-store`; 404 when unknown or `expires_at <= now()`.
  - `GET /combos/renders/:renderId/:format` → the file, `content-type` `video/mp4` | `image/webp`, `content-disposition` from Task 1, `cache-control: private, max-age=1800`; 404 unless `ready`, unexpired and on disk.
  - `RenderInfo = { id: string; status: 'queued' | 'running' | 'ready' | 'failed'; shape: Shape; speed: Speed; framesDone: number; framesTotal: number | null; position: number; expiresAt: string | null }`. `position` = queued rows created before it + running rows, for a `queued` row; 0 otherwise.
  - Errors: 400 `BAD_REQUEST`, 404 `NOT_FOUND`, 429 `RENDER_BUSY`, 503 `QUEUE_FULL`, 429 `RATE_LIMITED` (plugin).

- [ ] **Step 1: Write the failing DB test** — copy the guard, `buildApp`/`migrate`/login setup and `inject` helper from `combos.db.test.ts` (inject also takes `remoteAddress` so the IP cap can be tested). Insert one combo with the logged-in user through `POST /combos`, then assert, cleaning `combo_renders` for that combo between blocks:

```ts
// novo: 202 queued, posicao 0 com fila vazia; mesmo pedido de novo: 200 e o mesmo id
const first = await post(comboId, 'landscape', 1)
assert.equal(first.statusCode, 202)
const { id: firstId, ...rest } = first.json()
assert.match(firstId, /^[0-9a-f]{16}$/)
assert.deepEqual(rest, { status: 'queued', shape: 'landscape', speed: 1, framesDone: 0, framesTotal: null, position: 0, expiresAt: null })
const again = await post(comboId, 'landscape', 1)
assert.equal(again.statusCode, 200)
assert.equal(again.json().id, firstId)
// corrida: dois POST iguais ao mesmo tempo dao o mesmo id, nenhum 500
const [r1, r2] = await Promise.all([post(comboId, 'portrait', 2), post(comboId, 'portrait', 2)])
assert.deepEqual([r1.statusCode, r2.statusCode].sort(), [200, 202])
assert.equal(r1.json().id, r2.json().id)
// failed nao segura a chave; ready vencido tambem nao
// (UPDATE para failed / ready com expires_at no passado, depois POST: 202 com id novo)
// limite por IP: o terceiro pedido ativo do mesmo IP e 429 RENDER_BUSY; um reuso nao conta
// fila: com 20 queued (inseridos direto no banco), um pedido novo e 503 QUEUE_FULL; um reuso continua 200
// combo inexistente 404; corpo ruim 400
// status: GET /combos/renders/:id devolve o RenderInfo com cache-control no-store; id desconhecido 404;
//   ready com expires_at no passado e 404
// arquivo: ready + arquivo em RENDERS_DIR -> 200, content-type video/mp4, content-disposition do Task 1;
//   formato gif 404; queued 404; ready vencido 404 mesmo com o arquivo no disco; ready sem arquivo 404
// apagar o combo apaga os renders (cascade)
```

`post(comboId, shape, speed, ip = '127.0.0.1')` wraps `inject('POST', `/combos/${comboId}/renders`, { shape, speed }, null)` with that `remoteAddress`. Every commented line is an assertion block the implementer writes out in full. `RENDERS_DIR` points at a temp dir (`fs.mkdtemp`) set before `buildApp()`.

- [ ] **Step 2: Run it to see it fail** — `PGHOST=127.0.0.1 PGPORT=5432 pnpm exec tsx src/modules/combos/combo-renders.db.test.ts` (with the main checkout's `.env` via `DOTENV_CONFIG_PATH` for MySQL) → 404 on the first POST.

- [ ] **Step 3: Implement repository, service and routes.**
  - Repository: `currentRevision(comboId): Promise<number | null>`, `findReusable(key)`, `countActiveForIp(ip)`, `countQueued()`, `insertRender(key, ip)` (returns `null` on `23505`), `findRender(id)` (with `position` computed in SQL and `expires_at > now()` in the WHERE).
  - Service `requestRender(comboId, raw, ip): Promise<{ created: boolean; render: RenderInfo }>`: validate → revision (404) → reusable? return it → caps (`RENDER_BUSY`, then `QUEUE_FULL`) → insert; on `null` (lost the race) read the reusable row and return it as not created.
  - Routes plugin `comboRenderRoutes`: its own `rateLimitOptions(60)` (polling every 2 s is 30/min) and `config: { rateLimit: { max: 10, timeWindow: '1 minute' } }` on the POST; the file route checks `isRenderFormat`, `fs.promises.stat` on `path.join(env.rendersDir, `${id}.${format}`)`, then `reply.send(fs.createReadStream(...))`. Ids pass `isComboId` or 404.

- [ ] **Step 4: Run the DB test, `pnpm test` (with the local overrides) and `pnpm exec tsc --noEmit`** — all pass.

- [ ] **Step 5: Commit** — `feat(combos): render requests, queue caps and rendered file downloads`

### Task 3: Renderer queue, ffmpeg arguments and cleanup (server, pure + DB)

**Files:**
- Create: `src/renderer/config.ts`, `src/renderer/queue.ts`, `src/renderer/ffmpeg.ts`, `src/renderer/cleanup.ts`
- Test: `src/renderer/renderer.test.ts` (append to the `test` script), `src/renderer/renderer.db.test.ts` (DB test)

**Interfaces:**
- Produces:
  - `config.ts`: `renderConfig = { frontendUrl, rendersDir, fps, ttlMin }` read from `FRONTEND_URL` (trailing `/` trimmed), `RENDERS_DIR` (`'renders'`), `RENDER_FPS` (30), `RENDER_TTL_MIN` (30); `VIEWPORTS = { landscape: { width: 1280, height: 720 }, portrait: { width: 720, height: 1280 } }`.
  - `queue.ts`: `type Job = { id: string; comboId: string; revision: number; shape: Shape; speed: Speed }`; `claimNext(): Promise<Job | null>` (the spec's `UPDATE … FOR UPDATE SKIP LOCKED` statement); `requeueRunning(): Promise<string[]>` (ids put back); `markProgress(id, done, total)`; `markReady(id, ttlMin)`; `markFailed(id, error)`; `deleteExpired(): Promise<number>` (expired `ready` rows and `failed` older than 1 day); `readyIds(): Promise<Set<string>>`.
  - `ffmpeg.ts`: `ffmpegArgs(dir: string, id: string, fps: number): string[]`; `timeoutMs(durationMs: number): number`.
  - `cleanup.ts`: `filesToDelete(names: string[], ready: Set<string>): string[]` (a file stays only when its basename before the extension is a ready id).

- [ ] **Step 1: Write the failing pure test**

```ts
import assert from 'node:assert/strict'
import { filesToDelete } from './cleanup.js'
import { ffmpegArgs, timeoutMs } from './ffmpeg.js'

assert.deepEqual(ffmpegArgs('/r', 'abc', 30), [
  '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', 'pipe:0',
  '-map', '0:v', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', '-f', 'mp4', '/r/abc.mp4.part',
  '-map', '0:v', '-vf', 'fps=15', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '70', '-loop', '0', '-f', 'webp', '/r/abc.webp.part',
])
assert.equal(timeoutMs(60_000), 720_000)
assert.deepEqual(filesToDelete(['a.mp4', 'a.webp', 'b.mp4', 'c.mp4.part', 'notes.txt'], new Set(['a'])), ['b.mp4', 'c.mp4.part', 'notes.txt'])
```

`.part` names: ffmpeg writes to `.part` and the renderer renames both files only after a clean exit, so the API never streams a half-written file. `-f mp4` / `-f webp` are needed because the `.part` suffix hides the format from ffmpeg.

- [ ] **Step 2: Write the failing DB test** (guarded, local Postgres): insert a combo and three `queued` rows; two concurrent `claimNext()` calls return two different ids, oldest first; a third call gets the third, a fourth gets `null`; `requeueRunning()` puts all three back to `queued` and returns their ids; `markReady` sets `status`, `finished_at` and `expires_at ≈ now() + 30 min`; `deleteExpired` removes a `ready` row whose `expires_at` is past and a `failed` row older than a day, keeps a fresh `failed` one.

- [ ] **Step 3: Run both to see them fail**, then **implement** `config.ts`, `queue.ts`, `ffmpeg.ts`, `cleanup.ts`.

- [ ] **Step 4: Run both tests and `pnpm exec tsc --noEmit`** — pass.

- [ ] **Step 5: Commit** — `feat(renderer): render queue, ffmpeg arguments and cleanup rules`

### Task 4: Renderer service, image and compose (server)

**Files:**
- Create: `src/renderer/render.ts`, `src/renderer/main.ts`, `src/renderer/smoke.ts`, `Dockerfile.renderer`
- Modify: `package.json` (dependency `playwright`; scripts `renderer: "node dist/renderer/main.js"`, `render:smoke: "tsx src/renderer/smoke.ts"`, `predeploy:renderer` / `deploy:renderer` mirroring `predeploy`/`postdeploy` for image `victorgodoka/omega-renderer:latest`), `docker-compose.yml` (service `renderer`, profile `prod`, and a `renders` volume mounted at `/renders` read-write there and read-only in `app`/`app-dev`, with `RENDERS_DIR=/renders` in all three), `README.md` (renderer in the scripts and background-jobs tables, and the deploy order: server, then renderer, then front)

**Interfaces:**
- Consumes: Task 3's queue, config, `ffmpegArgs`, `timeoutMs`, `filesToDelete`; the front's render page contract (Task 6): `GET ${FRONTEND_URL}/simulator/c/<comboId>/render?shape=<shape>&speed=<speed>` exposing `window.__render: { ready: Promise<{ revision: number; durationMs: number }>; seek(ms: number): Promise<void> }`.
- Produces: `renderJob(browser: Browser, job: Job): Promise<void>` (writes `<id>.mp4` and `<id>.webp` into `rendersDir`, throws on failure); `main.ts` loop.

- [ ] **Step 1: `render.ts`** — new context at `VIEWPORTS[job.shape]`, `deviceScaleFactor: 1`; `context.route('**/*', …)` aborts any request whose origin is not `frontendUrl`'s; `page.goto`; `await page.waitForFunction(() => window.__render)` then `await page.evaluate(() => window.__render!.ready)`; `framesTotal = Math.ceil(durationMs / 1000 * fps)`; spawn `ffmpeg` with `ffmpegArgs`; for each frame `await page.evaluate((ms) => window.__render!.seek(ms), i * 1000 / fps)`, `page.screenshot({ type: 'jpeg', quality: 92 })`, write to stdin respecting backpressure (`drain`); `markProgress` every 30 frames; end stdin, await exit code 0, rename both `.part` files, close the context in `finally`. The whole job races `timeoutMs(durationMs)`.

- [ ] **Step 2: `main.ts`** — on boot `requeueRunning()` and delete those ids' files; `chromium.launch()`; loop: `claimNext()`, none → wait 2 s; one → `renderJob` → `markReady(id, ttlMin)`, or `markFailed(id, message)` + remove its files + relaunch Chromium on a timeout or a browser crash; relaunch every 50 renders. A 60 s interval runs `deleteExpired()` then removes `filesToDelete(readdir(rendersDir), await readyIds())`. SIGTERM: stop claiming, close the browser, exit. Logs are one JSON line per render (id, frames, ms, outcome).

- [ ] **Step 3: `smoke.ts`** — `render:smoke <comboId> [shape] [speed]`: inserts a `queued` row for that combo (local Postgres only, the same host guard), runs `renderJob` once with a local browser, prints the two file paths and sizes. For checking a real combo by eye.

- [ ] **Step 4: `Dockerfile.renderer`** — `FROM mcr.microsoft.com/playwright:v<the installed playwright version>-noble`; `apt-get install -y --no-install-recommends ffmpeg`; pnpm install + `pnpm run build` like the API image; run as `pwuser`; `CMD ["node", "dist/renderer/main.js"]`. The Playwright image tag must equal the `playwright` package version in `pnpm-lock.yaml`.

- [ ] **Step 5: Verify** — `pnpm exec tsc --noEmit`; `pnpm test` (with the local overrides); `docker build -f Dockerfile.renderer -t omega-renderer:test .` succeeds and `docker run --rm omega-renderer:test ffmpeg -hide_banner -encoders` lists `libx264` and `libwebp_anim`. The real render is checked in Task 8.

- [ ] **Step 6: Commit** — `feat(renderer): renderer service, image and compose service`

### Task 5: Shared replay timing and the render timeline (front)

**Files:**
- Create: `utils/simulator/timing.ts`
- Modify: `app/simulator/use-replay.ts` (import `stepMs` from there; delete the local one)
- Test: `utils/simulator/timing.test.ts`

**Interfaces:**
- Produces: `stepMs(a: Action | undefined): number` (unchanged: 1200 for `move`/`draw`, else 700); `HOLD_START_MS = 1000`; `HOLD_END_MS = 2000`; `renderTimeline(actions: Action[], start: number, speed: number): { durationMs: number; at(ms: number): { cursor: number; offset: number } }` where `cursor` is the session cursor to show (`start` during the first hold, `start + k` while step `k` plays, `actions.length` in the last hold) and `offset` the ms since that cursor appeared: 0 throughout the start hold (and throughout when nothing plays after `start`); in the end hold the last step's offset keeps growing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { HOLD_END_MS, HOLD_START_MS, renderTimeline, stepMs } from './timing'

const move = { t: 'move', card: 0, to: 'm0' } as const
const end = { t: 'endTurn' } as const
const actions = [{ t: 'shuffle', order: [0] }, { t: 'draw', n: 1 }, move, end] as never[]

describe('renderTimeline', () => {
  it('holds, plays each step from start for stepMs/speed, then holds', () => {
    const tl = renderTimeline(actions, 2, 1)
    expect(tl.durationMs).toBe(HOLD_START_MS + 1200 + 700 + HOLD_END_MS)
    expect(tl.at(0)).toEqual({ cursor: 2, offset: 0 })
    expect(tl.at(999)).toEqual({ cursor: 2, offset: 0 })
    expect(tl.at(1000)).toEqual({ cursor: 3, offset: 0 })
    expect(tl.at(1500)).toEqual({ cursor: 3, offset: 500 })
    expect(tl.at(2200)).toEqual({ cursor: 4, offset: 0 })
    expect(tl.at(2900)).toEqual({ cursor: 4, offset: 700 })
    expect(tl.at(tl.durationMs + 50)).toEqual({ cursor: 4, offset: 2750 })
  })
  it('divides step time by the speed', () => {
    expect(renderTimeline(actions, 2, 2).durationMs).toBe(HOLD_START_MS + 600 + 350 + HOLD_END_MS)
  })
  it('lands past every step a long jump crosses', () => {
    // 3x: the move lasts 400 ms and the end turn 233.3 ms; 1640 is past both, in the end hold
    expect(renderTimeline(actions, 2, 3).at(1640)).toEqual({ cursor: 4, offset: 240 })
  })
  it('is only holds when nothing plays after start', () => {
    expect(renderTimeline(actions, 4, 1).durationMs).toBe(HOLD_START_MS + HOLD_END_MS)
  })
  it('keeps the replay timing', () => {
    expect([stepMs(move), stepMs(end), stepMs(undefined)]).toEqual([1200, 700, 700])
  })
})
```


- [ ] **Step 2: Run** `pnpm exec vitest run utils/simulator/timing.test.ts` → fails. **Step 3: Implement**, move `stepMs` out of `use-replay.ts`. **Step 4: Run** the new test plus `pnpm exec vitest run app/simulator` (replay tests unchanged) and `pnpm exec tsc --noEmit` → pass.

- [ ] **Step 5: Commit** — `feat(simulator): replay timing shared with the video timeline`

### Task 6: Render page and `window.__render` (front)

**Files:**
- Modify: `app/simulator/board.tsx` (optional `cardW?: number` and `imageSizes?: string` on `BoardViewProps`: when `cardW` is set the root's `--card-w` is `${cardW}px` instead of the `min(84px, …)` expression; `imageSizes` replaces `SIZES` for card faces and backs)
- Create: `app/simulator/c/[id]/render/page.tsx`, `app/simulator/c/[id]/render/render.loader.tsx`, `app/simulator/combo-render.tsx`, `utils/simulator/fit.ts`
- Test: `app/simulator/combo-render.test.tsx`, `utils/simulator/fit.test.ts`

**Interfaces:**
- Consumes: `getCombo`, `sessionOf` (as `combo-player.tsx` loads), `timeline`, `stepCards`, `BoardView`, `FLIP_MS`, Task 5's `renderTimeline`, `SPEEDS` from `replay-bar.tsx`.
- Produces: `window.__render` (declared in a `global.d.ts`-style `declare global` in `combo-render.tsx`): `{ ready: Promise<{ revision: number; durationMs: number }>; seek(ms: number): Promise<void> }`; `fitCardWidth(probe: number, measured: { width: number; height: number }, room: { width: number; height: number }): number` = `Math.floor(probe * Math.min(room.width / measured.width, room.height / measured.height))`.

- [ ] **Step 1: Write the failing tests**
  - `fit.test.ts`: `fitCardWidth(100, { width: 724, height: 640 }, { width: 1200, height: 560 })` → `87`; a room wider than tall picks the height ratio, taller than wide the width ratio.
  - `combo-render.test.tsx` (mock `getCombo` like `combo-player.test.tsx`; mock `Element.prototype.animate`/`document.getAnimations` with recorded `{ pause, currentTime }` stubs):
    - renders the title strip (title, "by <name>" only when the owner has a name, "YGO Omega Combo Simulator"), the caption of the step on screen, and `n/total` counter; no `ReplayBar`, no Operate, no countdown.
    - `window.__render.ready` resolves `{ revision, durationMs }` with `durationMs` from `renderTimeline(actions, start, 2)` when rendered with `speed={2}`.
    - `ready` stays pending while an `<img>` on the page has not decoded (stub `HTMLImageElement.prototype.decode` with a deferred promise) and resolves once it does.
    - `ready` rejects when `getCombo` returns `null` and when the payload is damaged (`sessionOf` → `null`).
    - `seek(500)` then `seek(2900)` (speed 1, start 2, four actions as in Task 5): the second call jumps from cursor 2 straight to 4; the counter and the board show cursor 4, and every stubbed animation got `pause()` and `currentTime = 700`.
    - `seek` with a smaller `ms` than the last rejects.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
  - `page.tsx`: reads `searchParams.speed` (`SPEEDS.find((s) => String(s) === raw) ?? 1`) and passes `speed` down; `pageMetadata({ title: t('title'), path: …/render, noIndex: true })`; no `<Header />`; `<main className="h-dvh w-dvw overflow-hidden bg-…">` with the loader. The messenger dock already hides itself for the signed-out renderer (it needs `S.me`); nothing to change there.
  - `render.loader.tsx`: `dynamic(..., { ssr: false })` like `combo-player.loader.tsx`.
  - `combo-render.tsx` (`ComboRender({ id, speed })`): load the combo; session at `cursor = start`; lay out title strip / board / caption in a column filling the viewport; size the board by rendering it once at `cardW = 100`, measuring the board root, then `cardW = fitCardWidth(100, measured, room)`; pass `imageSizes={`${cardW}px`}`; `flipMs = FLIP_MS / Math.max(1, speed)` as the player; `ready` = combo loaded → fitted → `Promise.all` of every `img.decode()` → `document.fonts.ready`; `seek(ms)`: `at(ms)` → if the cursor changed, dispatch it (`flushSync`) and await two `requestAnimationFrame`s → `document.getAnimations()` each `pause()` and `currentTime = offset`.
- [ ] **Step 4: Run** the new tests, `pnpm exec vitest run app/simulator utils`, `pnpm exec tsc --noEmit`, and `pnpm exec eslint` on the changed files → pass. Then open `/simulator/c/<a real id>/render?speed=1` in the browser pane at 1280×720 and 720×1280, run `await window.__render.ready` and a few `seek`s from the console, and compare against the player by eye (cards sharp, glow mid-pulse, arrows, caption).
- [ ] **Step 5: Commit** — `feat(simulator): render page the video renderer steps through`

### Task 7: Render API client and the download dialog (front)

**Files:**
- Modify: `utils/combos.ts` (+ `utils/combos.test.ts`), `app/simulator/combo-player.tsx` (+ `combo-player.test.tsx`), `messages/en.json`, `messages/pt.json`
- Create: `app/simulator/video-dialog.tsx`, `app/simulator/video-dialog.test.tsx`

**Interfaces:**
- Consumes: Task 2's HTTP contract; Task 5's `renderTimeline`.
- Produces: `type RenderInfo` (as Task 2); `startRender(id: string, input: { shape: 'landscape' | 'portrait'; speed: Speed }): Promise<RenderInfo>`; `getRender(renderId: string): Promise<RenderInfo | null>` (404 → `null`); `renderFileUrl(renderId: string, format: 'mp4' | 'webp'): string`; `VideoDialog({ open, onClose, comboId, actions, start })`.

- [ ] **Step 1: Write the failing tests**
  - `utils/combos.test.ts`: `startRender` POSTs `{ shape, speed }` to `/combos/<id>/renders` with `credentials: 'include'`, `cache: 'no-store'`, returns the body on 200 and 202; 429/503 reject as `ComboApiError` with `status` and `code`; `getRender` 404 → `null`; `renderFileUrl('r1', 'webp')` ends with `/combos/renders/r1/webp`.
  - `video-dialog.test.tsx` (fake timers; mock the three client functions):
    - shape and speed choices, default 16:9 and 1x; the estimated length is `renderTimeline(actions, start, speed).durationMs` formatted (`~1 min 20 s`, `~45 s`).
    - Generate → `startRender(id, { shape, speed })`; `queued` with `position: 2` shows "In queue (2 ahead)"; after 2 s `getRender` → `running` 34/100 shows "Rendering 34%"; then `ready` shows two links with `href = renderFileUrl(id, 'mp4' | 'webp')`.
    - `ready` straight from the POST (reused) shows the links with no polling.
    - 503 `QUEUE_FULL` → the queue-full message; 429 `RENDER_BUSY` → the busy message; `failed` → the failure message and "Try again" posts again; `getRender` → `null` → back to Generate.
    - Closing stops the polling (no `getRender` call after close).
  - `combo-player.test.tsx`: "Download video" shows for a signed-out viewer and opens the dialog.
- [ ] **Step 2: Run them to see them fail.** **Step 3: Implement** — polling with `setTimeout` chained from the previous response (never an interval), stopped on close/unmount; links are plain `<a href>` (the API's `content-disposition` makes them downloads); strings in en and pt under `Simulator.video`. **Step 4: Run** `pnpm exec vitest run app/simulator utils`, `pnpm exec tsc --noEmit`, eslint on changed files → pass.
- [ ] **Step 5: Commit** — `feat(simulator): download a combo's replay as MP4 or WebP`

### Task 8: End-to-end check (no commits)

- [ ] **Step 1: Run the stack locally** — local docker Postgres; the server branch on `127.0.0.1:3001` with `PGHOST=127.0.0.1 PGPORT=5432 REDIS_HOST=127.0.0.1 RENDERS_DIR=<temp dir>` and the main checkout's `.env` for the rest; the front worktree on 5174 with the same temporary `/api-proxy` rewrite and `.env.development.local` used in the sharing work (marked TEMP, reverted at the end); a test session minted on the local Postgres; one saved combo with at least 10 steps, a caption and an activation.
- [ ] **Step 2: Smoke render** — `pnpm render:smoke <id> landscape 1` and `portrait 2` with `FRONTEND_URL=http://localhost:5174` (local Chromium via `pnpm exec playwright install chromium` and a local ffmpeg; if ffmpeg is not on PATH, run the Task 4 image with `--add-host host.docker.internal:host-gateway` and `FRONTEND_URL=http://host.docker.internal:5174`). Watch both MP4s and both WebPs: every card face drawn, moves animated, glow visible, caption and counter right, nothing cut at the frame edges. Note render time against video length and the file sizes.
- [ ] **Step 3: Dialog flow** — run `main.ts` against the same database and volume; in the browser pane open the shared player signed out, Download video → Generate → watch "In queue"/"Rendering N%" → both links download files that play; ask again with the same choices → instant links (reuse); set the row's `expires_at` in the past → the links 404 and the dialog offers Generate again.
- [ ] **Step 4: Clean up** — revert the temporary files, stop every server and the renderer, delete the temp renders dir; `git status --short` clean in both worktrees.
