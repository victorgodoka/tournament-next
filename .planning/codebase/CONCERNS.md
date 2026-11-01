---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# Codebase Concerns

**Analysis Date:** 2026-11-01

## Tech Debt

**Two simulators live side by side:**
- Issue: `app/simulator/` is the public tool and `app/simulator/new/` is a noindex preview. They share 13 filenames, including `board.tsx`, `simulator.client.tsx`, `toolbar.tsx` and `use-drag.ts`. Their client test files carry near-identical suites of 300-400 lines.
- Files: `app/simulator/`, `app/simulator/new/`
- Impact: Every behaviour change lands twice or the two drift. Saved combos must replay in both.
- Fix approach: Decide the cutover, move `new/` into place, delete the old files. Pure logic is already shared in `utils/simulator/`.

**Statistics rebuild is planned but not started in this repo:**
- Issue: `/statistics`, deck and card pages, profile statistics, infographics and the wiki tier list are due to move to new API routes.
- Files: `utils/statistics.ts`, `app/statistics/`, `app/profile/statistics/`, `app/statistics/infographic/[section]/route.tsx`, `scripts/wiki-tier-list.ts`, `docs/superpowers/plans/2026-11-01-ranked-analytics-rebuild-front.md`
- Impact: Work on these files now may be thrown away. The plan depends on server work being deployed first.
- Fix approach: Follow the plan. `docs/analytics-statistical-review-2026-11-01.md` holds the statistical findings behind it.

**Very large components:**
- Issue: `messenger-ui.tsx` is 1,199 lines. Single components run long: `DocEditor` 687 lines, simulator `Loaded` 626, `DeckEditor` 593, `SeoTab` 478.
- Files: `components/omega/messenger/messenger-ui.tsx`, `app/wiki/editor/DocEditor.tsx`, `app/simulator/new/simulator.client.tsx`, `app/deck-builder/deck-editor.client.tsx`, `app/wiki/editor/SeoTab.tsx`
- Impact: Hard to review, and a broad re-render surface.
- Fix approach: Extract when touching a section. Follow the deck builder's split into reducer, hooks and pure `utils/`.

**API client boilerplate repeats per module:**
- Issue: 9 near-identical API error classes and a private `get` or `request` helper in each module.
- Files: `utils/analytics.ts`, `utils/articles.ts`, `utils/combos.ts`, `utils/decks.ts`, `utils/messenger.ts`, `utils/panel.ts`, `utils/profile.ts`, `utils/ranked.ts`, `utils/tournaments.ts`
- Impact: A cross-cutting change has to be made nine times. Each module also differs slightly in caching.
- Fix approach: Low priority. A shared `ApiError` base would remove most of it; `instanceof` checks must keep working.

**API types are hand-written:**
- Issue: `utils/types.ts` (844 lines) and module-local types mirror a contract that lives in omega-server-v3. Nothing generates or checks them.
- Files: `utils/types.ts`, `utils/panel.ts`, `utils/explorer.ts`
- Impact: An API change appears as a runtime failure, not a compile error.
- Fix approach: Share or generate types from the API, or add contract checks.

**Banlist data is maintained by hand:**
- Issue: `utils/banlist-data.ts` holds every list as packed strings, and a new card needs its name and ID added in matching positions. Client components import it through `utils/banlist.ts`.
- Files: `utils/banlist-data.ts`, `utils/banlist.ts`, `app/banlist-timeline/timeline.tsx`, `app/banlist-timeline/card-history.tsx`
- Impact: Error-prone updates, and about 27 KB of source data reaches the client on those pages.
- Fix approach: Keep the data server-side and pass only what the page needs.

**Leftover deployment and setup material:**
- Issue: `package.json` scripts `docker:build`, `docker:deploy` and `deploy` target a retired Docker Hub image and a retired domain. `.gitlab-ci.yml` still lists a `deploy` stage with no job. `.env.example` lists `DISCORD_*` keys no code reads. `README.md` is the create-next-app default and names port 3000.
- Files: `package.json`, `.gitlab-ci.yml`, `.env.example`, `README.md`, `Dockerfile`
- Impact: Misleads anyone setting up or shipping the project. `NEXT_PUBLIC_DISCORD_URL` is still passed as a build arg with no reader.
- Fix approach: Delete the scripts and unused keys, drop the stage, replace the README.

**Stale comments about the session cookie:**
- Issue: `require-auth.tsx` and `app/admin/layout.tsx` say the cookie is scoped to the API host and never reaches this server. `app/layout.tsx` reads that cookie to decide whether to call `/auth/me`.
- Files: `components/ui/require-auth.tsx`, `app/admin/layout.tsx`, `app/layout.tsx`, `utils/auth.ts`
- Impact: Readers get the wrong model of auth.
- Fix approach: Correct the comments.

