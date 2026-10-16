'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@hooks/index'
import { createDeck, DeckApiError, DeckConflictError, updateDeck, type SavedDeck } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'
import type { EditorAction, EditorState } from './deck-editor.reducer'
import { clearDraft, draftKey, readDraft, sameDraft, writeDraft, type Draft } from './drafts'

/** The editor's content as a local draft, stamped now. Call it from effects, handlers and callbacks, never in render. */
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
 * Server saves. `format` is the effective banlist id (the TCG list while none is chosen). `wait` is why
 * the editor can't save yet (still loading), shown instead of saving. Signed out, or on a `401`, the
 * draft is written and the user goes to /login, coming back here after. No failure drops local work.
 * `latest` is the last committed state, for callbacks that outlive a render.
 */
export const useSave = (state: EditorState, dispatch: React.Dispatch<EditorAction>, format: number | null, wait: string | null) => {
  const t = useTranslations('DeckEditor')
  const { user, refresh } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<SavedDeck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(state)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    latest.current = state
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /** `stale`: a 401 under a signed-in user. /login would see that user and send them straight back, so re-read the session first. */
  const toLogin = async (s: EditorState, stale: boolean) => {
    if (s.dirty) writeDraft(draftKey(s.deckId), draftOf(s))
    if (stale) await refresh()
    if (!mounted.current) return
    setReturnTo(location.pathname + location.search)
    router.push('/login')
  }

  const save = async (force = false) => {
    if (busy.current) return // the button already reads "Saving…"
    const s = latest.current
    const { deckId, revision } = s
    if (user === null) return toLogin(s, false)
    if (wait) return setError(wait)
    if (deckId !== null && revision === null) return setError(t('save.notLoaded'))
    busy.current = true
    setSaving(true)
    setError(null)
    const input = { name: s.name.trim() || t('newDeck'), format, main: s.deck.main, extra: s.deck.extra, side: s.deck.side }
    try {
      const saved = deckId === null ? await createDeck(input) : await updateDeck(deckId, input, revision!, force)
      const now = latest.current
      const changed = !sameDraft(now, s)
      // Unchanged, the editor takes the name and format as saved, so a later draft compares like for like.
      dispatch({ type: 'saved', deckId: saved.id, revision: saved.revision, ...(changed ? { dirty: true } : { name: input.name, format: input.format }) })
      // Edits made during the request belong to the saved deck now, on top of this revision.
      if (changed) writeDraft(draftKey(saved.id), { ...draftOf(now), revision: saved.revision })
      if (deckId === null) {
        // Unmounted, the new draft may belong to another editor by now: clear it only if it holds this one's content.
        const stored = readDraft(draftKey(null))
        if (mounted.current || (stored && sameDraft(stored, now))) clearDraft(draftKey(null))
        // Not router.replace: the [id] page would remount the editor, dropping undo history and the card cache.
        if (mounted.current) window.history.replaceState(null, '', `/deck-editor/${saved.id}`)
      } else if (!changed) clearDraft(draftKey(deckId))
    } catch (e) {
      if (e instanceof DeckConflictError) setConflict(e.latest)
      else if (e instanceof DeckApiError && e.status === 401) await toLogin(latest.current, true)
      else {
        console.error(e) // a 400's server text is English and technical: it stays here
        setError(e instanceof DeckApiError && e.status === 400 ? t('save.rejected') : t('save.failed'))
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

  return { save, saving, conflict, resolveConflict, error, dismissError: () => setError(null), latest }
}
