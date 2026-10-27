import { SITE_URL } from '@utils/config'

/** https://llmstxt.org: what the site is and where its pages are, for language models. Static at build. */
const LLMS = `# YGO Omega

> Free Yu-Gi-Oh! simulator by Duelists Unite: every card unlocked, Bo3 ranked with Elo, automatic Swiss tournaments, and TCG, OCG, GOAT and Edison formats. Runs on Windows, macOS, Linux and Android.

## Pages

- [Download](${SITE_URL}/download): the free launcher
- [Tournaments](${SITE_URL}/tournaments): automatic Swiss tournaments, open and finished
- [Calendar](${SITE_URL}/calendar): upcoming tournaments
- [Leaderboard](${SITE_URL}/leaderboard): Elo ranking
- [Deck Builder](${SITE_URL}/deck-builder): build and check decks against the TCG, OCG and Genesys lists
- [Banlist](${SITE_URL}/banlist): the current TCG Forbidden & Limited list and what changed on it
- [Banlist timeline](${SITE_URL}/banlist-timeline): every Forbidden & Limited list and each card's history
- [Wiki](${SITE_URL}/wiki): guides and articles

## Optional

- [Sitemap](${SITE_URL}/sitemap.xml)
- [Wiki sitemap](${SITE_URL}/wiki/sitemap.xml)
`

export const GET = () => new Response(LLMS, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
