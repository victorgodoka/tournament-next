import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers'
import { ClientMessages } from '@i18n/client-messages'
import type { Metadata, Viewport } from 'next'
import { SESSION_COOKIE } from '@utils/auth'
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  JSON_LB_CONTEXT
} from '@utils/config'
import { FONTS_VARIABLES } from '@utils/fonts'
import './styles.css'
import { AuthProvider } from '@contexts/auth/auth.context'
import { MessengerDock, MessengerProvider } from '@omega/messenger'
import { DsProvider } from '@omega/ds-provider'
import { Ads } from '@omega/ads/ads'
import { Tracking } from '@omega/tracking/tracking'
import Script from 'next/script'
import { GTM_BOOTSTRAP, GTM_SCRIPT_URL } from '@utils/gtm'

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
  themeColor: '#090b12',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, jar] = await Promise.all([getLocale(), cookies()])
  return (
    <html lang={locale} className={FONTS_VARIABLES}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LB_CONTEXT) }}
        />
        {/* Consent defaults first: they must be on the dataLayer before gtm.js runs a tag. */}
        <script dangerouslySetInnerHTML={{ __html: GTM_BOOTSTRAP }} />
        <Script id="gtm" src={GTM_SCRIPT_URL} strategy="afterInteractive" />
      </head>
      <body className="relative" suppressHydrationWarning>
        <ClientMessages>
          <AuthProvider hasSession={jar.has(SESSION_COOKIE)}>
            <MessengerProvider>
              {/* Everything under it, the dock included, so the library's links route through Next. */}
              <DsProvider>
                {children}
                <MessengerDock />
                <Ads />
                <Tracking />
              </DsProvider>
            </MessengerProvider>
          </AuthProvider>
        </ClientMessages>
      </body>
    </html>
  )
}
