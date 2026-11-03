'use client'

import { dayKey, DAY_MS, useNow } from "@omega/profile/use-now";

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

/**
 * "Last seen today, 18:14" / "Last seen 11 Sep, 18:14", in the reader's zone. The server can't
 * know it, so it renders the plain UTC date and the browser swaps in the local one.
 */
export const LastSeen = ({ iso }: { iso: string }) => {
  const now = useNow()
  const date = new Date(iso)
  const zone = now === null ? { timeZone: 'UTC' } : {}
  const time = date.toLocaleTimeString('en-GB', { ...TIME, ...zone })
  const day = dayKey(date)
  const when =
    now !== null && day === dayKey(now) ? `today, ${time}`
    : now !== null && day === dayKey(now - DAY_MS) ? `yesterday, ${time}`
    : `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...zone })}, ${time}`
  return <time dateTime={iso}>Last seen {when}</time>
}
