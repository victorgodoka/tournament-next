import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const LOCALES = ['en', 'pt'] as const
export const DEFAULT_LOCALE = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = hasLocale(LOCALES, stored) ? stored : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
