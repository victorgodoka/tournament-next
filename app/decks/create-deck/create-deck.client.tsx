'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import DeckEditorComponent from '../deck-editor.component'
import { createDeck } from '../decks.api'
import { clearFormDraft } from '@lib/form-draft'
import type { DeckEditorValues } from '../decks.types'
import type { CreateDeckClientProps } from './create-deck.types'

const DRAFT_KEY = 'deck-create'

const CreateDeckClient = ({ archetypeOptions }: CreateDeckClientProps) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (values: DeckEditorValues) => {
    startTransition(async () => {
      const result = await createDeck(values)

      if (!result.ok) {
        setError(result.message)
        return
      }

      clearFormDraft(DRAFT_KEY)
      router.push(`/decks/${result.data.id}`)
    })
  }

  return (
    <div className="deck-form-page">
      

      <div className="deck-form-page__content omega-container omega-container--narrow">
        <header className="deck-form-page__header">
          <span className="deck-form-page__kicker">
            <span className="deck-form-page__kicker-mark" aria-hidden="true" />
            New Deck
          </span>
          <h1 className="deck-form-page__title">Create Deck</h1>
          <p className="deck-form-page__lead">
            Share a build with the community, or keep it private for your own collection.
          </p>
        </header>

        <DeckEditorComponent
          archetypeOptions={archetypeOptions}
          submitLabel="Create deck"
          submitIcon="mdi:cards-outline"
          cancelHref="/decks"
          isSubmitting={isPending}
          error={error}
          draftKey={DRAFT_KEY}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}

export default CreateDeckClient
