import { noIndexMetadata } from '@lib/page-metadata'
import type { Metadata } from 'next'
import { getDeck, getDeckComments } from './deck-details.api'
import { convertDeck } from '../decks.api'
import { BackdropComponent, CommentsComponent, DeckListComponent, ErrorPageComponent } from '@components'
import './deck-details.styles.css'

type DeckDetailsPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: DeckDetailsPageProps): Promise<Metadata> {
  const { id } = await params

  return noIndexMetadata(
    'Deck',
    `/decks/${id}`,
    `Saved Yu-Gi-Oh! deck ${id} on YGO Omega.`,
  )
}

export default async function DeckDetailsPage({ params }: DeckDetailsPageProps) {
  const { id } = await params
  const [details, commentsResult] = await Promise.all([
    getDeckDetails(id),
    getDeckComments(id),
  ])
  if (!details) return <ErrorPageComponent />

  return (
    <div className="decks-detail">
      <article className="decks-detail__content omega-container">
        <BackdropComponent />
        <DeckListComponent convertedDeck={details.convertedDeck} archetype={(details.deck.archetypes || details.convertedDeck.archetypes).join(" ")} />
        <CommentsComponent commentsResult={commentsResult} />
      </article>
    </div>
  )
}

const getDeckDetails = (async (id: string) => {
  const deck = (await getDeck(id))
  if (!deck.ok || !deck.data) return null

  const fetchDeck = await convertDeck(deck.data.code)
  return { deck: deck.data, convertedDeck: fetchDeck}
})

