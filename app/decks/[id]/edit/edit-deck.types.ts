import type { DeckEditorValues } from '../../decks.types'

export interface EditDeckPageProps {
  params: Promise<{ id: string }>
}

export interface EditDeckClientProps {
  deckId: number
  initialValues: DeckEditorValues
  archetypeOptions: string[]
}
