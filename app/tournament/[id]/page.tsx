import { notFound } from 'next/navigation'
import TournamentPage from '@app/tournament'
import { pageMetadata } from '@utils/metadata'
import { getTournament } from '@utils/tournaments'

type TournamentRouteProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: TournamentRouteProps) {
  const { id } = await params
  const detail = await getTournament(id)

  if (!detail) return pageMetadata({ title: 'Tournament not found', path: `/tournament/${id}`, noIndex: true })

  const { tournament } = detail
  const winner = tournament.winner?.name

  return pageMetadata({
    title: `${tournament.format} tournament #${tournament.id}`,
    path: `/tournament/${tournament.id}`,
    description: `${tournament.players} duelists over ${tournament.rounds} Swiss rounds on ${tournament.banlist}${
      winner ? `, won by ${winner}` : ', running now'
    }. Standings, decklists, pairings and archetype stats.`,
    // A live page changes every few minutes: let crawlers index the finished version instead.
    noIndex: tournament.status === 'live',
  })
}

const TournamentRoute = async ({ params }: TournamentRouteProps) => {
  const { id } = await params
  const detail = await getTournament(id)
  if (!detail) notFound()

  return <TournamentPage detail={detail} />
}

export default TournamentRoute
