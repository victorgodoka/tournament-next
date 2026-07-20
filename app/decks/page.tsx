import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken } from '@lib/session.server'
import DecksPageClient from './decks.client'
import './decks.styles.css'
import { getSavedDecks } from './decks.api'

export const metadata = noIndexMetadata(
  'Decks',
  '/decks',
  'Browse and manage your Yu-Gi-Oh! decks on YGO Omega.',
)

const DecksPage = async () => {
  const token = await getSessionToken()
  const result = await getSavedDecks({ page: 1 }, token)

  return (
    <DecksPageClient
      initialData={result.ok ? result.data : null}
      initialError={result.ok ? null : result.message}
    />
  )
}

export default DecksPage
