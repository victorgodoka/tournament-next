import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './deck-wiki.styles.css'

export const metadata = noIndexMetadata(
  'Deck Wiki',
  '/deck-wiki',
  'Community Yu-Gi-Oh! deck profiles and meta guides on YGO Omega.',
)

const DeckWikiPage = () => {
  return (
    <ComingSoonPage
      title="Deck Wiki"
      description="Community deck profiles and meta guides are coming soon."
    />
  )
}

export default DeckWikiPage
