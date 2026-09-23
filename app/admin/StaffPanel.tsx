'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button, Chip } from '@ui/index'
import { demoteEditor, listEditors, promoteEditor } from '@utils/articles'
import type { WikiEditor } from '@utils/types'
import { Empty, errorText, Field, List, ListRow, MONO_INPUT, Notice, Row, RowButton } from './ui'

/** `user.manage`, and the only panel here that isn't `system.manage`. Admins are listed too. */
export const StaffPanel = () => {
  const [editors, setEditors] = useState<WikiEditor[] | null>(null)
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => listEditors().then(setEditors).catch((failure) => setError(errorText(failure)))

  useEffect(() => {
    listEditors()
      .then(setEditors)
      .catch((failure) => setError(errorText(failure)))
  }, [])

  const promote = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await promoteEditor(id.trim())
      setId('')
      await load()
    } catch (failure) {
      // `404` here means the duelist has never signed in — promotion never creates a row.
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  const demote = async (userId: string) => {
    try {
      await demoteEditor(userId)
      setEditors((current) => current?.filter((editor) => editor.id !== userId) ?? null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <Row
      index="04"
      title="Wiki staff"
      blurb="Who can write in the wiki. A promotion needs the duelist's Discord id, and only works once they have signed in at least once."
    >
      <div className="grid gap-6">
        <form onSubmit={promote} className="grid gap-4 border border-line bg-surface-100 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="staff-id" label="Discord id" hint="A snowflake, kept as text — it exceeds 2^53.">
            <input
              id="staff-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="165223657990258688"
              required
              className={MONO_INPUT}
            />
          </Field>
          <Button type="submit" size="sm" disabled={busy || !id.trim()}>
            {busy ? 'Promoting…' : 'Make editor'}
          </Button>
        </form>

        <Notice tone="error">{error}</Notice>

        {editors === null ? (
          <Empty>Loading staff…</Empty>
        ) : editors.length === 0 ? (
          <Empty>No editor yet.</Empty>
        ) : (
          <List>
            {editors.map((editor) => (
              <ListRow key={editor.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {editor.avatarUrl ? (
                    <Image src={editor.avatarUrl} alt="" width={60} height={60} className="size-9 shrink-0 rounded-round object-cover duotone" />
                  ) : (
                    <span aria-hidden className="size-9 shrink-0 rounded-round bg-surface-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-ink body-strong">{editor.username ?? 'Duelist'}</p>
                    <p className="text-ink-muted mono-handle">{editor.id}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={editor.role === 'ADMIN' ? 'gold' : 'neutral'}>{editor.role}</Chip>
                  {editor.role === 'ADMIN' ? null : (
                    <RowButton tone="danger" onClick={() => demote(editor.id)}>
                      Remove
                    </RowButton>
                  )}
                </div>
              </ListRow>
            ))}
          </List>
        )}
      </div>
    </Row>
  )
}
