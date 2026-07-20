import { redirect } from 'next/navigation'
import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken } from '@lib/session.server'
import { getDecksInfo } from '../decks.api'
import CreateDeckClient from './create-deck.client'
import './create-deck.styles.css'

export const metadata = noIndexMetadata(
  'Create Deck',
  '/decks/create-deck',
  'Save and share a new Yu-Gi-Oh! deck on YGO Omega.',
)

const CreateDeckPage = async () => {
  const token = await getSessionToken()
  if (!token) redirect('/decks')

  const infoResult = await getDecksInfo()
  // The info endpoint repeats some archetype names, so dedupe before listing.
  const archetypeOptions = infoResult.ok
    ? [...new Set(infoResult.data.archetypes?.map((a) => a.archetype) ?? [])]
    : []

  return <CreateDeckClient archetypeOptions={archetypeOptions} />
}

export default CreateDeckPage
