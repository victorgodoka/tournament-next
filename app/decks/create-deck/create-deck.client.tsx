'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BackdropComponent } from '@components'
import DeckEditorComponent from '../deck-editor.component'
import { createDeck } from '../decks.api'
import type { DeckEditorValues } from '../decks.types'
import type { CreateDeckClientProps } from './create-deck.types'

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

      router.push(`/decks/${result.data.data.id}`)
    })
  }

  return (
    <div className="create-deck">
      <BackdropComponent />

      <div className="create-deck__content omega-container omega-container--narrow">
        <header className="create-deck__header">
          <span className="create-deck__kicker">
            <span className="create-deck__kicker-mark" aria-hidden="true" />
            New Deck
          </span>
          <h1 className="create-deck__title">Create Deck</h1>
          <p className="create-deck__lead">
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
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}

export default CreateDeckClient
