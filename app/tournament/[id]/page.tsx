import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import TournamentPage from '@app/tournament'
import { cardsByIds } from '@utils/cards'
import { frameOf } from '@utils/deck/model'
import { log } from '@utils/log'
import { pageMetadata } from '@utils/metadata'
import { getTournament } from '@utils/tournaments'
import type { TournamentDetail } from '@utils/types'
import type { Frames } from '../helpers'
import { tabOf } from '../TournamentTabs'

type TournamentRouteProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
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

/**
 * Card frames for every decklist and the card tables, joined from `/cards`: the tournament API sends no
 * card type. Without them the lists still render, ungrouped.
 */
const framesOf = async ({ standings, stats }: TournamentDetail): Promise<Frames> => {
  const ids = [
    ...standings.flatMap(({ deck }) => (deck ? [...deck.main, ...deck.extra, ...deck.side] : [])),
    ...stats.cards.main,
    ...stats.cards.extra,
  ].map((card) => card.id)
  if (!ids.length) return {}
  try {
    const cards = await cardsByIds(ids)
    return Object.fromEntries([...cards].map(([id, card]) => [id, frameOf(card)]))
  } catch (error) {
    log('error', 'API_ERROR', { call: 'GET /cards?id=', page: '/tournament/:id', err: error })
    return {}
  }
}

/** When the API was read: the live page shows it and counts down to the next read. */
const clock = () => new Date().toISOString()

const TournamentRoute = async ({ params, searchParams }: TournamentRouteProps) => {
  const [{ id }, q] = await Promise.all([params, searchParams])
  const detail = await getTournament(id)
  if (!detail) notFound()

  const live = detail.tournament.status === 'live'
  // Decks are held back while live: nothing to join yet.
  const frames = live ? {} : await framesOf(detail)
  return <TournamentPage detail={detail} frames={frames} tab={tabOf(q.tab, live)} now={clock()} />
}

export default TournamentRoute
