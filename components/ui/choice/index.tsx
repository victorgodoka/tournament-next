'use client'

import { twMerge } from 'tailwind-merge'

type SwitchProps = {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  /** Caption under the label. */
  hint?: React.ReactNode
  /** Regular 14px label, for a filter in a toolbar rather than a setting in a form. */
  quiet?: boolean
  disabled?: boolean
  className?: string
}

/** On/off setting: a square track that turns cyan, the label beside it. */
export const Switch = ({ checked, onChange, label, hint, quiet, disabled, className }: SwitchProps) => (
  <label className={twMerge('flex cursor-pointer gap-3.5', hint ? 'items-start' : 'items-center', disabled && 'cursor-not-allowed opacity-(--opacity-dim)', className)}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={twMerge(
        'relative h-5.5 w-10 shrink-0 cursor-pointer bg-surface-400 focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed',
        'after:absolute after:top-0.75 after:left-0.75 after:size-4 after:bg-line-strong motion-safe:after:transition-transform motion-safe:after:duration-120',
        checked && 'bg-ground-cyan shadow-[inset_0_0_0_1px_var(--color-cyan)] after:translate-x-4.5 after:bg-cyan',
      )}
    />
    <span className="flex flex-col gap-1">
      <span className={quiet ? 'text-sm text-ink' : 'body-strong text-ink'}>{label}</span>
      {hint ? <span className="caption text-ink-muted">{hint}</span> : null}
    </span>
  </label>
)

type SegmentedProps<T extends string | number> = {
  options: ReadonlyArray<{ value: T; label: React.ReactNode; disabled?: boolean }>
  value: T
  onChange: (value: T) => void
  /** Names the group for screen readers. */
  label: string
  /** 36px for a toolbar, 40px (default) next to form fields. */
  size?: 'sm' | 'md'
  className?: string
}

/** One choice out of a few, all visible: chamfered mono buttons, the pressed one on a cyan edge. */
export const Segmented = <T extends string | number>({ options, value, onChange, label, size = 'md', className }: SegmentedProps<T>) => (
  <div role="group" aria-label={label} className={twMerge('flex flex-wrap gap-1', className)}>
    {options.map((option) => {
      const on = option.value === value
      return (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={on}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={twMerge(
            'cut cursor-pointer px-3.5 whitespace-nowrap signal-strong [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)] disabled:cursor-not-allowed disabled:opacity-(--opacity-dim)',
            size === 'sm' ? 'h-9' : 'h-10',
            on ? 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)] [--sw:var(--stroke)]' : 'text-ink-dim hover:[--fill:var(--color-surface-300)]',
          )}
        >
          {option.label}
        </button>
      )
    })}
  </div>
)

type OptionCardProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
}

/**
 * A choice with more to say than a label: a chamfered card that is a radio. Put it in an element with
 * `role="radiogroup"`. Checked takes the cyan edge; disabled drops to surface-100.
 */
export const OptionCard = ({ checked, className, children, ...props }: OptionCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    className={twMerge(
      'cut w-full cursor-pointer text-left text-ink [--fill:var(--color-surface-200)] hover:[--fill:var(--color-surface-300)]',
      'disabled:cursor-not-allowed disabled:text-ink-muted disabled:[--fill:var(--color-surface-100)]',
      checked && '[--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)] [--sw:var(--stroke)] hover:[--fill:var(--color-ground-cyan)]',
      className,
    )}
    {...props}
  >
    {children}
  </button>
)

/** The round radio mark, for an {@link OptionCard} that reads as a list row. */
export const RadioDot = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden
    className={twMerge(
      'size-4.5 shrink-0 rounded-round shadow-[inset_0_0_0_2px_var(--color-line-strong)]',
      checked && 'bg-cyan shadow-[inset_0_0_0_2px_var(--color-cyan),inset_0_0_0_5px_var(--color-ground-cyan)]',
    )}
  />
)
