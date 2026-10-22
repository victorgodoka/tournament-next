import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers'
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
import { AuthProvider, ModalProvider } from '../contexts'
import { MessengerDock, MessengerProvider } from '@omega/messenger'
import { Ads } from '@omega/ads/ads'

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
  themeColor: '#080a14',
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
      </head>
      <body className="relative" suppressHydrationWarning>
        <NextIntlClientProvider>
          <AuthProvider hasSession={jar.has(SESSION_COOKIE)}>
            <ModalProvider>
              <MessengerProvider>
                {children}
                <MessengerDock />
                <Ads />
              </MessengerProvider>
            </ModalProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
