'use client'

import { Suspense, type ReactNode } from 'react'
import { AuthProvider } from '@contexts'
import AuthSessionGuard from '@contexts/Auth/auth.session-guard'
import ErrorBanner from '../components/errorbanner/errorbanner.component'
import { NavbarComponent, FooterComponent } from '@components'

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
      <ErrorBanner />
      <NavbarComponent />
      <main className="flex flex-1 flex-col">{children}</main>
      <FooterComponent />
    </AuthProvider>
  )
}
