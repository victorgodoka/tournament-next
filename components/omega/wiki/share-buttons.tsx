'use client'

import { useState, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { buttonClasses } from '@ui/button'
import { shareLinks } from './share'
import { WIKI_CHIP } from './wiki'

const noSubscribe = () => () => {}
/** The native share sheet exists on phones and some desktops; read after hydration, never during it. */
const useCanShare = () => useSyncExternalStore(noSubscribe, () => typeof navigator.share === 'function', () => false)

type ShareButtonsProps = {
  url: string
  title: string
  /** What the row shares, when it isn't the page: `Share figure`. */
  label?: string
  /** The 28px row a figure carries. */
  small?: boolean
}

/** The networks, copy link and the native sheet, which replaces them on a phone. Wraps its own status line under the buttons. */
export const ShareButtons = ({ url, title, label = 'Share', small }: ShareButtonsProps) => {
  const canShare = useCanShare()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chip = twMerge(WIKI_CHIP, 'min-h-8 px-3', small && 'min-h-7 px-2.5')

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
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <div className={twMerge('flex flex-wrap items-center justify-end gap-1.5 sm:gap-2', canShare && 'max-sm:hidden')}>
        <span className="mr-1 text-ink-muted signal-sm">{label}</span>
        {shareLinks(url, title).map((link) => (
          <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${link.label}`} className={chip}>
            {link.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy link"
          title="Copy link"
          className={twMerge(WIKI_CHIP, 'size-9 justify-center px-0', small && 'size-7')}
        >
          <Icon name={copied ? 'check' : 'copy'} size={small ? 14 : 16} />
        </button>
      </div>
      {canShare ? (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          className={twMerge(buttonClasses({ variant: 'secondary', size: 'signal' }), 'sm:hidden')}
        >
          <Icon name="share" size={16} />
          {label}
        </button>
      ) : null}
      {/* Never display:none: a live region that appears with its text isn't announced. */}
      <p aria-live="polite" className="basis-full text-right text-cyan signal-sm empty:hidden">
        {error ?? (copied ? 'Link copied.' : '')}
      </p>
    </div>
  )
}
