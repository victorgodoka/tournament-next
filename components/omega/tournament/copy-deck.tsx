'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'
import { Icon, type IconName } from '@ui/icon'

type CopyButtonProps = {
  /** What lands on the clipboard. Omitted: the page's own URL. */
  value?: string
  label: string
  icon?: IconName
  variant?: 'secondary' | 'ghost'
  size?: 'md' | 'sm'
  className?: string
}

/** Copies text to the clipboard and says so, because nothing else on screen changes. */
export const CopyButton = ({ value, label, icon, variant = 'secondary', size = 'md', className }: CopyButtonProps) => {
  const t = useTranslations('Tournaments.copyDeck')
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value ?? window.location.href)
      setState('copied')
    } catch (error) {
      console.error(error)
      setState('error')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <span className={twMerge('inline-flex items-center gap-3', className)}>
      <button type="button" onClick={copy} className={buttonClasses({ variant, size })}>
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
      </button>
      <span aria-live="polite" className="text-ink-muted signal-sm empty:hidden">
        {state === 'copied' ? t('copied') : state === 'error' ? t('failed') : ''}
      </span>
    </span>
  )
}
