'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { EmptyBox } from '@omega/profile/empty-box'
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
  // Every 403 is `FORBIDDEN` now, so an admin target and a missing permission read the same.
  if (error.status === 403) return "Admin roles can't be changed, and your account may not manage editors."
  if (error.status === 401) return 'Your session expired. Sign in again.'
  return "Couldn't save that change."
}

const GROUP_HEAD = 'flex items-baseline justify-between gap-3 border-b border-line pb-2.5'
const ROW = 'flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-b-0'

const Who = ({ editor }: { editor: WikiEditor }) => (
  <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
    <Byline user={editor} size={32} className="text-ink body-strong" />
    <span className="text-ink-muted mono-handle sm:ml-auto">{editor.id}</span>
  </span>
)

type EditorsPanelProps = {
  initial: WikiEditor[]
  /** Server-rendered notes under the add form. */
  children?: React.ReactNode
}

/**
 * Who can write the wiki. Admins are listed too, so the panel doesn't pretend they can't —
 * their rows carry no controls, because no route may touch an admin.
 */
export const EditorsPanel = ({ initial, children }: EditorsPanelProps) => {
  const [editors, setEditors] = useState(initial)
  const [id, setId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  /** Row whose Remove was pressed once. Demotion takes a second, deliberate click. */
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const admins = editors.filter((editor) => editor.role === 'ADMIN')
  const writers = editors.filter((editor) => editor.role !== 'ADMIN')

  const promote = async (event: React.FormEvent) => {
    event.preventDefault()
    const userId = id.trim()
    if (!SNOWFLAKE.test(userId)) return setError('A duelist ID is digits only, at most 20 of them.')
    if (editors.some((row) => row.id === userId)) return setError('That duelist can already write.')

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
    setConfirming(null)
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <div className="flex min-w-0 flex-col gap-9 lg:order-1">
        <section aria-labelledby="editors-head">
          <div className={GROUP_HEAD}>
            <h2 id="editors-head" className="text-ink display-6">
              Editors
            </h2>
            <span className="text-ink-muted signal-sm">{writers.length} can write</span>
          </div>

          {writers.length ? (
            <ul>
              {writers.map((editor) => (
                <li key={editor.id} className={ROW}>
                  <Who editor={editor} />
                  {confirming === editor.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => demote(editor)}
                        className={buttonClasses({ variant: 'danger', size: 'mono' })}
                      >
                        Remove access
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className={buttonClasses({ variant: 'ghost', size: 'mono' })}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(editor.id)}
                      disabled={busy !== null}
                      aria-label={`Remove ${editor.username ?? editor.id} as editor`}
                      className={buttonClasses({ variant: 'ghost', size: 'mono' })}
                    >
                      {busy === editor.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBox title="No editors yet" className="mt-4">
              Add a duelist by ID and they can write and publish any article.
            </EmptyBox>
          )}
        </section>

        <section aria-labelledby="admins-head">
          <div className={GROUP_HEAD}>
            <h2 id="admins-head" className="text-ink display-6">
              Admins
            </h2>
            <span className="text-ink-muted signal-sm">Seeded in the database</span>
          </div>
          <ul>
            {admins.map((editor) => (
              <li key={editor.id} className={ROW}>
                <Who editor={editor} />
                <Chip tone="cyan">Admin</Chip>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="min-w-0 lg:order-2 lg:sticky lg:top-24 lg:self-start">
        <form onSubmit={promote} className="border border-line bg-surface-100 p-5">
          <h2 className="text-ink display-6">Add an editor</h2>
          <label htmlFor="promote-id" className="mt-4 block text-ink-muted signal-sm">
            Duelist ID
          </label>
          <input
            id="promote-id"
            value={id}
            onChange={(event) => {
              setId(event.target.value)
              setError(null)
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            placeholder="187263901827563520"
            aria-invalid={!!error}
            aria-describedby="promote-help promote-status"
            className="mt-2 w-full border border-surface-400 bg-surface-200 px-3 py-2.5 text-ink mono-data placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan aria-invalid:border-loss"
          />
          <p id="promote-help" className="mt-2 text-ink-muted mono-note">
            Their Discord ID. They must have signed in to Omega at least once.
          </p>
          <button
            type="submit"
            disabled={busy !== null || !id.trim()}
            className={twMerge(buttonClasses({ variant: 'primary', size: 'sm' }), 'mt-4 w-full')}
          >
            {busy && busy === id.trim() ? 'Adding…' : 'Add editor'}
          </button>
          <p
            id="promote-status"
            aria-live="polite"
            role={error ? 'alert' : undefined}
            className={twMerge('body-sm empty:hidden', error ? 'mt-3.5 text-loss' : 'mt-3.5 text-cyan')}
          >
            {error ?? done ?? ''}
          </p>
        </form>
        {children}
      </aside>
    </div>
  )
}
