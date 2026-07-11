import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import "@assets/design.system.css";

const SITE_URL = "https://duelistsunite.org/omega-web";
const SITE_TITLE = "YGO Omega | Duelists Unite";
const SITE_DESCRIPTION =
  "YGO Omega — the free Yu-Gi-Oh! simulator by Duelists Unite. Play online, build decks, join tournaments, and explore the meta.";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YGO Omega",
  alternateName: "Yu-Gi-Oh! Omega",
  url: `${SITE_URL}/`,
  description:
    "Free Yu-Gi-Oh! simulator and competitive platform by Duelists Unite.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "Duelists Unite",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "YGO Omega",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="//images.ygoprodeck.com" />
        <link rel="dns-prefetch" href="//api.duelistsunite.org" />
        <link rel="dns-prefetch" href="//discord.com" />
        <link
          rel="preconnect"
          href="https://images.ygoprodeck.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/app-shell.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
