'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@contexts/auth/auth.context'
import { ComboApiError, ComboConflictError, comboUrl, getCombo, saveCombo, updateCombo } from '@utils/combos'
import { comboSession, hashPayload, payloadOf } from '@utils/simulator/combo'
import type { SessionEvent } from '@utils/simulator/session'
import type { ComboVisibility, Session } from '@utils/simulator/types'

/** `visibility`: absent, an update keeps what the combo has. */
type Write = { title: string; asNew: boolean; share: boolean; visibility?: ComboVisibility }
/** What the title dialog and the conflict dialog carry over to the save they lead to. */
type Pending = { title: string; share: boolean; visibility?: ComboVisibility }

/**
 * What the last save, reload or share came to, shown as one alert. `failed` got no answer: Retry runs `again` (a reload
 * when null) on the session as it is then, so whatever it ties is what it sent. It is only that session's: the client
 * dismisses the outcome whenever a new board replaces it (a deck, a hand, Reset, a reload).
 */
export type Outcome =
  | { kind: 'signIn' | 'limit' | 'saveFailed' | 'damaged' | 'copied' | 'copiedPrivate' }
  | { kind: 'failed'; again: Write | null }
  | { kind: 'copyFailed'; link: string }

/** 401 is signed out, 409 `LIMIT` the 500 combos, 400/413 a combo the server refuses; anything else may pass on a retry. */
const failure = (error: unknown, again: Write | null): Outcome => {
  if (!(error instanceof ComboApiError)) return { kind: 'failed', again }
  if (error.status === 401) return { kind: 'signIn' }
  if (error.code === 'LIMIT') return { kind: 'limit' }
  return error.status === 400 || error.status === 413 ? { kind: 'saveFailed' } : { kind: 'failed', again }
}

/**
 * Save, Save as, Share and their dialogs. A save ties the session to what landed, with the hash of the payload it sent;
 * a failure leaves the session as it was. `onOpen` runs when a reload replaces the board.
 */
export function useSave(session: Session, dispatch: (event: SessionEvent) => void, onOpen: () => void) {
  const { user } = useAuth()
  const hash = useMemo(() => hashPayload(payloadOf(session)), [session])
  /** Nothing saved yet, or changed since: Save shows a dot, Share saves first. */
  const unsaved = hash !== session.combo?.saved
  /** The title dialog is open: the title it starts from, and whether the link is copied once it saves. */
  const [asking, setAsking] = useState<Pending | null>(null)
  /** An update answered 409: the conflict dialog is open, with the title that update carried (a rename included). */
  const [conflict, setConflict] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const copy = async (id: string, visibility?: ComboVisibility) => {
    const link = comboUrl(id)
    try {
      await navigator.clipboard.writeText(link)
      setOutcome({ kind: visibility === 'private' ? 'copiedPrivate' : 'copied' })
    } catch {
      setOutcome({ kind: 'copyFailed', link })
    }
  }

  /** `POST`, or `PATCH` the tied combo unless `asNew`. */
  const write = async ({ title, asNew, share, visibility }: Write) => {
    const payload = payloadOf(session)
    const input = { title, deckId: session.deckId, payload, visibility }
    const tied = asNew ? null : session.combo
    // Known here, or the one it has; a new copy of a combo must not come out more open than the original.
    const shown = visibility ?? session.combo?.visibility
    setConflict(null)
    setOutcome(null)
    setBusy(true)
    try {
      const { id, revision } = tied ? await updateCombo(tied.id, input, tied.revision) : await saveCombo({ ...input, visibility: shown })
      setAsking(null)
      dispatch({ type: 'saved', combo: { id, title, revision, saved: hashPayload(payload), visibility: shown } })
      if (share) await copy(id, shown)
    } catch (error) {
      setAsking(null)
      if (error instanceof ComboConflictError) setConflict({ title, share, visibility })
      else if (tied && error instanceof ComboApiError && error.status === 404) {
        // Deleted elsewhere: the session lets go of it, and the title dialog saves it as a new one.
        dispatch({ type: 'saved', combo: null })
        setAsking({ title, share, visibility: shown })
      } else setOutcome(failure(error, { title, asNew, share, visibility }))
    } finally {
      setBusy(false)
    }
  }

  /** After a conflict: the saved one as it is now, in place of the session. Gone since, it asks to save this one as new. */
  const reload = async () => {
    const tied = session.combo
    if (!tied) return
    setConflict(null)
    setOutcome(null) // its Retry goes with it: a second click cannot start a second reload
    setBusy(true)
    try {
      const combo = await getCombo(tied.id)
      if (!combo) {
        dispatch({ type: 'saved', combo: null })
        setAsking({ title: tied.title, share: false, visibility: tied.visibility })
        return
      }
      const opened = comboSession(combo)
      if (!opened) return setOutcome({ kind: 'damaged' })
      dispatch({ type: 'open', session: opened })
      onOpen()
    } catch (error) {
      setOutcome(failure(error, null))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Tied and unchanged: nothing to send (a `PATCH` would only bump the revision); Share copies the link, in this click.
   * Signed out: the sign-in link, and the draft keeps the line. Tied: `PATCH` at once. Else the title dialog, from the deck name.
   */
  const save = (share: boolean) => {
    if (session.combo && !unsaved) {
      if (share) void copy(session.combo.id, session.combo.visibility)
      return
    }
    if (user === null) return setOutcome({ kind: 'signIn' })
    if (session.combo) return void write({ title: session.combo.title, asNew: false, share })
    setOutcome(null)
    setAsking({ title: session.name, share })
  }

  return {
    /** The session as it stands, hashed: what a save would tie. */
    hash,
    unsaved,
    busy,
    asking,
    conflict,
    outcome,
    save: () => save(false),
    /** A tied session only: the title dialog from the combo's title, to rename it or save it as a new one. */
    saveAs: () => {
      if (session.combo) setAsking({ title: session.combo.title, share: false, visibility: session.combo.visibility })
    },
    share: () => save(true),
    submit: (title: string, asNew: boolean, visibility: ComboVisibility) => void write({ title, asNew, share: asking?.share ?? false, visibility }),
    cancel: () => setAsking(null),
    reload: () => void reload(),
    /** The conflict's way out that keeps the line here. */
    saveAsNew: () => {
      if (session.combo) void write({ title: conflict?.title ?? session.combo.title, asNew: true, share: conflict?.share ?? false, visibility: conflict?.visibility })
    },
    closeConflict: () => setConflict(null),
    retry: () => {
      if (outcome?.kind === 'failed') void (outcome.again ? write(outcome.again) : reload())
    },
    dismiss: () => setOutcome(null),
    /** For what needs an account besides Save: `run` for a signed-in user, else the sign-in alert in its place. */
    gate: (run: () => void) => (user === null ? setOutcome({ kind: 'signIn' }) : run()),
    /** A saved combo that could not be rebuilt was not loaded. */
    damaged: () => setOutcome({ kind: 'damaged' }),
  }
}

export type SaveFlow = ReturnType<typeof useSave>
