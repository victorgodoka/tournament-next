import { noIndexMetadata } from '@lib/page-metadata'
import DecksPageClient from './decks.client'
import './decks.styles.css'
import { getSavedDecks } from './decks.api'

export const metadata = noIndexMetadata(
  'Decks',
  '/decks',
  'Browse and manage your Yu-Gi-Oh! decks on YGO Omega.',
)

const DecksPage = async () => {
  const result = await getSavedDecks({ page: 1 })

  return (
    <DecksPageClient
      initialData={result.ok ? result.data : null}
      initialError={result.ok ? null : result.message}
    />
  )
}

export default DecksPage