**Build and runtime use different Node versions:**
- Issue: Build stages use Node 22 and the runner uses Node 24. It is deliberate, see the `ponytail:` comment in the `Dockerfile`.
- Files: `Dockerfile`
- Impact: Code is built on a version it does not run on.
- Fix approach: Move the build stages to 24 when the CI runner can finish a cold install.

## Known Bugs

**Tournament rounds disagree with standings:**
- Symptoms: Round pills, the rounds tab, the cross table and stats contradict the standings on the same page. On #1269 a 2-0 winner reads as a loser in round 1.
- Files: `app/tournament/sections/Rounds.tsx`, `app/tournament/sections/Standings.tsx`, `app/tournament/sections/Stats.tsx`
- Trigger: `GET /tournaments/{id}`, whose match `outcome` and `standings` disagree. Seen on #1243 and #1269.
- Workaround: None in the front. The fix belongs in omega-server-v3. Do not invert `outcome` here.

**ESLint fails on `main`:**
- Symptoms: `pnpm eslint` exits 1 with one error, "This value cannot be modified", on the `document.title` assignment inside an effect.
- Files: `app/banlist-timeline/timeline.tsx:125`
- Trigger: Any lint run. `brag-output/` adds 5 warnings, because `eslint.config.mjs` does not ignore it.
- Workaround: None needed at runtime. Fix the assignment or add a local, justified disable, then ignore `brag-output/`.

**Two tests fail under full-suite load:**
- Symptoms: On 2026-11-01 a full `vitest run` had 2 failures out of 1,069. `utils/remark.test.tsx` ("colours a fence in a known language and keeps its text") hit the 5 s timeout. `app/calculator/calculator.client.test.tsx` ("Use in hands starts a hand with the rule...") got an empty list.
- Files: `utils/remark.test.tsx`, `app/calculator/calculator.client.test.tsx`
- Trigger: Parallel load. Both files pass when run alone (41 of 41).
- Workaround: Re-run those files alone before treating a failure as real. Raise the first test's timeout and make the second wait for its result.

## Security Considerations

**Dev dependencies have advisories:**
- Risk: `pnpm audit` on 2026-11-01 reports 31 advisories in dev tooling, 2 of them critical in `tinypool` through `vitest` 3. `pnpm audit --prod` reports none.
- Files: `package.json`, `pnpm-lock.yaml`
- Current mitigation: These packages never reach the runtime image, which copies only the standalone output. They do run on developer machines and in the Docker build stage.
- Recommendations: Upgrade `vitest` and `happy-dom` in their own change. Keep `pnpm audit --prod` at zero; nothing in CI checks it.

**No security headers set by the app:**
- Risk: No CSP, HSTS or `X-Frame-Options` in `next.config.ts` or `proxy.ts`. Markdown HTML and third-party ad and tag scripts run with no CSP behind them.
- Files: `next.config.ts`, `proxy.ts`
- Current mitigation: `rehype-sanitize`. Headers may be set at the edge, which this repo does not show.
- Recommendations: Confirm what the edge sends. Add at least HSTS and frame protection. A CSP needs testing against GTM and Nitro.

**IP trust in the bot guard:**
- Risk: `proxy.ts` trusts `cf-connecting-ip`, then falls back to `x-forwarded-for`. A request reaching the container directly can choose its own IP and dodge the limit.
- Files: `proxy.ts`
- Current mitigation: The file documents that the container must only be reachable through Cloudflare.
- Recommendations: Keep the container off public ports. Re-check after any hosting change.

**Rendered user HTML:**
- Risk: Bios and wiki Markdown reach the DOM through `dangerouslySetInnerHTML`. `customSanitizeSchema` allows `className` on every element, so a user can apply any site CSS class in a bio.
- Files: `utils/remark.ts`, `app/profile/Profile.page.tsx`, `components/omega/profile/profile-bio.tsx`
- Current mitigation: `rehype-sanitize`; `dataColor` and `dataFrame` are restricted by regex. Script execution is blocked; styling is not.
- Recommendations: Strip `className` before `rehype-class-names` runs, so only the pipeline's classes survive.

## Performance Bottlenecks

