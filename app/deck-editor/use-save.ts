'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@hooks/index'
import { createDeck, DeckApiError, DeckConflictError, updateDeck, type SavedDeck } from '@utils/decks'
import type { EditorAction, EditorState } from './deck-editor.reducer'
import { clearDraft, draftKey, setReturnTo, writeDraft, type Draft } from './drafts'

/** The editor's content as a local draft, stamped now. Call it from handlers and callbacks, never in render. */
export const draftOf = (s: EditorState): Draft => ({ deck: s.deck, name: s.name, format: s.format, revision: s.revision, at: Date.now() })

/** The saved deck as the editor's `load` action. */
export const loadAction = (deck: SavedDeck): EditorAction => ({
  type: 'load',
  deck: { main: deck.main, extra: deck.extra, side: deck.side },
  name: deck.name,
  format: deck.format,
  deckId: deck.id,
  revision: deck.revision,
})

/**
 * Server saves. `format` is the effective banlist id (the TCG list while none is chosen). Signed out, or
 * on a `401`, the draft is written and the user goes to /login, coming back here after. No failure
 * drops local work: the draft stays until a save succeeds with nothing changed in the meantime.
 */
export const useSave = (state: EditorState, dispatch: React.Dispatch<EditorAction>, format: number | null) => {
  const t = useTranslations('DeckEditor')
  const { user } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<SavedDeck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(state)
  const busy = useRef(false)
  useEffect(() => {
    latest.current = state
  })

  const toLogin = (s: EditorState) => {
    writeDraft(draftKey(s.deckId), draftOf(s))
    setReturnTo(location.pathname + location.search)
    router.push('/login')
  }

  const save = async (force = false) => {
    const s = latest.current
    const { deckId, revision } = s
    // A saved deck still loading has nothing to send yet.
    if (busy.current || (deckId !== null && revision === null)) return
    if (user === null) return toLogin(s)
    busy.current = true
    setSaving(true)
    setError(null)
    const input = { name: s.name.trim() || t('newDeck'), format, main: s.deck.main, extra: s.deck.extra, side: s.deck.side }
    try {
      const saved = deckId === null ? await createDeck(input) : await updateDeck(deckId, input, revision!, force)
      const now = latest.current
      const changed = now.deck !== s.deck || now.name !== s.name || now.format !== s.format
      dispatch({ type: 'saved', deckId: saved.id, revision: saved.revision, dirty: changed })
      if (deckId === null) {
        clearDraft(draftKey(null))
        // Not router.replace: the [id] page would remount the editor, dropping undo history and the card cache.
        window.history.replaceState(null, '', `/deck-editor/${saved.id}`)
      } else if (!changed) clearDraft(draftKey(deckId))
    } catch (e) {
      if (e instanceof DeckConflictError) setConflict(e.latest)
      else if (e instanceof DeckApiError && e.status === 401) toLogin(latest.current)
      else {
        console.error(e)
        setError(e instanceof DeckApiError && e.status === 400 ? t('save.rejected', { reason: e.message }) : t('save.failed'))
      }
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  /** `cancel` keeps the local edits unsaved. */
  const resolveConflict = (choice: 'load' | 'overwrite' | 'cancel') => {
    const theirs = conflict
    setConflict(null)
    if (!theirs || choice === 'cancel') return
    if (choice === 'overwrite') {
      void save(true)
      return
    }
    dispatch(loadAction(theirs))
    clearDraft(draftKey(theirs.id))
  }

  return { save, saving, conflict, resolveConflict, error, dismissError: () => setError(null) }
}
