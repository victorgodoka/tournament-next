import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import TournamentPage from '@app/tournament'
import { pageMetadata } from '@utils/metadata'
import { getTournament } from '@utils/tournaments'
import { tabOf } from '../TournamentTabs'

type TournamentRouteProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[]; round?: string | string[] }>
}

export async function generateMetadata({ params }: TournamentRouteProps) {
  const { id } = await params
  const [detail, t] = await Promise.all([getTournament(id), getTranslations('Tournaments.detailMeta')])

  if (!detail) return pageMetadata({ title: t('notFound'), path: `/tournament/${id}`, noIndex: true })

  const { tournament } = detail
  const live = tournament.status === 'live'
  const winner = tournament.winner?.name?.trim()
  const values = {
    format: tournament.format,
    banlist: tournament.banlist,
    players: tournament.players,
    rounds: tournament.rounds,
    winner: winner ?? '',
  }

  return pageMetadata({
    title: t('title', { format: tournament.format, id: tournament.id }),
    path: `/tournament/${tournament.id}`,
    description: t(live ? 'descriptionLive' : winner ? 'descriptionWon' : 'descriptionOpen', values),
    // A live page changes every few minutes: let crawlers index the finished version instead.
    noIndex: live,
  })
}

const TournamentRoute = async ({ params, searchParams }: TournamentRouteProps) => {
  const [{ id }, q] = await Promise.all([params, searchParams])
  const detail = await getTournament(id)
  if (!detail) notFound()

  const round = typeof q.round === 'string' ? Number(q.round) : NaN
  return <TournamentPage detail={detail} tab={tabOf(q.tab)} round={Number.isInteger(round) ? round : undefined} />
}

export default TournamentRoute