**Infographic renders:**
- Problem: A render takes about 33 s in production and is heavy on memory. Two at once have pushed the container past its limit.
- Files: `components/omega/infographic/infographic.tsx`, `app/statistics/infographic/[section]/route.tsx`, `app/profile/[id]/statistics/infographic/[section]/route.tsx`, `utils/one-at-a-time.ts`
- Cause: Satori plus sharp in the same process that serves pages.
- Improvement path: Serve from a CDN cache where possible, or move rendering out of the page server.

**Profile SSR:**
- Problem: Each profile view costs about 8 Postgres queries on the API, and profiles link to each other, which is an endless path for crawlers.
- Files: `app/profile/[id]/page.tsx`, `utils/profile.ts`, `proxy.ts`
- Cause: The read is personal, so it is uncached (`cache: 'no-store'`).
- Improvement path: A cached public variant for signed-out visitors.

**Image optimiser on the page server:**
- Problem: Each new `url` + `w` + `q` is a sharp job, and the disk cache dies with each deploy.
- Files: `next.config.ts`, `utils/image-loader.ts`, `app/card-image/[kind]/[file]/route.ts`
- Cause: `/_next/image` runs in the Node process.
- Improvement path: Use `cardLoader` with Cloudinary fetch for card art. Keep the size matrix small.

**Decklists in tournament HTML:**
- Problem: Every decklist ships in the page, about 7 KB gzipped each.
- Files: `app/tournament/sections/Standings.tsx`
- Cause: Deliberate, see the `ponytail:` comment.
- Improvement path: Load decks on demand.

## Fragile Areas

**`fetch` wrapper in `instrumentation.ts`:**
- Files: `instrumentation.ts`
- Why fragile: It relies on being installed before Next patches `fetch`, and on Next's behaviour for background revalidation.
- Safe modification: After any Next upgrade, check it on a production image. Point `API_INTERNAL_URL` at a socket that never answers, and confirm `API_TIMEOUT` logs after 8 s.
- Test coverage: None.

**Lockfile changes in CI:**
- Files: `Dockerfile`, `.gitlab-ci.yml`, `pnpm-lock.yaml`
- Why fragile: A lockfile change busts the cached `pnpm install` layer, and the CI runner has failed to finish cold downloads (see the `ponytail:` comment in the `Dockerfile`). The build can fail with the old image still live, so a dependency fix may never ship.
- Safe modification: Watch the pipeline after each lockfile change, and confirm the new image reached production.
- Test coverage: Not applicable.

**Sign-in state depends on cookie visibility:**
- Files: `app/layout.tsx`, `contexts/auth/auth.context.tsx`, `utils/auth.ts`
- Why fragile: `AuthProvider` only calls `/auth/me` when the front's server sees `omega_session`. That needs the API's `COOKIE_DOMAIN` to cover the front's domain. A domain change or a mismatched environment makes signed-in users look signed out.
- Safe modification: Check the API's `COOKIE_DOMAIN` and `FRONTEND_URL` together with any domain change.
- Test coverage: None for `utils/auth.ts`.

**`ClientMessages` namespaces:**
- Files: `i18n/client-messages.tsx`, every `app/<route>/layout.tsx`
- Why fragile: A nested provider replaces messages instead of merging, and a missing namespace only shows at runtime. Tests mock `next-intl`, so they cannot catch it.
- Safe modification: When a client component uses a new namespace, add it to each layout that renders that component.
- Test coverage: None.

**Saved formats:**
- Files: `utils/combo/share.ts`, `utils/simulator/combo.ts`, `utils/simulator/session.ts`, `utils/deck/codecs/`, `utils/wiki-doc.ts`
- Why fragile: Shared URLs, saved combos and stored wiki documents outlive the code that wrote them.
- Safe modification: Stay backward compatible, and add a test with an old payload.
- Test coverage: Good.

**Ads layout:**
- Files: `components/omega/ads/`, `utils/nitro-ads.ts`, `components/omega/ads/ads-mode.ts`
- Why fragile: Page widths, rails and path patterns interact with a third-party script. Reserved boxes render before auth answers, to avoid layout shift.
- Safe modification: Test on a real wiki slug, because `/wiki/example` has no ads. Check the regexes in `ads-mode.ts` still end at a segment.
- Test coverage: Good for logic, none for real rendering.

**`proxy.ts` matcher:**
- Files: `proxy.ts`
- Why fragile: Next reads `config` statically at build, so it must stay a literal. `/wiki/card/*` deliberately gets the agent block only, so search engines don't receive 429s.
- Safe modification: Keep both `missing` prefetch rules when adding a path.
- Test coverage: `proxy.test.ts`.

## Scaling Limits

