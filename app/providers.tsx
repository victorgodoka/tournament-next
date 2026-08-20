'use client'

import { Suspense, type ReactNode } from 'react'
import { GtmPageView } from '../components/gtm/gtm-page-view.component'
import { AuthProvider, CardsSearchProvider } from '@contexts'
import AuthSessionGuard from '@contexts/Auth/auth.session-guard'
import ErrorBanner from '../components/errorbanner/errorbanner.component'
import dynamic from 'next/dynamic'
import BackdropComponent from '@components/backdrop/backdrop.component'

const AdsShell = dynamic(() => import('../components/ads/ads-shell.component'), {
  ssr: false
})

function AuthSessionGuardBoundary() {
  return (
    <Suspense fallback={null}>
      <AuthSessionGuard />
    </Suspense>
  )
}

type ProvidersProps = {
  children: ReactNode
  /** Server-rendered shell slots — passed from the (server) root layout so the
   * mostly-static navbar/footer stay out of the client module graph. */
  navbar: ReactNode
  footer: ReactNode
}

export function Providers({ children, navbar, footer }: ProvidersProps) {
  return (
    <AuthProvider>
      <CardsSearchProvider>
        <Suspense fallback={null}>
          <GtmPageView />
        </Suspense>
        <AuthSessionGuardBoundary />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBanner />
        {navbar}
        <main className='main' id="main-content">
          <BackdropComponent />
          {children}
        </main>
        <AdsShell />
        {footer}
      </CardsSearchProvider>
    </AuthProvider>
  )
}
