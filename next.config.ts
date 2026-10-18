import { ANALYTICS_ENABLED, SHOP_ENABLED, BATTLEPASS_ENABLED } from "@utils/const";
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const DISABLED_ROUTES = [
  ...(ANALYTICS_ENABLED ? [] : [
    '/analytics/:path*',
    '/statistics/:path*',
    '/admin/analytics/:path*',
    '/profile/:id/analytics/:path*',
    '/profile/:id/explorations/:path*',
    '/profile/:id/statistics/:path*',
  ]),
  ...(SHOP_ENABLED ? [] : ['/shop/:path*', '/admin/shop/:path*']),
  ...(BATTLEPASS_ENABLED ? [] : ['/battlepass/:path*', '/admin/battlepass/:path*']),
];
const nextConfig: NextConfig = {
  redirects: async () => [
    ...DISABLED_ROUTES.map((source) => ({ source, destination: '/', permanent: false })),
    // The Deck Editor became the Deck Builder: links already shared, saved decks included, keep working.
    { source: '/deck-editor/:path*', destination: '/deck-builder/:path*', permanent: true },
  ],
  output: "standalone",
  images: {
    /**
     * Every distinct `url`+`w`+`q` is a fresh sharp decode/encode on the Node server that
     * serves the pages, so the variant matrix stays small and the hosts stay narrow: a
     * wildcard pathname lets a stranger mint unlimited optimisation jobs from one URL.
     */
    qualities: [75],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256],
    /** 31 days: a variant is worth keeping, recomputing it is the expensive part. */
    minimumCacheTTL: 2_678_400,
    localPatterns: [{ pathname: "/**" }],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      { protocol: "https", hostname: "ygopro.online", pathname: "/assets/card-arts/**" },
      { protocol: "https", hostname: "ygopro.online", pathname: "/assets/card-images/**" },
    ],
    // res.cloudinary.com is deliberately absent: `coverUrl` asks Cloudinary itself for a
    // sized f_auto image and the cover <Image>s render it `unoptimized`, so covers never
    // reach this optimiser at all.
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);