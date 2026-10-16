'use client'

import { useEffect, useId, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Eyebrow } from '@ui/eyebrow'
import { Icon } from '@ui/icon'
import { buttonClasses } from '@ui/button'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Mono line above the title: what this dialog acts on ("Schedule #11"). */
  eyebrow?: React.ReactNode
  description?: React.ReactNode
  /** Bottom bar: a hint on the left, the actions on the right. */
  footer?: React.ReactNode
  /**
   * `sm`: a 520px confirmation. The title is a mono label (color it with a span), no hairlines,
   * the footer is the actions on the right. `eyebrow` and `description` are ignored.
   */
  size?: 'md' | 'sm'
  className?: string
  children: React.ReactNode
}

const PANEL = 'cut notch flex max-h-[calc(100dvh-96px)] flex-col drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)] [--cut:var(--cut-lg)]'

/**
 * A native modal `<dialog>`: focus is trapped and Escape closes it for free. The panel is notched and
 * sits 64px from the top over a blurred scrim; header, body and footer split by hairlines.
 */
export const Dialog = ({ open, onClose, title, eyebrow, description, footer, size = 'md', className, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={twMerge(
        'mx-auto mt-16 max-h-[calc(100dvh-96px)] w-[min(1040px,calc(100vw-32px))] max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[10px]',
        size === 'sm' && 'mt-[min(200px,16dvh)] w-[min(520px,calc(100vw-32px))]',
      )}
    >
      {open && size === 'sm' ? (
        <div className={twMerge(PANEL, 'gap-5.5 overflow-y-auto p-5 [--edge:var(--color-line-mid)] min-[720px]:p-7', className)}>
          <header className="flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-ink-muted signal-strong">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="cut grid size-11 shrink-0 cursor-pointer place-items-center text-ink-dim [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)] hover:text-ink hover:[--edge:var(--color-surface-300)] hover:[--fill:var(--color-surface-300)]"
            >
              <Icon name="close" />
            </button>
          </header>
          {children}
          {footer ? <footer className="flex flex-wrap justify-end gap-4">{footer}</footer> : null}
        </div>
      ) : open ? (
        <div className={twMerge(PANEL, className)}>
          <header className="flex items-start gap-4 border-b border-line px-5 pt-6 pb-5 min-[720px]:px-8 min-[720px]:pt-7 min-[720px]:pb-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {eyebrow ? <Eyebrow rule={false}>{eyebrow}</Eyebrow> : null}
              <h2 id={titleId} className="display-2">{title}</h2>
              {description ? <p className="text-ink-dim body">{description}</p> : null}
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className={twMerge(buttonClasses({ variant: 'ghost', size: 'icon' }), 'max-lg:size-11')}>
              <Icon name="close" />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-6 min-[720px]:px-8">{children}</div>
          {footer ? <footer className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-5 min-[720px]:px-8">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  )
}
