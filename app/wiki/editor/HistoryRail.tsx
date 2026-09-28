'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { deleteArticle, getRevisions, restoreRevision } from '@utils/articles'
import type { Article, Revision } from '@utils/types'
import { failure } from '../ArticleForm'
import { Help, when } from './ui'

type HistoryRailProps = {
  /** The saved slug: revisions only answer on the current address (REVISAO_WIKI §2.6). */
  slug: string
  author: string
  canDelete: boolean
  /** Unsaved work would be replaced by a restore. */
  dirty: boolean
  onRestored: (article: Article) => void
  onDeleted: () => void
}

/** Every save is a revision. Loaded when the tab opens; restoring comes back as a new revision. */
export const HistoryRail = ({ slug, author, canDelete, dirty, onRestored, onDeleted }: HistoryRailProps) => {
  const [revisions, setRevisions] = useState<Revision[] | 'error' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getRevisions(slug)
      .then((list) => !controller.signal.aborted && setRevisions(list))
      .catch(() => !controller.signal.aborted && setRevisions('error'))
    return () => controller.abort()
  }, [slug])

  const restore = async (id: string) => {
    if (dirty && !window.confirm('Restoring replaces your unsaved changes. Continue?')) return
    setBusy(id)
    setError(null)
    try {
      onRestored(await restoreRevision(slug, id))
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteArticle(slug)
      onDeleted()
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
      setBusy(null)
    }
  }

  return (
    <div>
      <p className="border-b border-line px-5 py-4 text-ink-dim body-sm">
        Every save is a revision. Restoring brings an old version back as a new edit, so nothing is lost and it never publishes a draft.
      </p>
      {revisions === null ? (
        <p className="px-5 py-4 text-ink-muted body-sm">Loading…</p>
      ) : revisions === 'error' ? (
        <p className="px-5 py-4 text-loss body-sm">Couldn&apos;t load the history.</p>
      ) : (
        <ol>
          {revisions.map((revision, i) => {
            const name = revision.editor.username ?? 'Unknown'
            return (
              <li key={revision.id} className={twMerge('border-b border-line px-5 py-3.5', i === 0 && 'bg-surface-200')}>
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center bg-azure text-ink body-strong">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] leading-4.5 text-ink body-strong">{name}</p>
                    <p className="text-ink-muted caption">
                      {when(revision.createdAt)} · #{revision.id}
                      {i === revisions.length - 1 ? ' · created' : ''}
                    </p>
                  </div>
                  {i === 0 ? <span className="cut px-1.75 py-1 text-ink signal-sm [--cut:var(--cut-xs)] [--edge:var(--color-ground-cyan)] [--fill:var(--color-ground-cyan)]">Current</span> : null}
                </div>
                {i === 0 ? null : (
                  <div className="mt-2.5 flex gap-3.5 pl-9.5">
                    <Link href={`/wiki/${slug}/history?rev=${revision.id}`} className="signal-sm">
                      View
                    </Link>
                    <button type="button" disabled={!!busy} onClick={() => void restore(revision.id)} className="cursor-pointer text-cyan signal-sm hover:text-ink disabled:opacity-40">
                      {busy === revision.id ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <Help className="mt-0 border-t border-line px-5 py-3">Newest 50 · deleting the article deletes its history</Help>

      {canDelete ? (
        <div className="cut notch mt-5 px-5 py-4 [--cut:var(--cut-lg)] [--edge:var(--color-line)]">
          <p className="text-ink-muted signal">Danger zone</p>
          <p className="mt-2 mb-3 text-ink-dim body-sm">Only the author ({author}) or an admin can delete. The URL answers 404 afterwards.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy === 'delete'}
              onClick={() => (confirming ? void remove() : setConfirming(true))}
              className="cut min-h-9 cursor-pointer px-3.5 text-ink signal-strong [--edge:var(--color-crimson)] [--fill:var(--color-crimson)] disabled:opacity-40"
            >
              {busy === 'delete' ? 'Deleting…' : confirming ? 'Delete for good' : 'Delete article'}
            </button>
            {confirming ? (
              <button type="button" onClick={() => setConfirming(false)} className="cursor-pointer text-ink-dim signal-strong hover:text-ink">
                Cancel
              </button>
            ) : null}
          </div>
          {confirming ? <Help>This also deletes every revision.</Help> : null}
        </div>
      ) : null}
      <p aria-live="polite" role={error ? 'alert' : undefined} className="mt-2 px-5 text-loss body-sm empty:hidden">
        {error ?? ''}
      </p>
    </div>
  )
}
