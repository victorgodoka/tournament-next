'use client'

import { useSyncExternalStore } from "react";

const subscribe = () => () => {}

/**
 * Formats an ISO date in the reader's locale and time zone. The server can't know either,
 * so it renders UTC and the browser swaps in the local value right after hydration.
 */
export const LocalTime = ({ iso, options }: { iso: string; options: Intl.DateTimeFormatOptions }) => {
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const date = new Date(iso)

  return (
    <time dateTime={iso}>
      {isBrowser ? date.toLocaleString(undefined, options) : date.toLocaleString('en-US', { ...options, timeZone: 'UTC' })}
    </time>
  )
}
