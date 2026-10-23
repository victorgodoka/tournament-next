# YGO Omega Hub: tracking plan

- Tools: GTM `GTM-55HLGPXN` → GA4 `G-WMSXCWC8MM`. Ads: NitroPay (site 2429) and its CMP.
- Code: `utils/gtm.ts` (`track`, consent), `components/omega/tracking/tracking.tsx`, GTM loader in `app/layout.tsx`.
- Container import: [`gtm-container.json`](./gtm-container.json).
- Last updated: 2026-10-23.

## What this answers

The site earns from Nitro ads and VIP donations, and grows through game downloads and Discord sign-ins.

| Decision | Question | Data |
| --- | --- | --- |
| Where to place or cut ads | Which sections and formats earn the most per visit? | `ad_impression` value by `content_group`, `ad_format` |
| Whether an ad hurts engagement | Do ad-heavy pages lose readers? | engagement rate by `ads_mode` |
| Adblock pitch | How much traffic blocks ads, and where? | `ad_blocked` / `page_view` by section |
| VIP push | Does the VIP pitch convert? | `vip_promo_click` → `donate_click` funnel |
| Acquisition spend | Which channels bring players, not just visits? | `game_download`, `sign_up` by source/medium |
| Content focus | Which tools keep players coming back? | `deck_save`, `tournament_register`, returning users by `user_tier` |

## Events

Sent by the app (dataLayer). GTM forwards them unchanged.

| Event | Trigger | Parameters |
| --- | --- | --- |
| `page_view` | Each route, once `/auth/me` has answered and the new `<title>` is in | `page_location`, `page_title`, `page_referrer`, `content_group` (first path segment, `home`), `ads_mode` (`none`/`rail`/`all`), `user_id`; user props `login_status`, `user_tier` (`guest`/`free`/`vip`) |
| `ad_impression` | Nitro's `nitroAds.rendered` (every fill, refreshes included) | `ad_platform`=`nitropay`, `ad_source` (bidder), `ad_format` (`rail`, `anchor`, `floating`, `interstitial`, `video-nc`…), `ad_unit_name` (slot id), `ad_size`, `ad_media_type`, `ad_refresh`, `value` (winning CPM / 1000), `currency`=`USD`, `content_group` |
| `ad_blocked` | Nitro's script failed to load | `ads_mode` |
| `login_start` | Discord sign-in clicked | `method`=`discord` |
| `login` | Back from Discord, signed in | `method` |
| `sign_up` | Same, but the account is under 10 minutes old | `method` |
| `deck_save` | Deck Builder save succeeded | `deck_new`, `deck_format`, `deck_visibility` |
| `tournament_register` / `tournament_withdraw` | Scheduled tournament registration toggled | `tournament_id` |

Sent by GTM link-click triggers (no app code):

| Event | Click URL | Parameters |
| --- | --- | --- |
| `game_download` | `…/omega-releases/releases/download/…` | `platform` (`windows`/`linux`/`mac`/`android`/`ios`), `link_url` |
| `donate_click` | `paypal.me/…` | `link_url`, `page_path` |
| `vip_promo_click` | `/download#donations` (VIP promo, "remove ads" links) | `link_text`, `page_path` |
| `join_group` | `discord.gg/…` | `group_id`=`discord`, `link_url`, `page_path` |

GA4 enhanced measurement covers the rest: scrolls, outbound clicks, site search, video engagement.

### Caveats

- `ad_impression.value` is the winning bid, gross, before Nitro's share. It's good for comparing pages and formats. Nitro's dashboard stays the source for payout.
- `ad_blocked` is a floor. Most blockers also block GTM, and those visits never reach GA4.
- VIPs get no ads, so they get no Nitro CMP either. In the EEA/UK/CH they keep the denied defaults (cookieless pings only).
- A query-string-only route change (same path) sends no `page_view`.

## Consent

- Default (in `<head>`, before GTM): granted everywhere, denied in EEA + UK + CH with `wait_for_update: 500`, `ads_data_redaction`, `url_passthrough`.
- Update: Nitro's CMP answers over TCF v2.2. `consentFromTcf` maps purpose 1 → `ad_storage` + `analytics_storage`, 1+7 → `ad_user_data`, 1+3+4 → `ad_personalization`.
- Nitro also pushes its own (global) `ad_*` defaults. The region-specific defaults outrank them.

