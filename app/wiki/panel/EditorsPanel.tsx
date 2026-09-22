'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Byline } from '@omega/wiki/article'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip'
import { WikiApiError, demoteEditor, promoteEditor } from '@utils/articles'
import type { WikiEditor } from '@utils/types'

/** Digits only, at most 20: a Discord snowflake, same rule the API applies. */
const SNOWFLAKE = /^\d{1,20}$/

const failure = (error: unknown) => {
  if (!(error instanceof WikiApiError)) return "Couldn't reach the wiki."
  if (error.status === 404) return 'That duelist has never signed in. Ask them to sign in once, then try again.'
  if (error.status === 403) return error.code === 'FORBIDDEN' ? "Admin roles can't be changed." : "Your account can't do that."
  if (error.status === 401) return 'Your session expired. Sign in again.'
  return "Couldn't save that change."
}

/**
 * Who can write the wiki. Admins are listed too, so the panel doesn't pretend they can't —
 * their rows carry no controls, because no route may touch an admin.
 */
export const EditorsPanel = ({ initial }: { initial: WikiEditor[] }) => {
  const [editors, setEditors] = useState(initial)
  const [id, setId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const promote = async (event: React.FormEvent) => {
    event.preventDefault()
    const userId = id.trim()
    if (!SNOWFLAKE.test(userId)) return setError('A duelist ID is digits only, at most 20 of them.')

    setBusy(userId)
    setError(null)
    setDone(null)
    try {
      const editor = await promoteEditor(userId)
      setEditors((current) => [...current.filter((row) => row.id !== editor.id), editor])
      setId('')
      setDone(`${editor.username ?? editor.id} can now write.`)
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
    } finally {
      setBusy(null)
    }
  }

  const demote = async (editor: WikiEditor) => {
    setBusy(editor.id)
    setError(null)
    setDone(null)
    try {
      await demoteEditor(editor.id)
      setEditors((current) => current.filter((row) => row.id !== editor.id))
      setDone(`${editor.username ?? editor.id} can no longer write. Their articles stay.`)
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <form onSubmit={promote} className="flex max-w-[60ch] flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <label htmlFor="promote-id" className="block text-ink-muted signal-sm">
            Duelist ID
          </label>
          <input
            id="promote-id"
            value={id}
            onChange={(event) => setId(event.target.value)}
            inputMode="numeric"
            maxLength={20}
            placeholder="187263901827563520"
            className="mt-2 w-full border border-surface-400 bg-surface-200 px-3 py-2.5 text-ink mono-data placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
          />
        </div>
        <button type="submit" disabled={busy !== null} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          {busy && busy === id.trim() ? 'Adding…' : 'Add editor'}
        </button>
      </form>

      <p className="mt-2 text-ink-muted mono-note">
        Promotion never creates an account: the duelist has to have signed in at least once.
      </p>

      <p aria-live="polite" role={error ? 'alert' : undefined} className={twMerge('mt-3.5 body-sm', error ? 'text-gold' : 'text-cyan')}>
        {error ?? done ?? ''}
      </p>

      <ul className="mt-6 border border-line">
        {editors.map((editor) => (
          <li
            key={editor.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Byline user={editor} size={28} className="text-ink body-strong" />
              <span className="text-ink-muted mono-handle">{editor.id}</span>
            </span>

            <span className="flex items-center gap-3">
              <Chip tone={editor.role === 'ADMIN' ? 'cyan' : 'neutral'}>{editor.role}</Chip>
              {editor.role === 'ADMIN' ? (
                <span className="text-ink-muted signal-sm">Seeded</span>
              ) : (
                <button
                  type="button"
                  onClick={() => demote(editor)}
                  disabled={busy !== null}
                  className={buttonClasses({ variant: 'ghost', size: 'mono' })}
                >
                  {busy === editor.id ? 'Removing…' : 'Remove'}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
