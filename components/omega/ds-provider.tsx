'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { OmegaHubProvider } from '@omega-hub/ds'

/** Lets the design system's links (Button, ArtCard, MediaCard…) route through Next and mark the current page. */
export const DsProvider = ({ children }: { children: React.ReactNode }) => (
  <OmegaHubProvider linkComponent={NextLink} pathname={usePathname()}>
    {children}
  </OmegaHubProvider>
)