## GA4 admin setup

1. **Data stream → Enhanced measurement → Page views → Advanced**: turn off "page changes based on browser history events". The app sends its own; leaving it on doubles every navigation.
2. **Custom definitions → Custom dimensions**:

   | Name | Scope | Parameter |
   | --- | --- | --- |
   | Ads mode | Event | `ads_mode` |
   | Ad format | Event | `ad_format` |
   | Ad unit | Event | `ad_unit_name` |
   | Ad bidder | Event | `ad_source` |
   | Ad size | Event | `ad_size` |
   | Download platform | Event | `platform` |
   | Deck format | Event | `deck_format` |
   | Login method | Event | `method` |
   | Login status | User | `login_status` |
   | User tier | User | `user_tier` |

   Content group is built in (`content_group`). Leave `tournament_id` and `link_url` unregistered: high cardinality, readable in explorations.
3. **Key events**: `game_download`, `sign_up`, `donate_click`, `tournament_register`. Leave `ad_impression` out: it's revenue, not a goal, and GA4 already counts its `value` as ad revenue.
4. **Data filters**: activate "Developer traffic". Off-prod hostnames (localhost, previews) send `debug_mode`, so they stay out of reports but show in DebugView.
5. **Data retention**: 14 months.
6. **Reporting identity**: Blended. `user_id` is the Discord id (an internal id, not PII).
7. **Nitro dashboard → (EU) Custom Consents**: add internal id `ga`, name "Google Analytics Consent" (Nitro's documented fix for GA consent warnings).
8. **Channel groups**: copy the default group and add rules for `utm_medium` = `creator`, `community`, `discord`. Add an "AI assistants" rule for referrers matching `chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com`.

## Reports to build (Explore)

- **Ad yield by section**: free form; rows `content_group`, columns `ad_format`; values event count (`ad_impression`), event value, sessions. RPM ≈ value / sessions × 1000.
- **Adblock rate**: `ad_blocked` / `page_view` by `content_group`, filtered to `ads_mode` ≠ `none`.
- **VIP funnel**: `page_view` (ads_mode ≠ none) → `vip_promo_click` → `donate_click`.
- **Player funnel**: session start → `page_view` /download → `game_download` → `login_start` → `sign_up`, broken down by first user source/medium.
- **Engagement by ad load**: engagement rate and average engagement time by `ads_mode`.

## UTM convention

Lowercase, hyphens, one spelling per source.

| Traffic | utm_source | utm_medium | utm_campaign |
| --- | --- | --- | --- |
| Discord announcements | `discord` | `community` | `{yyyy-mm}-{topic}` (e.g. `2026-10-goat-tournament`) |
| Reddit posts | `reddit` | `community` | same |
| YouTube / Twitch creators | `youtube` / `twitch` | `creator` | `{creator}` |
| Own YouTube channel | `youtube` | `social` | `{video-slug}` |
| Paid ads | `google` / `meta` / `reddit` | `cpc` | `{yyyy-mm}-{goal}` |

## Import into GTM

1. Admin → Import container → `gtm-container.json` → a **new workspace** → **Merge** → **"Overwrite conflicting tags, triggers and variables"**.
2. The Google tag is named `GA4 - Configuration`, like the live one, so the overwrite replaces it with one that sets `send_page_view: false`. A second Google tag would double every page view.
3. Old triggers the app no longer pushes (`CE - login_error`, `CE - logout`, `CE - cta_click`, `CE - outbound_click`) can be deleted.
4. Preview on `localhost` (or a preview URL). Check: `page_view` on every navigation with the right title, `ad_impression` with value, consent defaults before `gtm.js`.
5. Publish.

## Validation checklist

- [ ] One `page_view` per navigation, none on a cosmetic equip
- [ ] `page_title` is the new page's title on client-side navigation
- [ ] `ad_impression` carries `ad_format`, `ad_unit_name`, `value`
- [ ] EEA visitor (VPN): no `_ga` cookie until the CMP is accepted
- [ ] `login` after Discord sign-in, once
- [ ] `game_download` per platform tile
- [ ] DebugView shows localhost traffic; standard reports don't
