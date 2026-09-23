'use client'

import { twMerge } from 'tailwind-merge'
import { PanelApiError } from '@utils/panel'

/* Field chrome, shared by every form in the panel. Same values as the profile editor, so a form
   here and a form there are the same object. */
export const LABEL = 'block text-ink-muted signal-sm'
export const INPUT =
  'w-full border border-surface-400 bg-surface-200 px-3.5 py-3.25 text-ink body placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan'
export const MONO_INPUT = twMerge(INPUT, 'mono-data')

/** Label, control, and the one line of help that keeps a range or a unit off the placeholder. */
export const Field = ({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) => (
  <div className={twMerge('min-w-0', className)}>
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    <div className="mt-2.5">{children}</div>
    {hint ? <p className="mt-1.5 text-ink-muted mono-note">{hint}</p> : null}
  </div>
)

/** A band of the panel: index, title, blurb on the left, the working area on the right. */
export const Row = ({
  index,
  title,
  blurb,
  action,
  children,
}: {
  index: string
  title: string
  blurb: string
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <section className="grid grid-cols-1 gap-4.5 border-b border-line px-5.5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-11 lg:p-11">
    <div>
      <p className="font-bold text-gold signal-lg">{index}</p>
      <h2 className="mt-3.5 text-ink display-4">{title}</h2>
      <p className="mt-2.5 max-w-[34ch] text-ink-dim body-sm">{blurb}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
    <div className="min-w-0">{children}</div>
  </section>
)

const NOTICE_TONE = {
  error: 'border-negative text-negative bg-ground-negative',
  info: 'border-line text-ink-dim bg-ground-soft',
  ok: 'border-positive text-positive bg-ground-positive',
} as const

export const Notice = ({ tone = 'info', children }: { tone?: keyof typeof NOTICE_TONE; children: React.ReactNode }) =>
  children ? <p className={twMerge('border px-4 py-3 body-sm', NOTICE_TONE[tone])}>{children}</p> : null

/**
 * The API names the field that failed in `message`; a bare status is useless to the admin typing
 * the form. `ALREADY_LINKED` and `ALREADY_EXISTS` arrive as codes, so they are said in words.
 */
export const errorText = (error: unknown) => {
  if (error instanceof PanelApiError) {
    if (error.code === 'ALREADY_EXISTS') return error.message || 'A format with that name already exists.'
    if (error.code === 'ALREADY_LINKED') return error.message || 'Another schedule already claimed that tournament.'
    if (error.status === 401) return 'Your session expired. Sign in again.'
    if (error.status === 403) return 'This account is not an admin, or the request came from the wrong origin.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="border border-dashed border-line px-4 py-8 text-center text-ink-muted body-sm">{children}</p>
)

/** Hairline-gapped list, the same grid the leaderboard and match history use. */
export const List = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <ul className={twMerge('grid gap-px border border-line bg-line', className)}>{children}</ul>
)

export const ListRow = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <li className={twMerge('bg-surface-000 px-4 py-3.75', className)}>{children}</li>
)

/** Small mono action that sits inside a row, not a page-level Button. */
export const RowButton = ({
  tone = 'neutral',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'danger' | 'gold' }) => (
  <button
    type="button"
    className={twMerge(
      'inline-flex min-h-8 cursor-pointer items-center gap-1.5 border px-2.75 signal disabled:cursor-not-allowed disabled:border-surface-400 disabled:text-ink-muted',
      tone === 'danger'
        ? 'border-surface-400 text-ink-muted hover:border-negative hover:bg-negative hover:text-negative-on'
        : tone === 'gold'
          ? 'border-gold text-gold hover:bg-gold hover:text-gold-on'
          : 'border-surface-400 text-ink-dim hover:border-ink hover:bg-ink hover:text-ink-on',
      className,
    )}
    {...props}
  />
)

/** `Intl` in the browser's own zone: the admin schedules in local time, the API stores UTC. */
export const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const day = (value: string | null) => value ?? 'any'

/** `budgetCents` is an integer of cents and is only ever formatted for display. */
export const money = (cents: number) => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'BRL' })
