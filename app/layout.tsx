import type { Metadata, Viewport } from 'next'
import { fontVariables } from './fonts'
import { Providers } from './providers'
import { siteJsonLd } from '@lib/json-ld'
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@lib/site-config'
import '@assets/design.system.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080808',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
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
        <link rel="preconnect" href="https://cdn.discordapp.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
      </head>
      <body className="app-shell" suppressHydrationWarning>
        <aside id="nitro-ads-slot"></aside>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
