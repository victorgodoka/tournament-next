# Combo video recorded in the browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the server-side combo video renderer with a recording made in the viewer's browser (Screen Capture
API + Element Capture + `MediaRecorder`) in a popup on the render page, and revert the renderer from `omega-server-v3`.

**Architecture:** The download dialog opens `/simulator/c/<id>/render?shape&speed` in a popup. There a new
`ComboRecorder` captures its own tab, restricts the track to the frame element, drives `ComboRender`'s existing `seek`
on a real-time clock and records with `MediaRecorder`; the result is a blob download. The server loses the merge that
added the renderer and drops its table.

**Tech Stack:** Next.js 16 / React 19 client components, next-intl, vitest + Testing Library on happy-dom; Fastify +
Postgres on the server.

**Spec:** `docs/superpowers/specs/2026-10-20-combo-video-client-capture-design.md`

## Global Constraints

- Front work happens in the worktree `C:/Users/marti/Documents/tournament-next/.worktrees/combo-video-client` (branch
  `feat/combo-video-client`). The main checkout belongs to another session: never edit or commit there, except deleting
  the untracked spike route in Task 5.
- Capture call, verbatim: `getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true,
  selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude' })`.
- Restriction: `track.restrictTo(await RestrictionTarget.fromElement(frame))`. Supported browser =
  `!!navigator.mediaDevices?.getDisplayMedia && 'RestrictionTarget' in window`.
