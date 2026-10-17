'use client'

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

const subscribe = () => () => {}

/**
 * Formats an ISO date in the app's locale and the reader's time zone. The server can't know the
 * time zone, so it renders UTC and the browser swaps in the local value right after hydration.
 */
export const LocalTime = ({ iso, options }: { iso: string; options: Intl.DateTimeFormatOptions }) => {
  const locale = useLocale()
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const date = new Date(iso)

  return (
    <time dateTime={iso}>
      {isBrowser ? date.toLocaleString(locale, options) : date.toLocaleString(locale, { ...options, timeZone: 'UTC' })}
    </time>
  )
}
