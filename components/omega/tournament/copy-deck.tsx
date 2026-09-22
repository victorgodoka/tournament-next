'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'

type CopyDeckButtonProps = {
  /** The game's deck code, pasted straight into Omega. */
  code: string
  label?: string
  className?: string
}

/** Copies a decklist to the clipboard and says so, because nothing else on screen changes. */
export const CopyDeckButton = ({ code, label = 'Copy deck code', className }: CopyDeckButtonProps) => {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch (error) {
      console.error(error)
      setState('error')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <span className={twMerge('inline-flex items-center gap-3', className)}>
      <button type="button" onClick={copy} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
        {label}
      </button>
      <span aria-live="polite" className="text-ink-muted signal-sm">
        {state === 'copied' ? 'Copied' : state === 'error' ? "Couldn't copy" : ''}
      </span>
    </span>
  )
}
