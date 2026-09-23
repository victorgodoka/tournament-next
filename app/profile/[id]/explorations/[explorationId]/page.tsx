import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import { getExplorations, sharePath } from '@utils/explorations'

type ExplorationRouteProps = { params: Promise<{ id: string; explorationId: string }> }

/** An exploration's canonical address is its share URL: this one resolves the id through the owner's list. */
const ExplorationRoute = async ({ params }: ExplorationRouteProps) => {
  const { id, explorationId } = await params
  const list = await getExplorations(id, (await headers()).get('cookie'))
  const token = typeof list === 'object' ? list?.explorations.find((e) => e.id === explorationId)?.shareToken : null
  if (!token) notFound()
  permanentRedirect(sharePath(token))
}

export default ExplorationRoute