- MIME types in order: `video/mp4;codecs=avc1.640028`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm`.
  `videoBitsPerSecond: 8_000_000`, `recorder.start(1000)`.
- 500 ms after the capture starts before sizing the frame (Chrome's sharing bar); the last frame stays 300 ms.
- Popup: name `combo-video`, features `popup,width=<w>,height=<h>`. 16:9 → 1280 × 768. 9:16 → height
  `min(1328, screen.availHeight − 80)`, width `Math.round((height − 48) × 9 / 16)`.
- File name: the combo title reduced to letters, digits, spaces, `-` and `_` (Unicode letters kept), trimmed, at most 80
  characters, `combo` when nothing is left; extension `mp4` or `webm` from the MIME type.
- Strings in `messages/en.json` and `messages/pt.json`, namespace `Simulator`, exact copy as given in the tasks.
- Checks: `npx tsc --noEmit`, `npx eslint <paths>`, `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**"
  <paths>`. No `next build`.
- ESLint errors on `react-hooks/set-state-in-effect` and `react-hooks/purity`: set state from promise callbacks or event
  handlers, never directly in an effect body; no `Date.now()` in render.
- Edit files with the Edit tool, not `sed -i` or scripts (Git Bash flips line endings).
- Commit messages without a `Co-Authored-By` trailer.
- Never boot the server (`src/server.ts`, `pnpm dev`) from the host in the server worktree: the host `.env` points
  `PGHOST` at the remote database, and the boot would drop `combo_renders` there while the old API still serves it.
  Only `tsc` and the database-free `combos.test.ts` run on the host.

## Review Focus

1. Record clicked twice before the prompt answers → one `getDisplayMedia` call (button disabled while starting). Test in Task 2.
2. Record again after a finished take → a fresh `ComboRender` (its `seek` is forward-only), the clock from 0, and the previous blob URL revoked. Test in Task 2.
3. A title with accents or only symbols (`Ação Rápida!`, `???`) → `Ação Rápida.mp4`, `combo.mp4`. Test in Task 2.
4. Sharing stopped from Chrome's bar before the recorder exists (during the 500 ms wait or the combo load) → "interrupted" message, no `MediaRecorder` built, no error thrown. Test in Task 2.
5. The page goes hidden before recording starts → nothing paused, and the clock starts at 0 when the recording does. Test in Task 2.

---

### Task 1: `ComboRender` hands its handle to a prop

**Files:**
- Modify: `app/simulator/combo-render.tsx`
- Test: `app/simulator/combo-render.test.tsx`

**Interfaces:**
- Produces: `export type RenderHandle = { ready: Promise<{ title: string; durationMs: number }>; seek(ms: number): Promise<void> }`
  and `ComboRender({ id, speed, onReady }: { id: string; speed: Speed; onReady(handle: RenderHandle): void })`.

- [ ] **Step 1: Set up the worktree**

Run in the worktree: `pnpm install --frozen-lockfile --prefer-offline`, then copy `.env.development` from
`C:/Users/marti/Documents/tournament-next/.env.development`. Expected: install finishes, `npx tsc --noEmit` exits 0.

- [ ] **Step 2: Move the tests to `onReady`**

In `combo-render.test.tsx`, `open` renders `<ComboRender id="c1" speed={speed} onReady={(h) => (handle = h)} />` with a
`let handle: RenderHandle | undefined` reset in `beforeEach`, and `page = () => handle!`. Rename
`ready gives the revision and the length of the video at its speed` to `ready gives the title and the length of the
video at its speed`, asserting `{ title: 'Opening line', durationMs: <the value it asserts today> }`. Add:

```tsx
it('calls onReady once, however often the parent re-renders with a new callback', async () => {
  const onReady = vi.fn()
  const view = render(<ComboRender id="c1" speed={1} onReady={onReady} />)
  await act(async () => {})
  view.rerender(<ComboRender id="c1" speed={1} onReady={(h) => onReady(h)} />)
  await act(async () => {})
  expect(onReady).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" app/simulator/combo-render.test.tsx`
Expected: FAIL (`handle` undefined, `title` missing).

- [ ] **Step 4: Implement**

Export `RenderHandle`. Delete `declare global` and every `window.__render`. Call `onReady` through `useEffectEvent`
(both the loaded handle and `failed(error)`), so an inline callback never re-runs the effects. `ready` resolves
`{ title: combo.title, durationMs }`. Update the component's doc comments: the recorder, not a renderer, drives it.

- [ ] **Step 5: Run the tests**

Run the Step 3 command. Expected: PASS. Then `npx tsc --noEmit`: the only error is in `render.loader.tsx` (no
`onReady` yet), which Task 2 fixes.

- [ ] **Step 6: Commit**

```bash
git add app/simulator/combo-render.tsx app/simulator/combo-render.test.tsx
git commit -m "refactor(simulator): render page hands its handle to onReady"
```

### Task 2: `ComboRecorder` in the popup

**Files:**
- Create: `app/simulator/combo-recorder.tsx`
- Test: `app/simulator/combo-recorder.test.tsx`
- Modify: `app/simulator/c/[id]/render/render.loader.tsx`, `app/simulator/c/[id]/render/page.tsx`
- Modify: `utils/simulator/timing.ts` (shape type)
- Modify: `messages/en.json`, `messages/pt.json` (`Simulator.render`)

**Interfaces:**
- Consumes: `RenderHandle`, `ComboRender` (Task 1).
- Produces: `export type Shape = 'landscape' | 'portrait'` in `utils/simulator/timing.ts`.
- Produces in `combo-recorder.tsx`: `ComboRecorder({ id, shape, speed }: { id: string; shape: Shape; speed: Speed })`,
  `frameBox(shape: Shape, width: number, height: number): { w: number; h: number }`, `videoName(title: string): string`
  (no extension), `MIME_TYPES` (the four types in order).

Strings, `Simulator.render` (keep `brand`):

| Key | en | pt |
|---|---|---|
| `record` | Record | Gravar |
| `hint` | Choose “This tab” in the browser's prompt. You can switch tabs while it records; keep this window open. | Escolha “Esta aba” no aviso do navegador. Você pode trocar de aba enquanto grava; mantenha esta janela aberta. |
| `recording` | Recording {elapsed} s of {total} s | Gravando {elapsed} s de {total} s |
| `cancel` | Cancel | Cancelar |
| `download` | Download {format} | Baixar {format} |
| `again` | Record again | Gravar de novo |
| `stopped` | The recording was interrupted. | A gravação foi interrompida. |
| `loadFailed` | Could not load the combo. | Não foi possível carregar o combo. |
| `failed` | Could not record the video. | Não foi possível gravar o vídeo. |

Behaviour (the spec's popup section, made concrete):

- The frame is a `div` sized `frameBox(...)` px with `isolation: isolate` and `bg-space-000`, holding
  `<ComboRender key={take} ... />`. It mounts at once as a preview, sized from `innerWidth`/`innerHeight`, so the idle
  popup already shows the title strip and the board. The overlay (hint, buttons, messages) is a sibling positioned over
  the frame, never inside its element.
- Record: phase `starting` (button disabled) → `getDisplayMedia` → 500 ms → a new box from the viewport and `take + 1`
  (a fresh `ComboRender`, whose `onReady` resolves the handle the start awaits) → `await handle.ready` →
  `restrictTo` → `MediaRecorder` → phase `recording`.
- Clock: `elapsed = performance.now() − t0`. On `visibilitychange` to hidden during `recording`: `recorder.pause()` and
  remember when; back to visible: move `t0` forward by the hidden time, `recorder.resume()`. Each animation frame:
  `await handle.seek(Math.min(elapsed, durationMs))`, `setElapsed(Math.floor(elapsed / 1000))`; at `durationMs`, wait
  300 ms, stop the recorder and the tracks, build the blob, phase `done` with `URL.createObjectURL(blob)`.
- `NotAllowedError` from the prompt → `idle`, no message. Track `ended` (any phase after the prompt) → stop everything,
  message `stopped`. `ready` rejects → `loadFailed` (also when the preview's `ready` rejects in idle). Anything else
  thrown → stop the tracks, message `failed`. Cancel → stop everything, `idle`, no link. Each take checks a token after
  every `await` and gives up once cancelled.
- Done: an `<a download={`${videoName(title)}.${ext}`}>` reading `render.download` with `{ format: 'MP4' }` or `'WebM'`,
  and `render.again`. A new take revokes the previous object URL.

- [ ] **Step 1: Write the failing tests**

`combo-recorder.test.tsx` (happy-dom). Mock `./combo-render` with a component that calls `onReady` once with a handle the
test controls (`ready` deferred, `seek` a `vi.fn` resolving). Stub `navigator.mediaDevices.getDisplayMedia`,
`globalThis.RestrictionTarget = { fromElement: vi.fn(async (el) => ({ el })) }`, a `MediaRecorder` class mock (records
constructor args, `start`/`stop`/`pause`/`resume` spies, `isTypeSupported` configurable, `stop` fires `dataavailable` then
`stop`), `URL.createObjectURL`/`revokeObjectURL`, `requestAnimationFrame` as a 16 ms `setTimeout`, and fake timers that
include `performance`. Tests:

- `frameBox fits the shape inside the viewport`: `frameBox('landscape', 1280, 720)` → `{ w: 1280, h: 720 }`;
  `frameBox('landscape', 1280, 680)` → `{ w: 1208, h: 679 }`; `frameBox('portrait', 720, 1240)` → `{ w: 697, h: 1239 }`.
- `videoName keeps letters, digits, spaces, - and _`: `'Opening line'` → `'Opening line'`; `'Ação Rápida!'` →
  `'Ação Rápida'`; `'../a/b?'` → `'ab'`; `'???'` → `'combo'`; a 100-letter title → 80 characters.
- `idle shows the hint and Record`.
- `Record captures this tab with the spec's options, restricts it to the frame and records MP4 at 8 Mbps`:
  `getDisplayMedia` called once with the Global Constraints object; `fromElement` got the element holding the mocked
  render; `MediaRecorder` built with `{ mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 8_000_000 }` and
  `start(1000)`.
- `plays the timeline to the end, then offers the file`: with `durationMs: 3000`, the last `seek` call is `3000`, seeks
  never decrease, the tracks' `stop` was called, and the link has `download="Opening line.mp4"` and the blob URL.
- `falls back to WebM where MP4 recording is missing`: `isTypeSupported` true only for `video/webm;codecs=vp9` → link
  `Opening line.webm`, text `render.download {"format":"WebM"}`.
- `a cancelled prompt goes back to idle without a message`: `getDisplayMedia` rejects `new DOMException('', 'NotAllowedError')`.
- `sharing stopped mid-recording says it was interrupted and offers no file`: dispatch `ended` on the track.
- `sharing stopped before the recording starts builds no recorder` (Review Focus 4): `ended` during the 500 ms wait.
- `a combo that does not load says so`: `ready` rejects → `render.loadFailed`.
- `restrictTo failing says the video could not be recorded and stops the capture`.
- `hidden pauses the recorder and the clock, visible resumes both`: hide for 5 s mid-take; `pause` then `resume` called,
  and the first `seek` after resuming is within one frame of the last one before hiding.
- `hidden before recording starts pauses nothing` (Review Focus 5).
- `Record is disabled while the prompt is open` (Review Focus 1): two clicks → one `getDisplayMedia` call.
- `Record again records from the start with a fresh render and revokes the last file` (Review Focus 2): the second
  take's first `seek` is `< 100`, `revokeObjectURL` got the first URL.
- `Cancel stops the take and returns to idle`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" app/simulator/combo-recorder.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`Shape` in `timing.ts`; `combo-recorder.tsx` per the behaviour above (`'use client'`, Chrome-only APIs typed locally
as in the spike: `RestrictionTarget` via `globalThis`, `restrictTo` on the track). Loader: parse `shape` (`'portrait'`
or `'landscape'`) beside `speed` and render `ComboRecorder` (dynamic, `ssr: false`, as `ComboRender` is today). Page:
pass `shape` from `searchParams`, comment says the recording popup. Strings from the table.

- [ ] **Step 4: Run the tests and the checks**

Run the Step 2 command, then `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" app/simulator/combo-render.test.tsx`,
`npx tsc --noEmit`, `npx eslint app/simulator utils/simulator`. Expected: all PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/combo-recorder.tsx app/simulator/combo-recorder.test.tsx "app/simulator/c/[id]/render" utils/simulator/timing.ts messages/en.json messages/pt.json
git commit -m "feat(simulator): record the combo video in a popup with Element Capture"
```

### Task 3: Dialog opens the popup; the render API client goes

**Files:**
- Modify: `app/simulator/video-dialog.tsx`, `app/simulator/video-dialog.test.tsx`
- Modify: `app/simulator/combo-player.test.tsx:189`
- Modify: `utils/combos.ts`, `utils/combos.test.ts`
- Modify: `components/omega/ads/ads-mode.ts:9-10` (comment)
- Modify: `messages/en.json`, `messages/pt.json` (`Simulator.video`)

**Interfaces:**
- Consumes: `Shape` (Task 2), `renderTimeline`.
- Produces: `popupFeatures(shape: Shape, availHeight: number): string` and `canRecord(): boolean`, exported from
  `video-dialog.tsx`. `VideoDialog`'s props are unchanged.

Strings, `Simulator.video`: keep `open`, `title`, `aspect`, `speed`, `length`; delete `generate`, `tryAgain`, `queued`,
`running`, `ready`, `downloadMp4`, `downloadWebp`, `queueFull`, `busy`, `failed`; add:

| Key | en | pt |
|---|---|---|
| `record` | Record | Gravar |
| `opened` | The recording goes on in the window that opened. | A gravação continua na janela que abriu. |
| `popupBlocked` | Your browser blocked the window. Allow pop-ups for this site and try again. | O navegador bloqueou a janela. Permita pop-ups deste site e tente de novo. |
| `unsupported` | Recording a video works in Chrome or Edge on a computer. | Gravar vídeo funciona no Chrome ou no Edge, no computador. |

- [ ] **Step 1: Rewrite the dialog tests**

Keep the `VideoDialog choices` block, minus the `video.generate` assertion. Drop every render/poll test and the
`@utils/combos` mock. Stub support (`navigator.mediaDevices.getDisplayMedia`, `window.RestrictionTarget`) in a
`beforeEach` of a new `describe('VideoDialog recording')`, and `window.open` with `vi.fn`:

- `popupFeatures sizes the popup to the shape`: `popupFeatures('landscape', 1040)` → `'popup,width=1280,height=768'`;
  `popupFeatures('portrait', 1040)` → `'popup,width=513,height=960'`; `popupFeatures('portrait', 1440)` →
  `'popup,width=720,height=1328'`.
- `Record opens the render page in the combo-video popup`: choose 9:16 and 2x, click `video.record` →
  `window.open('/simulator/c/c1/render?shape=portrait&speed=2', 'combo-video', popupFeatures('portrait', screen.availHeight))`,
  then the text `video.opened`.
- `a blocked popup asks to allow pop-ups`: `window.open` returns `null` → `video.popupBlocked`.
- `a browser without Element Capture gets the message instead of the button`: no `RestrictionTarget` →
  `video.unsupported`, no `video.record` button.

In `combo-player.test.tsx:189` replace `expect(button('video.generate')).toBeTruthy()` with
`expect(screen.getByText('video.unsupported')).toBeTruthy()` (happy-dom has no capture). In `utils/combos.test.ts`
delete the `startRender`, `getRender` and `renderFileUrl` tests.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" app/simulator/video-dialog.test.tsx app/simulator/combo-player.test.tsx`
Expected: FAIL (`video.record` not found, `popupFeatures` not exported).

- [ ] **Step 3: Implement**

`Body` keeps shape, speed and length; phases `idle | opened | blocked`; choosing another shape or speed goes back to
`idle`. The Record handler calls `window.open` synchronously. Remove `startRender`, `getRender`, `renderFileUrl`,
`RenderInfo` and `RenderShape` from `utils/combos.ts` (the dialog takes `Shape` from `timing.ts`). `ads-mode.ts`
comment: the render page is the recording popup. Strings from the table, in both files.

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" app/simulator utils components/omega/ads`,
`npx tsc --noEmit`, `npx eslint app/simulator utils components/omega/ads`, and
`git grep -nE "startRender|getRender|renderFileUrl|RenderInfo|__render|video\.(generate|queued|running|downloadWebp)"`
(expected: no output). Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/simulator utils/combos.ts utils/combos.test.ts components/omega/ads/ads-mode.ts messages/en.json messages/pt.json
git commit -m "feat(simulator): video dialog opens the recording popup; render API client removed"
```

### Task 4: Revert the renderer in `omega-server-v3`

**Files:**
- Everything `af54922` touched (reverted)
- Modify: `src/db/schema.ts` (after `combos_owner_idx`, line ~855)

**Interfaces:** none with the front tasks; the front stops calling the render routes in Task 3.

- [ ] **Step 1: Worktree from `origin/main`**

```bash
cd C:/Users/marti/Documents/omega-server-v3
git fetch origin
git worktree add .worktrees/remove-combo-renderer -b chore/remove-combo-renderer origin/main
cd .worktrees/remove-combo-renderer
git revert -m 1 --no-commit af54922
```

Expected: one conflict, `docker-compose.yml`.

- [ ] **Step 2: Resolve the conflict**

Keep neither `PGHOST`/`PGPORT` (removed by `7b6c8e7`) nor `RENDERS_DIR`, no `renders` mounts, no `renderer` service, no
`renders` volume. Check: `git diff 'af54922^1' -- docker-compose.yml` shows only the three lines `7b6c8e7` removed.

- [ ] **Step 3: Drop the table**

In `src/db/schema.ts`, after the `combos_owner_idx` line:

```sql
-- O video dos combos agora e gravado no navegador: a fila do renderer saiu.
DROP TABLE IF EXISTS combo_renders;
```

- [ ] **Step 4: Check**

Run: `pnpm install --frozen-lockfile --prefer-offline`, `npx tsc --noEmit`, `npx tsx src/modules/combos/combos.test.ts`,
and `git grep -nE "combo_renders|RENDERS_DIR|playwright|src/renderer|omega-renderer|API_URL"`.
Expected: exit 0, the combos test passes, and the grep prints only the `DROP TABLE` line.
`git diff --stat 'af54922^1' -- . ':!src/modules/combos/combos.test.ts' ':!src/modules/combos/combos.validation.ts'`
lists only `docker-compose.yml` and `src/db/schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "revert: combo video renderer, now recorded in the browser" -m "Reverts merge af54922 and drops combo_renders."
```

### Task 5: Clean up, check by hand, hand over the deploy

**Files:**
- Delete: `C:/Users/marti/Documents/tournament-next/app/simulator/c/[id]/render/record/` (untracked spike, main checkout)

- [ ] **Step 1: Delete the spike**

Confirm with `git -C C:/Users/marti/Documents/tournament-next status --short "app/simulator/c/[id]/render/record"`
that it shows `??` (untracked), then remove the folder.

- [ ] **Step 2: Full front checks in the worktree**

Run: `npx tsc --noEmit`, `npx eslint app components utils`, `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**"`.
Expected: exit 0 and every suite passing.

- [ ] **Step 3: Manual check (the user, in Chrome and Edge on a computer)**

Start the worktree's dev server on port 5174 (`.claude/launch.json` with `pnpm next dev -p 5174`), then:
- `/simulator/c/<id>` → Download video → 16:9 at 1x and 9:16 at 3x → Record in the popup → "This tab" → file plays.
- Switch tabs mid-recording, and minimize the popup mid-recording: the video has no frozen stretch.
- Firefox and a phone: the dialog shows `video.unsupported`.
- Post the MP4 to Discord and to X.

- [ ] **Step 4: Deploy, only with the user's go-ahead for each push**

1. Front: merge `feat/combo-video-client` into `main`, push to GitLab (it builds and deploys).
2. Server: merge `chore/remove-combo-renderer`, `pnpm deploy` (pushes and builds `victorgodoka/omega-web-server:latest`),
   re-pull in Portainer. Check `\dt combo_renders` in production Postgres: no relation.
3. By hand on the host: remove the `renderer` service from the Portainer stack, the `renders` volume, the
   `victorgodoka/omega-renderer` image, and `API_URL` from `.env.prod`.
