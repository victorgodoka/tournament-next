import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { noIndexMetadata } from '@lib/page-metadata'
import { decodeSessionUserId, getSessionToken } from '@lib/session.server'
import ErrorPageComponent from '@components/error-page/error-page.component'
import { getDeck } from '../deck-details.api'
import { getDecksInfo } from '../../decks.api'
import { getArchetypeOptions } from '../../decks.utils'
import { EMPTY_DECK_INFO } from '../../decks.const'
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
  const token = await getSessionToken()
  const userId = decodeSessionUserId(token) // sync decode — token already in hand
  if (!userId) redirect(`/decks/${id}`)

  // Independent reads — fetch in parallel to keep TTFB off the critical path.
  const [result, infoResult] = await Promise.all([getDeck(id, token), getDecksInfo()])

  // Missing deck or upstream/transport failure → error surface (no redirect hop).
  if (!result.ok) return <ErrorPageComponent />
  // Loaded, but not the owner → send them to the public detail view.
  if (result.data.user_id !== userId) redirect(`/decks/${id}`)

  const deck = result.data
  const archetypeOptions = getArchetypeOptions(infoResult.ok ? infoResult.data : EMPTY_DECK_INFO)

  return (
    <EditDeckClient
      key={deck.id}
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
