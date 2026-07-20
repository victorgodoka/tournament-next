import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken } from '@lib/session.server'
import DecksPageClient from './decks.client'
import './decks.styles.css'
import { getDecksInfo, getSavedDecks } from './decks.api'
import { EMPTY_DECK_INFO } from './decks.const'

export const metadata = noIndexMetadata(
  'Decks',
  '/decks',
  'Browse and manage your Yu-Gi-Oh! decks on YGO Omega.',
)

const DecksPage = async () => {
  const token = await getSessionToken()
  const result = await getSavedDecks({ page: 1 }, token)
  const infoResult = await getDecksInfo()
  
  return (
    <DecksPageClient
      initialData={result.ok ? result.data : null}
      initialError={result.ok ? null : result.message}
      inititalInfo={infoResult.ok ? infoResult.data : EMPTY_DECK_INFO}
    />
  )
}

export default DecksPage
