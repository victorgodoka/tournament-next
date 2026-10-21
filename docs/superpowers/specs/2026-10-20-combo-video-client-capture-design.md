# Combo simulator: replay video recorded in the viewer's browser — design

Date: 2026-10-20
Status: awaiting spec review
Repos: `tournament-next` (popup recorder, download dialog) and `omega-server-v3` (renderer removed).
Replaces: `2026-10-19-combo-video-design.md` (server renderer). Kept from it: the render page, `utils/simulator/timing.ts`,
the board's card-width override and the dialog's shape and speed choices.

## Goal

Anyone watching a combo still downloads its replay as a video. The viewer's own browser now records it with the Screen
Capture API, in a popup that shows nothing but the frame. The server renderer goes away: the Chromium + ffmpeg
container, the render queue, its routes and its table.

The spike of 2026-10-20 (a throwaway `/simulator/c/<id>/render/record` route) recorded the render page in a Chrome
popup, restricted to the frame, as MP4/H.264 at 8 Mbps. The quality held up against the server's MP4.

## Decisions

| Topic | Decision |
|---|---|
| Where it records | The viewer's browser, in a popup on the render page `/simulator/c/<id>/render` |
| Capture | `getDisplayMedia` of the popup's own tab (`preferCurrentTab`), restricted to the frame with Element Capture (`track.restrictTo(await RestrictionTarget.fromElement(frame))`) |
| Browsers | Desktop Chrome and Edge 132+, the ones with Element Capture. Everyone else (phones, Firefox, Safari) gets a message in the dialog instead of the button |
| Format | MP4 (H.264) from `MediaRecorder`; WebM (VP9) only where MP4 recording is missing. No WebP |
| Quality | 30 fps, 8 Mbps. The resolution is the frame's size on screen: CSS pixels × `devicePixelRatio` |
| Shape and speed | As before: 16:9 or 9:16, 0.5x, 1x, 2x or 3x, and the same timeline (`renderTimeline`) |
| Background | Chrome keeps a captured tab painting, so switching tabs or navigating the main window does not stop it. If the popup's page does go hidden (a minimized window on a system that stops painting it), the recording pauses and resumes with the replay clock |
| Server | Revert the `claude/combo-video` merge (`af54922`) in `omega-server-v3` and drop `combo_renders` |
| Out of scope | Recording on phones, audio, GIF or WebP, uploading the video anywhere |

## Front (`tournament-next`)

### Download dialog (`video-dialog.tsx`)

The entry points stay: "Download video" in the combo player for everyone, and in the simulator after the line is saved
(the popup loads the combo by id, so the save-first flow stays as it is).

- Shape, speed and the estimated length stay. The length is now also how long the recording takes.
- A browser without `navigator.mediaDevices?.getDisplayMedia` or `RestrictionTarget` gets no button, only an Alert:
  "Recording a video works in Chrome or Edge on a computer."
- "Record" calls `window.open` inside the click handler, so no popup blocker stops it:
  - URL `/simulator/c/<id>/render?shape=<shape>&speed=<speed>`, window name `combo-video` (a second click reuses the popup).
  - Features `popup,width=<w>,height=<h>`. 16:9: 1280 × (720 + 48). 9:16: height `min(1280 + 48, screen.availHeight − 80)`,
    width `(height − 48) × 9 / 16`. The 48 px leave room for Chrome's "sharing this tab" bar.
  - Opened: an info Alert, "The recording goes on in the window that opened". `null` back (blocked anyway): a warn
    Alert asking to allow pop-ups for the site.
- Gone: Generate, the polling, queue position and progress, the MP4 and WebP links, the queue-full and busy messages.

### Popup (the render page)

`RenderLoader` reads `?shape` (`landscape` unless `portrait`) besides `?speed`, and renders the recorder around
`ComboRender`. The recorder's states:

1. **Idle.** The combo's title, the shape and speed, a "Record" button and the hint "Choose *This tab* in the browser's
   prompt. You can switch tabs while it records; keep this window open."
2. **Starting.** On the click: `getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true,
   selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude' })`. Then 500 ms for the
   sharing bar to take its room, then the frame is sized to the shape's ratio inside what is left of the viewport, and
   `ComboRender` mounts in it. Its `ready` resolves, and the track is restricted to the frame.
