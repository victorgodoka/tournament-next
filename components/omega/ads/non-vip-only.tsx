'use client'

import { usePromoLayout } from './ads-mode'

/** Everyone but a VIP; held while /auth/me is in flight, so it doesn't shift the page. Children may be server components. */
export const NonVipOnly = ({ children }: { children: React.ReactNode }) => (usePromoLayout() ? children : null)
