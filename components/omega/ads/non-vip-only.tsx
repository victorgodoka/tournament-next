'use client'

import { usePromoVisible } from './ads-mode'

/** Everyone but a VIP, once /auth/me has answered. Children may be server components. */
export const NonVipOnly = ({ children }: { children: React.ReactNode }) => (usePromoVisible() ? children : null)
