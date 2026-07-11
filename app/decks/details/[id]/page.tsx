import Link from 'next/link'
import { noIndexMetadata } from '@lib/page-metadata'
import type { Metadata } from 'next'
import '../../decks.styles.css'

type DeckDetailsPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: DeckDetailsPageProps): Promise<Metadata> {
  const { id } = await params

  return noIndexMetadata(
    'Deck',
    `/decks/details/${id}`,
    `Saved Yu-Gi-Oh! deck ${id} on YGO Omega.`,
  )
}

export default async function DeckDetailsPage({ params }: DeckDetailsPageProps) {
  const { id } = await params

  return (
    <div className="decks-page omega-container">
      <h1 className="decks-page__title">Deck details</h1>
      <p className="decks-page__description">
        Deck viewer for saved deck #{id} is not available yet.
      </p>
      <Link href="/decks" className="decks-page__link">
        Back to decks
      </Link>
    </div>
  )
}
