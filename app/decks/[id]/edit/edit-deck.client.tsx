'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import ButtonComponent from '@components/button/button.component'
import DeckEditorComponent from '../../deck-editor.component'
import { deleteDeck, updateDeck } from '../../decks.api'
import type { DeckEditorValues } from '../../decks.types'
import type { EditDeckClientProps } from './edit-deck.types'

const EditDeckClient = ({ deckId, initialValues, archetypeOptions }: EditDeckClientProps) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const handleSubmit = (values: DeckEditorValues) => {
    startSaving(async () => {
      const result = await updateDeck(deckId, values)

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.push(`/decks/${deckId}`)
    })
  }

  const handleDelete = () => {
    startDeleting(async () => {
      const result = await deleteDeck(deckId)

      if (!result.ok) {
        setDeleteError(result.message)
        setConfirmingDelete(false)
        return
      }

      router.push('/decks')
    })
  }

  return (
    <div className="deck-form-page">
      

      <div className="deck-form-page__content omega-container omega-container--narrow">
        <header className="deck-form-page__header">
          <span className="deck-form-page__kicker">
            <span className="deck-form-page__kicker-mark" aria-hidden="true" />
            Deck Settings
          </span>
          <h1 className="deck-form-page__title">Edit Deck</h1>
          <p className="deck-form-page__lead">
            Update <strong>{initialValues.name}</strong> — changes are visible as soon as you save.
          </p>
        </header>

        <DeckEditorComponent
          archetypeOptions={archetypeOptions}
          initialValues={initialValues}
          submitLabel="Save changes"
          submitIcon="mdi:content-save-outline"
          cancelHref={`/decks/${deckId}`}
          isSubmitting={isSaving}
          error={error}
          onSubmit={handleSubmit}
        />

        <section className="deck-danger" aria-labelledby="deck-danger-title">
          <div className="deck-danger__copy">
            <h2 id="deck-danger-title" className="deck-danger__title">
              Danger zone
            </h2>
            <p className="deck-danger__text">
              Deleting a deck is permanent — its likes and comments are lost.
            </p>
          </div>

          {confirmingDelete ? (
            <div
              className="deck-danger__actions"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setConfirmingDelete(false)
              }}
            >
              <ButtonComponent
                variant="danger"
                icon="mdi:delete-forever-outline"
                loading={isDeleting}
                autoFocus
                onClick={handleDelete}
              >
                Confirm delete
              </ButtonComponent>
              <ButtonComponent
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep deck
              </ButtonComponent>
            </div>
          ) : (
            <ButtonComponent
              variant="outline"
              icon="mdi:delete-outline"
              className="deck-danger__trigger"
              onClick={() => {
                setDeleteError(null)
                setConfirmingDelete(true)
              }}
            >
              Delete deck
            </ButtonComponent>
          )}

          {deleteError ? (
            <p className="deck-danger__error" role="alert">
              {deleteError}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default EditDeckClient