3. **Recording.** `new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 }).start(1000)`, where `mimeType`
   is the first supported of `video/mp4;codecs=avc1.640028`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm`. On
   every animation frame the handle seeks to the replay clock until `durationMs`. The last frame stays 300 ms more, then
   the recorder and the tracks stop. An overlay shows "Recording 12 s of 40 s" and Cancel. Drawn over the frame
   but not inside its element, it never reaches the video.
4. **Done.** "Download MP4" (or WebM), a link to the blob's object URL named after the combo's title (letters, digits,
   spaces, `-` and `_`, at most 80 characters, `combo` when nothing is left), and "Record again".

Pause: on `visibilitychange` to hidden the recorder pauses and the clock stops; back to visible the clock resumes from
where it stopped and the recorder resumes. A tab Chrome keeps visible never triggers it.

Cancel, or closing the popup, drops the recording; nothing is saved.

### `ComboRender`

- The handle that Playwright read from `window.__render` becomes an `onReady(handle)` prop: the recorder is the only
  reader now. `RenderHandle` keeps `ready` and `seek`; the `declare global` goes.
- The frame no longer fills the viewport. The recorder gives it a fixed box in px, its own background and
  `isolation: isolate` (Element Capture keeps only an element that is its own stacking context, flat, in one fragment).
- Everything else stays: the fit, the waits on images, zone marks and fonts, and `seek`'s waits on a step change.

### API client and strings

- `utils/combos.ts` loses `startRender`, `getRender`, `renderFileUrl`, `RenderInfo` and `RenderShape`, and their tests.
  The shape type moves to `utils/simulator/timing.ts` beside the timeline.
- `Simulator.video` keeps `open`, `title`, `aspect`, `speed` and `length`, drops `generate`, `tryAgain`, `queued`,
  `running`, `ready`, `downloadMp4`, `downloadWebp`, `queueFull`, `busy` and `failed`, and gains `record`, `opened`,
  `popupBlocked` and `unsupported`.
- `Simulator.render` keeps `brand` and gains the recorder's `record`, `hint`, `recording`, `cancel`, `download`, `again`,
  `stopped`, `loadFailed` and `failed`. In en and pt.

### Elsewhere

- `components/omega/ads/ads-mode.ts`: `/render` stays ad-free (it is the popup now); its comment changes.
- The spike's route `app/simulator/c/[id]/render/record/` (never committed) is deleted.
- `2026-10-19-combo-video-design.md` is marked superseded by this spec.

## Server (`omega-server-v3`)

- On a branch from `main`: `git revert -m 1 af54922`. One conflict is expected, in `docker-compose.yml`, where
  `7b6c8e7` removed `PGHOST`/`PGPORT` beside the `RENDERS_DIR` line the merge added. Neither comes back.
- The revert removes:
  - the render routes, service, repository and validation, with their tests;
  - `src/renderer/` and `Dockerfile.renderer`;
  - the compose `renderer` service, the `renders` volume and its read-only mounts;
  - `RENDERS_DIR`, `API_URL` and the `/renders` folder in `Dockerfile` and `Dockerfile.dev`;
  - the `playwright` dependency and its lockfile entries;
  - the `renderer`, `render:smoke` and `deploy:renderer` scripts;
  - the README rows and the `.gitignore` and `.dockerignore` entries.
- `src/db/schema.ts`: in place of the reverted `CREATE TABLE`, `DROP TABLE IF EXISTS combo_renders;`, so production
  loses the table on the next boot. Its rows lived 30 minutes; nothing to keep.

## Deploy

1. **Front first.** The new dialog never calls the render routes, so the old server can run meanwhile. Push to `main`
   on GitLab.
2. **Renderer out, then the server, in one sitting.** Remove the `renderer` service from the Portainer stack first,
   then push the API image and re-pull it. The boot drops the table, and a renderer still running would fail every
   poll from then on and, once restarted, crash-loop on its boot query.
3. **By hand, on the host:**
   - remove the `victorgodoka/omega-renderer` image, and its Docker Hub repository if wanted;
   - remove `API_URL` from `.env.prod`.

## Errors

| Case | What the viewer sees |
|---|---|
| Browser without Element Capture | The dialog's message, no button |
| Popup blocked | The dialog asks to allow pop-ups |
| Prompt cancelled | The popup back at idle |
| Sharing stopped from Chrome's bar mid-recording (track `ended`) | "The recording was interrupted", Record again |
| Combo missing or damaged (`ready` rejects) | "Could not load the combo" |
| `restrictTo` or `MediaRecorder` throws | "Could not record the video", tracks stopped |
| Popup's page hidden mid-recording | The recording pauses and resumes; the video has no frozen stretch |

## Testing

- Vitest:
  - Dialog: the unsupported message. Record opens the popup with the URL, name and features for each shape
    (`window.open` mocked, `screen.availHeight` stubbed). `null` shows the pop-up Alert. The length estimate is unchanged.
  - Recorder, with `getDisplayMedia`, `RestrictionTarget` and `MediaRecorder` mocked:
    - idle → recording → a download link with the cleaned name and the right extension;
    - track `ended` → stopped;
    - `NotAllowedError` → idle;
    - `ready` rejected → load failed;
    - hidden → paused, visible → resumed.
  - `combo-render.test.tsx` moves from `window.__render` to `onReady`. `combos.test.ts` loses the render client tests.
- Server: `pnpm test` in the container passes without the render suites. A boot against local Postgres drops the table.
- Manual:
  - Chrome and Edge on a computer, both shapes at 1x and 3x;
  - switch tabs mid-recording, and minimize the popup mid-recording;
  - open the dialog in Firefox and on a phone and check the message;
  - post the MP4 to Discord and to X.

## Risks

- Real time: a slow machine drops frames. The server's frame-exact output is gone.
- 9:16 on a 1080p screen records about 540×960, since the frame cannot be taller than the screen.
- Chrome asks to share the tab on every recording; that prompt cannot be skipped.
- CSS that breaks Element Capture's rules on the frame (`transform-style: preserve-3d`, a multi-column layout) makes
  `restrictTo` throw; the recorder then says it could not record.
- `MediaRecorder` writes fragmented MP4. Whether Discord and X take it is the manual check above.

## Files

| Repo | File | Change |
|---|---|---|
| front | `app/simulator/video-dialog.tsx` + test | Support check, popup opening; queue and links gone |
| front | `app/simulator/c/[id]/render/render.loader.tsx`, `page.tsx` | `?shape`; the recorder around the frame |
| front | `app/simulator/combo-recorder.tsx` + test | New: capture, `MediaRecorder`, clock, pause, overlay, download |
| front | `app/simulator/combo-render.tsx` + test | `onReady` instead of `window.__render` |
| front | `utils/simulator/timing.ts` | Shape type |
| front | `utils/combos.ts` + test | Render client removed |
| front | `components/omega/ads/ads-mode.ts` | Comment |
| front | `messages/en.json`, `messages/pt.json` | Dialog and recorder strings |
| front | `docs/superpowers/specs/2026-10-19-combo-video-design.md` | Marked superseded |
| server | everything from `af54922` | Reverted |
| server | `src/db/schema.ts` | `DROP TABLE IF EXISTS combo_renders` |
