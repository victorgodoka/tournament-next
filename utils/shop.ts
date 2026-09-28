/**
 * Shop endpoints on omega-server-v3 (see its SHOP_API.md).
 * The catalog is public; the wallet and every purchase need the session cookie, so they run in
 * the browser with `credentials: 'include'` (the browser adds the `Origin` the API checks).
 */
import { API_URL } from '@utils/auth'
import type { ShopCatalog, ShopHistory, ShopItem, ShopPurchase, ShopWallet } from '@utils/types'

export class ShopApiError extends Error {
  status: number
  /** `INSUFFICIENT_FUNDS`, `ALREADY_OWNED`, `NOT_FOUND`, ... Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Shop API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

export const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ShopApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/**
 * The storefront: only what can be bought right now — category `SHOP`, and inside its window if
 * the item is limited. Read `types` / `categories` for the labels instead of hardcoding them.
 */
export const getCatalog = async (signal?: AbortSignal): Promise<ShopCatalog> => {
  const res = await fetch(`${API_URL}/shop`, { next: { revalidate: 60 }, signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ShopApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/** Balance and inventory of the signed-in duelist. `401` means signed out, and throws. */
export const getWallet = (signal?: AbortSignal) => request<ShopWallet>('/shop/me', { signal })

/**
 * No body. `201` carries the item and the **new balance** — use it instead of re-fetching the
 * wallet. The charge, the inventory row and the ledger entry are one transaction, and buying
 * twice answers `409 ALREADY_OWNED` without charging, so a double click is safe.
 */
export const purchaseItem = (id: string) =>
  request<ShopPurchase>(`/shop/items/${encodeURIComponent(id)}/purchase`, { method: 'POST' })

/** Newest first, 50 per page. Stop on `nextCursor: null` or `entries: []`. */
export const getHistory = (cursor?: string | null, signal?: AbortSignal) =>
  request<ShopHistory>(`/shop/me/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal })

/** The slot is the item's type. Replaces whatever was there. */
export const equipItem = (slot: string, itemId: string) =>
  request<{ slot: string; item: ShopItem }>(`/shop/me/equipped/${encodeURIComponent(slot)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })

/** `204`, also when the slot was already empty. */
export const unequipSlot = async (slot: string) => {
  const res = await fetch(`${API_URL}/shop/me/equipped/${encodeURIComponent(slot)}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ShopApiError(res.status, body.error, body.message)
  }
}

/** Copy for the errors a duelist can actually hit. Everything else is a generic failure. */
export const PURCHASE_ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Not enough Duel Points for this one.',
  ALREADY_OWNED: 'You already own this item.',
  NOT_FOUND: 'This item is no longer on sale. Reload the shop.',
  UNAUTHENTICATED: 'Your session expired. Sign in again to buy.',
  FORBIDDEN: "This account can't buy right now.",
}

export const purchaseErrorMessage = (error: unknown) => {
  const code = error instanceof ShopApiError ? error.code : undefined
  return (code && PURCHASE_ERRORS[code]) || "The purchase didn't go through. Nothing was charged."
}
