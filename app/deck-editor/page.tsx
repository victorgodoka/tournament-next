import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './deck-editor.styles.css'

export const metadata = noIndexMetadata(
  'Deck Editor',
  '/deck-editor',
  'Build and edit Yu-Gi-Oh! decks with the YGO Omega deck editor.',
)

const DeckEditorPage = () => {
  return (
    <ComingSoonPage
      title="Deck Editor"
      description="The deck editor is coming soon."
    />
  )
}

export default DeckEditorPage