**One container:**
- Current capacity: One Node process with a 768 MB heap.
- Limit: `hits` in `proxy.ts` and the queue in `utils/one-at-a-time.ts` are per process, so replicas would each enforce their own limit.
- Scaling path: A shared store for the limiter and a separate renderer for infographics.

**Infographic queue:**
- Current capacity: One render running, up to 3 in line (`MAX_IN_LINE`).
- Limit: Further requests get the `busy` answer. Cloudflare gives up at 100 s.
- Scaling path: As above.

**Wiki index:**
- Current capacity: 100 articles (`app/wiki/page.tsx`).
- Limit: Counts and Most read undercount past that. Topics are a hand-kept slug list (`utils/wiki-topics.ts`), so a new article has no topic until it is added.
- Scaling path: Tags and aggregates from the API.

## Dependencies at Risk

**`vitest` 3 and `happy-dom` 20:**
- Risk: Dev-only advisories, see Security Considerations. `vitest` is two majors behind.
- Impact: Test tooling on developer machines. Not shipped.
- Migration plan: A major upgrade in its own change, with the 1,069 tests as the check.

**`pdf-lib` 1.17.1:**
- Risk: Last published on npm in 2022.
- Impact: Only the Konami decklist export in `app/deck-builder/deck-io.ts`.
- Migration plan: None needed while it works.

**CI image `docker:20.10.6-dind`:**
- Risk: Old image pinned in `.gitlab-ci.yml`.
- Impact: Build pipeline only.
- Migration plan: Update alongside the runner work noted in `Dockerfile`.

**`@types/node` ^20:**
- Risk: Behind the Node 24 runtime.
- Impact: Newer APIs lack types.
- Migration plan: Bump with the Node move.

## Missing Critical Features

**No quality gate before production:**
- Problem: `.gitlab-ci.yml` only builds and pushes. A push to `main` reaches production without tests, lint or `tsc`, though `next build` still catches type errors.
- Blocks: Safe merges from parallel sessions on `main`.

**No error tracking:**
- Problem: Failures live only in container logs.
- Blocks: Noticing client-side errors, which never reach `utils/log.ts`.

**Few error boundaries:**
- Problem: Only `app/wiki/error.tsx` and `app/global-error.tsx` exist. A failed read elsewhere replaces the whole document with the unstyled global page.
- Blocks: Partial failure while the API is degraded.

**No `test` script:**
- Problem: `package.json` has none, and no coverage provider is installed.
- Blocks: Adding a CI test job until one exists.

## Test Coverage Gaps

**Core read paths:**
- What's not tested: `utils/tournaments.ts`, `utils/ranked.ts`, `utils/articles.ts`, `utils/auth.ts`, `utils/panel.ts` (574 lines)
- Files: as listed
- Risk: Wrong URLs or error mapping reach production unseen
- Priority: High

**Statistics UI:**
- What's not tested: `app/statistics/` has 0 tests across 24 files, including the infographic route. `utils/statistics.test.ts` covers the client only.
- Files: `app/statistics/`
- Risk: The most traffic-sensitive content page has no UI checks. Add tests as the rebuild lands, not before.
- Priority: Medium

**Tournament pages:**
- What's not tested: `app/tournament/` 0 of 12, `app/tournaments/` 0 of 6, `components/omega/tournament/` 0 of 7
- Files: as listed
- Risk: Regressions in live and finished tournament views
- Priority: Medium

**Admin panel:**
- What's not tested: `app/admin/` has 1 test across 22 files
- Files: `app/admin/`
- Risk: Staff workflows break quietly. The API still protects data.
- Priority: Low

**Messenger:**
- What's not tested: `components/omega/messenger/` has 0 tests, including `use-messenger.ts` and its SSE handling. Only `utils/messenger.ts` is covered.
- Files: `components/omega/messenger/use-messenger.ts`
- Risk: Reconnects and missed events go unnoticed. It wraps every page.
- Priority: Medium

**Server infrastructure:**
- What's not tested: `instrumentation.ts`, `app/card-image/[kind]/[file]/route.ts`, `app/wiki/sitemap.xml/route.ts`, `app/llms.txt/route.ts`
- Files: as listed
- Risk: Timeouts and image proxying fail only in production
- Priority: Medium

**Design system:**
- What's not tested: `components/ui/` has 1 test across 64 files
- Files: `components/ui/`
- Risk: Low, since feature tests exercise most of it
- Priority: Low

**End to end:**
- What's not tested: No real browser flow is automated.
- Files: Not applicable
- Risk: Hydration, ads and auth redirects are only checked by hand
- Priority: Low

---

*Concerns audit: 2026-11-01*
