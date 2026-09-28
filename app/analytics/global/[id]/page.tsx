import { notFound } from 'next/navigation'
import { AnalyticsShell } from '@app/profile/analytics/AnalyticsShell'
import { GlobalExplorationView } from '@omega/analytics/explorer/global'
import { getGlobalExploration, getGlobalVariables, globalPath } from '@utils/global-explorer'
import { pageMetadata } from '@utils/metadata'

type GlobalRouteProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: GlobalRouteProps) {
  const { id } = await params
  const found = await getGlobalExploration(id)
  if (!found) return pageMetadata({ title: 'Exploration not found', path: globalPath(id), noIndex: true })
  const { exploration } = found
  return pageMetadata({
    title: `${exploration.name} · Server-wide analytics`,
    path: globalPath(id),
    description: exploration.description || `${exploration.name}: server-wide analytics over every ranked duel.`,
  })
}

/** A published global exploration. A draft or a deleted one is a 404. */
const GlobalRoute = async ({ params }: GlobalRouteProps) => {
  const { id } = await params
  const [found, variables] = await Promise.all([getGlobalExploration(id), getGlobalVariables()])
  if (!found) notFound()

  return (
    <AnalyticsShell
      eyebrow="Server-wide analytics"
      meta="Every ranked duel · updated daily"
      title={found.exploration.name}
      back={{ href: '/analytics', label: 'Server-wide analytics' }}
    >
      <GlobalExplorationView exploration={found.exploration} seasons={found.seasons} variables={variables} />
    </AnalyticsShell>
  )
}

export default GlobalRoute
