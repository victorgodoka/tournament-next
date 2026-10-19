'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@hooks/index'
import { ComboApiError, ComboConflictError, comboUrl, getCombo, saveCombo, updateCombo } from '@utils/combos'
import { hashPayload, payloadOf, sessionOf } from '@utils/simulator/combo'
import type { SessionEvent } from '@utils/simulator/session'
import type { Session } from '@utils/simulator/types'

type Write = { title: string; asNew: boolean; share: boolean }

/**
 * What the last save, reload or share came to, shown as one alert. `failed` got no answer: Retry runs `again` (a reload
 * when null) on the session as it is then, so whatever it ties is what it sent. It is only that session's: the client
 * dismisses the outcome whenever a new board replaces it (a deck, a hand, Reset, a reload).
 */
export type Outcome =
  | { kind: 'signIn' | 'limit' | 'saveFailed' | 'damaged' | 'copied' }
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
  const [asking, setAsking] = useState<{ title: string; share: boolean } | null>(null)
  /** An update answered 409: the conflict dialog is open. */
  const [conflict, setConflict] = useState<{ share: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const copy = async (id: string) => {
    const link = comboUrl(id)
    try {
      await navigator.clipboard.writeText(link)
      setOutcome({ kind: 'copied' })
    } catch {
      setOutcome({ kind: 'copyFailed', link })
    }
  }

  /** `POST`, or `PATCH` the tied combo unless `asNew`. */
  const write = async ({ title, asNew, share }: Write) => {
    const payload = payloadOf(session)
    const input = { title, deckId: session.deckId, payload }
    const tied = asNew ? null : session.combo
    setConflict(null)
    setOutcome(null)
    setBusy(true)
    try {
      const { id, revision } = tied ? await updateCombo(tied.id, input, tied.revision) : await saveCombo(input)
      setAsking(null)
      dispatch({ type: 'saved', combo: { id, title, revision, saved: hashPayload(payload) } })
      if (share) await copy(id)
    } catch (error) {
      setAsking(null)
      if (error instanceof ComboConflictError) setConflict({ share })
      else if (tied && error instanceof ComboApiError && error.status === 404) {
        // Deleted elsewhere: the session lets go of it, and the title dialog saves it as a new one.
        dispatch({ type: 'saved', combo: null })
        setAsking({ title, share })
      } else setOutcome(failure(error, { title, asNew, share }))
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
        setAsking({ title: tied.title, share: false })
        return
      }
      const opened = sessionOf(combo.payload, null, combo.deckId)
      if (!opened) return setOutcome({ kind: 'damaged' })
      // The hash of the session as parsed, never of the payload as sent: jsonb reorders its keys.
      const saved = hashPayload(payloadOf(opened))
      dispatch({ type: 'open', session: { ...opened, combo: { id: combo.id, title: combo.title, revision: combo.revision, saved } } })
      onOpen()
    } catch (error) {
      setOutcome(failure(error, null))
    } finally {
      setBusy(false)
    }
  }

  /** Signed out: the sign-in link, and the draft keeps the line. Tied: `PATCH` at once. Else the title dialog, from the deck name. */
  const save = (share: boolean) => {
    if (user === null) return setOutcome({ kind: 'signIn' })
    if (session.combo) return void write({ title: session.combo.title, asNew: false, share })
    setOutcome(null)
    setAsking({ title: session.name, share })
  }

  return {
    unsaved,
    busy,
    asking,
    conflict,
    outcome,
    save: () => save(false),
    /** A tied session only: the title dialog from the combo's title, to rename it or save it as a new one. */
    saveAs: () => {
      if (session.combo) setAsking({ title: session.combo.title, share: false })
    },
    share: () => (session.combo && !unsaved ? void copy(session.combo.id) : save(true)),
    submit: (title: string, asNew: boolean) => void write({ title, asNew, share: asking?.share ?? false }),
    cancel: () => setAsking(null),
    reload: () => void reload(),
    /** The conflict's way out that keeps the line here. */
    saveAsNew: () => {
      if (session.combo) void write({ title: session.combo.title, asNew: true, share: conflict?.share ?? false })
    },
    closeConflict: () => setConflict(null),
    retry: () => {
      if (outcome?.kind === 'failed') void (outcome.again ? write(outcome.again) : reload())
    },
    dismiss: () => setOutcome(null),
  }
}

export type SaveFlow = ReturnType<typeof useSave>
