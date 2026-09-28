'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@contexts/auth/auth.context'
import { GHOST_ACTION } from '@omega/wiki'
import { buttonClasses } from '@ui/button'
import { WikiApiError, can, canDelete, deleteArticle, updateArticle } from '@utils/articles'

type ArticleActionsProps = {
  slug: string
  authorId: string
  published: boolean
}

const DANGER = 'min-h-10.5 w-full border border-loss text-loss hover:bg-loss hover:text-space-000 signal-chip cursor-pointer'

/**
 * Editor controls on an article. They are rendered from the viewer's `permissions`, which the
 * server revalidates on every route: hiding a button is courtesy, not security.
 */
export const ArticleActions = ({ slug, authorId, published }: ArticleActionsProps) => {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<'publish' | 'delete' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!can(user, 'wiki.write')) return null

  const togglePublished = async () => {
    setBusy('publish')
    setError(null)
    try {
      await updateArticle(slug, { published: !published })
      router.refresh()
    } catch (cause) {
      console.error(cause)
      setError(cause instanceof WikiApiError && cause.status === 401 ? 'Your session expired. Sign in again.' : "Couldn't save that.")
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteArticle(slug)
      router.push('/wiki')
      router.refresh()
    } catch (cause) {
      console.error(cause)
      setError(
        cause instanceof WikiApiError && cause.code === 'FORBIDDEN'
          ? 'Editors can only delete their own articles.'
          : "Couldn't delete this article.",
      )
      setBusy(null)
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Link href={`/wiki/${slug}/edit`} className={GHOST_ACTION}>
        Edit article
      </Link>
      <Link href={`/wiki/${slug}/history`} className={GHOST_ACTION}>
        History
      </Link>

      <button
        type="button"
        onClick={togglePublished}
        disabled={busy !== null}
        className={buttonClasses({ variant: published ? 'ghost' : 'primary', size: 'mono' }) + ' min-h-10.5 w-full'}
      >
        {busy === 'publish' ? 'Saving…' : published ? 'Unpublish' : 'Publish'}
      </button>

      {canDelete(user, authorId) ? (
        confirming ? (
          <div className="flex gap-2">
            <button type="button" onClick={remove} disabled={busy !== null} className={DANGER}>
              {busy === 'delete' ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonClasses({ variant: 'ghost', size: 'mono' }) + ' min-h-10.5'}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
            Delete article
          </button>
        )
      ) : null}

      <p aria-live="polite" className="text-cyan signal-sm">
        {error ?? (confirming ? 'This also deletes every revision.' : '')}
      </p>
    </div>
  )
}
