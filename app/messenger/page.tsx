import MessengerPage from '@app/messenger'
import { pageMetadata } from '@utils/metadata'

export const metadata = pageMetadata({
  title: 'Friends & rivals',
  path: '/messenger',
  noIndex: true,
})

type MessengerRouteProps = {
  /** `?with=<id>` opens that conversation (the dock's Expand), `?tab=requests` the requests list. */
  searchParams: Promise<{ with?: string; tab?: string }>
}

const MessengerRoute = async ({ searchParams }: MessengerRouteProps) => {
  const params = await searchParams
  return <MessengerPage initialId={params.with} initialTab={params.tab === 'requests' ? 'requests' : undefined} />
}

export default MessengerRoute
