import { redirect } from 'next/navigation'
import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken } from '@lib/session.server'
import { getDecksInfo } from '../decks.api'
import { getArchetypeOptions } from '../decks.utils'
import { EMPTY_DECK_INFO } from '../decks.const'
import CreateDeckClient from './create-deck.client'

export const metadata = noIndexMetadata(
  'Create Deck',
  '/decks/create-deck',
  'Save and share a new Yu-Gi-Oh! deck on YGO Omega.',
)

const CreateDeckPage = async () => {
  const token = await getSessionToken()
  if (!token) redirect('/decks?notice=signin')

  const infoResult = await getDecksInfo()
  const archetypeOptions = getArchetypeOptions(infoResult.ok ? infoResult.data : EMPTY_DECK_INFO)

  return <CreateDeckClient archetypeOptions={archetypeOptions} />
}

export default CreateDeckPage
