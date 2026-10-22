import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

/** Read by client components on every page: ad banners and the footer's VIP promo. */
const SHARED = ['Ads', 'Download']

/**
 * Without `messages`, next-intl serializes the whole catalog into every page. Each route layout
 * names the namespaces its client components read; server components read the full catalog anyway.
 * A nested provider replaces the outer one's messages instead of merging, hence SHARED in every pick.
 */
export const ClientMessages = async ({
  namespaces = [],
  children,
}: {
  namespaces?: string[]
  children: React.ReactNode
}) => {
  const messages = await getMessages()
  const picked = Object.fromEntries([...SHARED, ...namespaces].map((ns) => [ns, messages[ns]]))
  return <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>
}
