import { noIndexMetadata } from "@lib/page-metadata"
import { Metadata } from "next"
import { DeckDetailsPageProps } from "./deck-details.types"
import DeckDetailsPage from "./deck-details.page"

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

export default async function Page({ params }: DeckDetailsPageProps) {
  return (
    <DeckDetailsPage params={params} />
  )
}
