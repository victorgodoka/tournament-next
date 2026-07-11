import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './decks.styles.css'

export const metadata = noIndexMetadata(
  'Decks',
  '/decks',
  'Browse and manage your Yu-Gi-Oh! decks on YGO Omega.',
)

const DecksPage = () => {
  return (
    <ComingSoonPage
      title="Decks"
      description="Deck browsing and management is coming soon."
    />
  )
}

export default DecksPage
