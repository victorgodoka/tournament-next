import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const DISABLED_ROUTES = [
  // The shop, the inventory and the battlepass are gone; links already shared land on the home page.
  '/shop/:path*', '/inventory/:path*', '/battlepass/:path*',
  '/admin/shop/:path*', '/admin/rewards/:path*', '/admin/battlepass/:path*',
];
const UPLOADS = process.env.NEXT_PUBLIC_UPLOADS_URL ? new URL(process.env.NEXT_PUBLIC_UPLOADS_URL) : null;
const UPLOAD_PATTERNS = UPLOADS
  ? ['profile_covers', 'wiki_assets', 'shop_items'].map((folder) => ({
      protocol: 'https' as const,
      hostname: UPLOADS.hostname,
      pathname: `${UPLOADS.pathname.replace(/\/+$/, '')}/${folder}/**`,
    }))
  : [];

const nextConfig: NextConfig = {
  redirects: async () => [
    ...DISABLED_ROUTES.map((source) => ({ source, destination: '/', permanent: false })),
    // The Deck Editor became the Deck Builder: links already shared, saved decks included, keep working.
    { source: '/deck-editor/:path*', destination: '/deck-builder/:path*', permanent: true },
    // The analytics pages became statistics: old links land on their replacement.
    { source: '/analytics/:path*', destination: '/statistics', permanent: true },
    { source: '/admin/analytics/:path*', destination: '/admin/statistics/:path*', permanent: true },
    // The panel redesign (docs/ADMIN_PANEL.md §3): Decks, Ignored setcodes and Setcode covers became Identified decks.
    { source: '/admin/cards/decks', destination: '/admin/decks', permanent: true },
    { source: '/admin/cards/ignored', destination: '/admin/decks', permanent: true },
    { source: '/admin/cards/covers', destination: '/admin/decks', permanent: true },
    { source: '/admin/cards/series/:path*', destination: '/admin/series/:path*', permanent: true },
    { source: '/admin/cards/staples', destination: '/admin/staples', permanent: true },
    { source: '/admin/tools', destination: '/admin/seasons', permanent: true },
    // #analysts and #editors never reach the server: the settings page sends them on to /admin/access.
    { source: '/admin/staff', destination: '/admin/settings', permanent: true },
    { source: '/profile/:id/analytics', destination: '/profile/:id/statistics', permanent: true },
    { source: '/profile/:id/explorations/:path*', destination: '/profile/:id/statistics', permanent: true },
    // NitroAds (site 2429) hosts the ads.txt; duelistsunite.org/ads.txt redirects there too.
    { source: '/ads.txt', destination: 'https://api.nitropay.com/v1/ads-2429.txt', permanent: true },
  ],
  output: "standalone",
  experimental: { agentUpgrade: "security" },
  images: {
    /**
     * Every distinct `url`+`w`+`q` is a fresh sharp decode/encode on the Node server that
     * serves the pages, so the variant matrix stays small and the hosts stay narrow: a
     * wildcard pathname lets a stranger mint unlimited optimisation jobs from one URL.
     */
    /** 60: card art (`CardArt`), detailed crops shown small, where 75 is bytes nobody sees. */
    qualities: [60, 75],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256],
    /** 31 days: a variant is worth keeping, recomputing it is the expensive part. */
    minimumCacheTTL: 2_678_400,
    localPatterns: [{ pathname: "/**" }],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      { protocol: "https", hostname: "ygopro.online", pathname: "/assets/card-arts/**" },
      { protocol: "https", hostname: "ygopro.online", pathname: "/assets/card-images/**" },
      // Uploads (profile covers, wiki images, shop assets): only our bucket's public folders.
      ...UPLOAD_PATTERNS,
    ],
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);