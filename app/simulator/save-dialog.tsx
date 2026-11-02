'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { Field, TextInput } from '@ui/field'
import { setReturnTo } from '@utils/return-to'
import { LIMITS, VISIBILITIES, type ComboVisibility } from '@utils/simulator/types'
import { TOUCH } from './toolbar'
import type { SaveFlow } from './use-save'

type SaveDialogProps = {
  open: boolean
  /** Where the title starts each time the dialog opens: the deck name for a first save, the combo's title for a tied one. */
  initialTitle: string
  /** Who opens the combo: the one it has, or for a first save whoever has the link, as Share expects. */
  initialVisibility: ComboVisibility
  /** A save is on its way: both buttons wait. */
  busy: boolean
  onClose(): void
  /** `title` trimmed, 1–80 characters. */
  onSave(title: string, asNew: boolean, visibility: ComboVisibility): void
}

/** The title of a combo and who opens it, then Save or Save as new. Enter in the field is Save. */
const SaveDialog = ({ open, initialTitle, initialVisibility, busy, onClose, onSave }: SaveDialogProps) => {
  const t = useTranslations('Simulator')
  const id = useId()
  const [title, setTitle] = useState(initialTitle)
  const [visibility, setVisibility] = useState(initialVisibility)
  // Each opening starts from `initialTitle`, set here in render: an effect would show the last title for a frame.
  const [shown, setShown] = useState(open)
  if (shown !== open) {
    setShown(open)
    if (open) {
      setTitle(initialTitle)
      setVisibility(initialVisibility)
    }
  }
  const trimmed = title.trim()
  const off = busy || trimmed.length === 0
  const send = (asNew: boolean) => !off && onSave(trimmed, asNew, visibility)

  return (
    <Dialog
      size="sm"
      open={open}
      onClose={onClose}
      title={t('combos.dialogTitle')}
      footer={
        <>
          <Button variant="secondary" disabled={off} onClick={() => send(true)} className={TOUCH}>
            {t('combos.saveAsNew')}
          </Button>
          <Button disabled={off} onClick={() => send(false)} className={TOUCH}>
            {t('combos.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          send(false)
        }}
      >
        <Field label={t('combos.titleLabel')} htmlFor={id}>
          <TextInput id={id} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} plateClassName={TOUCH} />
        </Field>
        <div className="flex flex-col gap-2">
          <Segmented
            label={t('combos.visibilityLabel')}
            options={VISIBILITIES.map((value) => ({ value, label: t(`combos.visibility.${value}`) }))}
            value={visibility}
            onChange={setVisibility}
          />
          <p className="text-ink-muted body-sm">{t(`combos.visibilityHint.${visibility}`)}</p>
        </div>
      </form>
    </Dialog>
  )
}

const TONE = { signIn: 'info', limit: 'warn', saveFailed: 'negative', damaged: 'negative', failed: 'negative', copied: 'positive', copiedPrivate: 'warn', copyFailed: 'info' } as const

/** What `useSave` shows: the outcome of the last save or share, the title dialog and the conflict dialog. Retry waits out a replay, as Save does. */
export const SaveFlowView = ({ flow, playing }: { flow: SaveFlow; playing: boolean }) => {
  const t = useTranslations('Simulator')
  const { outcome } = flow
  const dismiss = (
    <Button variant="ghost" size="sm" onClick={flow.dismiss} className={TOUCH}>
      {t('dismiss')}
    </Button>
  )

  return (
    <>
      {outcome ? (
        <Alert
          tone={TONE[outcome.kind]}
          edged
          title={t(`combos.${outcome.kind}`)}
          action={
            outcome.kind === 'signIn' ? (
              <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses({ size: 'sm' }), TOUCH)}>
                {t('combos.signInAction')}
              </Link>
            ) : outcome.kind === 'failed' ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={playing || flow.busy} onClick={flow.retry} className={TOUCH}>
                  {t('retry')}
                </Button>
                {dismiss}
              </div>
            ) : (
              dismiss
            )
          }
        >
          {outcome.kind === 'copyFailed' ? (
            <TextInput readOnly value={outcome.link} mono aria-label={t('combos.link')} onFocus={(e) => e.target.select()} plateClassName="mt-2" />
          ) : null}
        </Alert>
      ) : null}

      <SaveDialog
        open={flow.asking !== null}
        initialTitle={flow.asking?.title ?? ''}
        initialVisibility={flow.asking?.visibility ?? 'link'}
        busy={flow.busy}
        onClose={flow.cancel}
        onSave={flow.submit}
      />

      <Dialog
        size="sm"
        open={flow.conflict !== null}
        onClose={flow.closeConflict}
        title={t('combos.conflict.title')}
        footer={
          <>
            <Button variant="secondary" disabled={flow.busy} onClick={flow.reload} className={TOUCH}>
              {t('combos.conflict.reload')}
            </Button>
            <Button disabled={flow.busy} onClick={flow.saveAsNew} className={TOUCH}>
              {t('combos.saveAsNew')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('combos.conflict.body')}</p>
      </Dialog>
    </>
  )
}
