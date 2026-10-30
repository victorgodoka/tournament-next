'use client'

import { useState, useSyncExternalStore } from 'react'
import { Icon } from '@ui/icon'
import { buttonClasses } from '@ui/button'
import { shareLinks } from './share'

const ICON_BUTTON = buttonClasses({ variant: 'secondary', size: 'icon' })

const noSubscribe = () => () => {}
/** The native share sheet exists on phones and some desktops; read after hydration, never during it. */
const useCanShare = () => useSyncExternalStore(noSubscribe, () => typeof navigator.share === 'function', () => false)

/** The networks, copy link and the native sheet. Wraps its own status line under the buttons. */
export const ShareButtons = ({ url, title }: { url: string; title: string }) => {
  const canShare = useCanShare()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => {
        setError(null)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setError("Couldn't copy the link."),
    )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-ink-muted signal-sm">Share</span>
      {shareLinks(url, title).map((link) => (
        <a
          key={link.id}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${link.label}`}
          title={`Share on ${link.label}`}
          className={ICON_BUTTON}
        >
          <Icon name={link.icon} />
        </a>
      ))}
      <button type="button" onClick={copy} aria-label="Copy link" title="Copy link" className={ICON_BUTTON}>
        <Icon name={copied ? 'check' : 'link'} />
      </button>
      {canShare ? (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          aria-label="Share…"
          title="Share…"
          className={ICON_BUTTON}
        >
          <Icon name="share" />
        </button>
      ) : null}
      {/* Never display:none: a live region that appears with its text isn't announced. */}
      <p aria-live="polite" className="basis-full text-right text-cyan signal-sm empty:hidden">
        {error ?? (copied ? 'Link copied.' : '')}
      </p>
    </div>
  )
}
