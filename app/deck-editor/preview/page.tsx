import { noIndexMetadata } from '@lib/page-metadata'
import DeckPreviewClient from './deck-preview.client'

// The preview reflects a transient, client-side deck handed off from the
// editor — nothing here should be indexed.
export const metadata = noIndexMetadata(
  'Deck Preview',
  '/deck-editor/preview',
  'Preview, export, and share the Yu-Gi-Oh! deck you built in the YGO Omega deck editor.',
)

export default function DeckPreviewPage() {
  return (
    <main className="deck-preview-page content">
      <DeckPreviewClient />
    </main>
  )
}
