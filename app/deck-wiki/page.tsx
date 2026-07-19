import { WipComponent } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './deck-wiki.styles.css'

export const metadata = noIndexMetadata(
  'Deck Wiki',
  '/deck-wiki',
  'Community Yu-Gi-Oh! deck profiles and meta guides on YGO Omega.',
)

const DeckWikiPage = () => {
  return (
    <WipComponent />
  )
}

export default DeckWikiPage
