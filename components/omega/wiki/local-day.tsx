'use client'

import { useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'

const subscribe = () => () => {}

/** `Fri 30 Oct`, in the app's locale and the reader's time zone. Same dance as `LocalTime`: UTC on the server, local after hydration. */
export const LocalDay = ({ iso }: { iso: string }) => {
  const locale = useLocale()
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const parts = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: isBrowser ? undefined : 'UTC' }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value.replace('.', '')

  return <time dateTime={iso}>{`${part('weekday')} ${part('day')} ${part('month')}`}</time>
}
