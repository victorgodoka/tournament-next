'use client'

import dynamic from 'next/dynamic'

// Client only: the editor reads its draft and `?d=` in state initializers, which the server can't match.
const DeckEditor = dynamic(() => import('./deck-editor.client'), { ssr: false })

export const DeckEditorLoader = ({ deckId, promo }: { deckId: string | null; promo?: React.ReactNode }) => (
  <DeckEditor deckId={deckId} promo={promo} />
)
