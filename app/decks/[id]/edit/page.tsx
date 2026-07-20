import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken, getSessionUserId } from '@lib/session.server'
import { getDeck } from '../deck-details.api'
import { getDecksInfo } from '../../decks.api'
import EditDeckClient from './edit-deck.client'
import type { EditDeckPageProps } from './edit-deck.types'
import './edit-deck.styles.css'

export async function generateMetadata({ params }: EditDeckPageProps): Promise<Metadata> {
  const { id } = await params

  return noIndexMetadata(
    'Edit Deck',
    `/decks/${id}/edit`,
    `Edit saved Yu-Gi-Oh! deck ${id} on YGO Omega.`,
  )
}

export default async function EditDeckPage({ params }: EditDeckPageProps) {
  const { id } = await params
  const userId = await getSessionUserId()
  if (!userId) redirect(`/decks/${id}`)

  const token = await getSessionToken()
  const result = await getDeck(id, token)

  // Owner-only route: anyone else (or a missing deck) lands on the detail page.
  if (!result.ok || result.data.user_id !== userId) redirect(`/decks/${id}`)

  const deck = result.data
  const infoResult = await getDecksInfo()
  // The info endpoint repeats some archetype names, so dedupe before listing.
  const archetypeOptions = infoResult.ok
    ? [...new Set(infoResult.data.archetypes?.map((a) => a.archetype) ?? [])]
    : []

  return (
    <EditDeckClient
      deckId={deck.id}
      initialValues={{
        name: deck.name,
        code: deck.code,
        archetypes: deck.archetypes ?? [],
        tags: deck.tags ?? [],
        private: deck.private,
      }}
      archetypeOptions={archetypeOptions}
    />
  )
}
