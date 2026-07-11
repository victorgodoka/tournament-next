'use client'

import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'
import { AuthProvider } from '@contexts'
import AuthSessionGuard from '@contexts/Auth/auth.session-guard'
import ErrorBanner from '../components/errorbanner/errorbanner.component'
import NavbarComponent from '../components/navbar/navbar.component'
import FooterComponent from '../components/footer/footer.component'

const AdsShell = dynamic(() => import('../components/ads/ads-shell.component'), {
  ssr: false,
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
      <AdsShell />
    </AuthProvider>
  )
}
