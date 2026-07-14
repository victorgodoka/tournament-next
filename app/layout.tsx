import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { GtmNoScript, GtmScripts } from '../components/gtm/gtm-scripts.component'
import { fontVariables } from './fonts'
import { Providers } from './providers'
import { siteJsonLd } from '@lib/json-ld'
import { NITROPAY_SCRIPT_URL } from '@lib/nitro-ads.const'
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@lib/site-config'
import '@assets/design.system.css'
import dynamic from 'next/dynamic'

const AdsShell = dynamic(() => import('../components/ads/ads-shell.component'))

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
        <link rel="dns-prefetch" href="//s.nitropay.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
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
        <Script
          id="nitro-ads-stub"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              'window.nitroAds=window.nitroAds||{createAd:function(){return new Promise(e=>{window.nitroAds.queue.push(["createAd",arguments,e])})},addUserToken:function(){window.nitroAds.queue.push(["addUserToken",arguments])},queue:[]};',
          }}
        />
        <Script
          id="nitro-ads-loader"
          src={NITROPAY_SCRIPT_URL}
          strategy="afterInteractive"
          data-cfasync="false"
          data-log-level="warn"
          data-spa="auto"
        />
        <GtmScripts />
      </head>
      <body className="app-shell" suppressHydrationWarning>
        <GtmNoScript />
        <AdsShell />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
