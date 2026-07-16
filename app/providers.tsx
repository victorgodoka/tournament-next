'use client'

import { Suspense, type ReactNode } from 'react'
import { GtmPageView } from '../components/gtm/gtm-page-view.component'
import { AuthProvider, CardsSearchProvider } from '@contexts'
import AuthSessionGuard from '@contexts/Auth/auth.session-guard'
import ErrorBanner from '../components/errorbanner/errorbanner.component'
import NavbarComponent from '../components/navbar/navbar.component'
import FooterComponent from '../components/footer/footer.component'
import dynamic from 'next/dynamic'

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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CardsSearchProvider>
        <Suspense fallback={null}>
          <AdsShell />
        </Suspense>
        <Suspense fallback={null}>
          <GtmPageView />
        </Suspense>
        <AuthSessionGuardBoundary />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBanner />
        <NavbarComponent />
        <main id="main-content" className="app-shell__main">
          {children}
        </main>
        <FooterComponent />
      </CardsSearchProvider>
    </AuthProvider>
  )
}
