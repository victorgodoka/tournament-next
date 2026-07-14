import type { Metadata } from 'next'
import { pageMetadata } from '@lib/page-metadata'
import { getTournamentByID } from '../tournament.api'
import { isTournamentFinished } from '../tournament-page.utils'
import TournamentPageClient from '../tournament-page.client'
import type { TournamentPageProps } from '../tournament.types'
import '../tournament.styles.css'

export async function generateMetadata({
  params,
}: TournamentPageProps): Promise<Metadata> {
  const { id } = await params
  const path = `/tournament/${id}`
  const result = await getTournamentByID(Number(id))

  if (!result.ok || !result.data.success || !result.data.data) {
    return pageMetadata({
      title: 'Tournament Not Found',
      path,
      description: 'This YGO Omega tournament could not be found.',
      noIndex: true,
    })
  }

  const { tournament } = result.data.data
  const status = isTournamentFinished(tournament) ? 'completed' : 'live'

  return pageMetadata({
    title: `Tournament #${tournament.id}`,
    path,
    description: `Tournament #${tournament.id} on YGO Omega — ${tournament.players} players, ${tournament.banlist} banlist, ${status}. View brackets and standings.`,
  })
}

export default async function TournamentDetailPage({
  params,
}: TournamentPageProps) {
  const { id } = await params
  const result = await getTournamentByID(Number(id))
  const detail = result.ok && result.data.success ? result.data.data : null
  const error = detail
    ? null
    : result.ok
      ? 'This tournament could not be found.'
      : result.message

  return <TournamentPageClient detail={detail} error={error} />
}
