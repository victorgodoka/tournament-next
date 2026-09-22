'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@contexts/auth/auth.context'
import { buttonClasses } from '@ui/button'
import { can, restoreRevision } from '@utils/articles'

/**
 * Restoring is a normal edit: the old title and body come back as a **new** revision, so the
 * restore itself can be undone, and publication is left exactly as it was.
 */
export const RestoreButton = ({ slug, revisionId }: { slug: string; revisionId: string }) => {
  const { user } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  if (!can(user, 'wiki.write')) return null

  const restore = async () => {
    setStatus('saving')
    try {
      const article = await restoreRevision(slug, revisionId)
      router.push(`/wiki/${article.slug}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={restore}
        disabled={status === 'saving'}
        className={buttonClasses({ variant: 'primary', size: 'sm' })}
      >
        {status === 'saving' ? 'Restoring…' : 'Restore this version'}
      </button>
      <p aria-live="polite" className="text-gold body-sm">
        {status === 'error' ? "Couldn't restore that version." : ''}
      </p>
    </div>
  )
}
