import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'

/**
 * The field plate: chamfered surface-200. Edge line-mid at rest, line-strong on hover, 2px cyan on focus.
 * Exported so custom inputs can sit in the same plate.
 */
export const FIELD =
  'cut flex h-10 min-w-55 items-center gap-2 px-3 text-ink-muted [--fill:var(--color-surface-200)] ' +
  'hover:[--edge:var(--color-line-strong)] focus-within:[--edge:var(--color-cyan)] focus-within:[--sw:var(--stroke)]'

const INPUT = 'min-w-0 flex-1 appearance-none bg-transparent text-ink body outline-none placeholder:text-ink-muted disabled:text-ink-muted'

/** A value that needs a second look (out of the usual range, may not round-trip): gold edge. */
const WARN = '[--edge:var(--color-gold)]'

/** Mono label above a field. */
export const FIELD_LABEL = 'mb-1.5 block text-ink-muted signal-sm'

type SearchFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Only when the placeholder isn't the field's name. */
  label?: string
}

/** A chamfered input with a search glyph. */
export const SearchField = ({ label, className, ...props }: SearchFieldProps) => (
  <label className={twMerge(FIELD, className)}>
    <Icon name="search" size={16} />
    <span className="sr-only">{label ?? props.placeholder ?? 'Search'}</span>
    <input type="search" className={INPUT} {...props} />
  </label>
)

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<string | { value: string; label: string }>
  label?: string
  /** Shows the client's red no-entry sign before the value, for banlist pickers. */
  banlist?: boolean
  /** Mono tag inside the plate before the value ("Limit", "Type"). Names the select when there's no `label`. */
  prefix?: string
  /** Fills its container instead of sitting inline. */
  block?: boolean
}

/** A native select in the field plate, so keyboards and mobile pickers keep working. */
export const Select = ({ options, label, banlist, prefix, block, className, ...props }: SelectProps) => (
  <label className={block ? 'block min-w-0' : 'inline-block'}>
    {label ? <span className={FIELD_LABEL}>{label}</span> : null}
    <span className={twMerge(FIELD, block && 'min-w-0', className)}>
      {banlist ? (
        <span aria-hidden className="relative size-4 shrink-0 rounded-round border-2 border-crimson-lift after:absolute after:inset-y-[-1px] after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:-rotate-45 after:bg-crimson-lift" />
      ) : null}
      {prefix ? <span className="shrink-0 signal-sm">{prefix}</span> : null}
      <select className={twMerge(INPUT, 'cursor-pointer [&>option]:bg-surface-200')} {...props}>
        {options.map((o) => {
          const { value, label: text } = typeof o === 'string' ? { value: o, label: o } : o
          return <option key={value} value={value}>{text}</option>
        })}
      </select>
      <Icon name="down" size={16} />
    </span>
  </label>
)

type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  /** Inside the plate before the value: a unit or a sign ("#", "R$", "×"). */
  prefix?: React.ReactNode
  /** Inside the plate after the value: a unit or a derived figure ("s", "500 base"). */
  suffix?: React.ReactNode
  /** Mono value: ids, bitmasks, passcodes. */
  mono?: boolean
  warn?: boolean
  /** Classes for the plate; `className` goes to the input. */
  plateClassName?: string
}

/** A text input in the field plate, with optional prefix and suffix. */
export const TextInput = ({ prefix, suffix, mono, warn, plateClassName, className, ...props }: TextInputProps) => (
  <span className={twMerge(FIELD, 'min-w-0', warn && WARN, props.disabled && '[--fill:var(--color-surface-100)]', plateClassName)}>
    {prefix ? <span className="shrink-0 font-bold signal">{prefix}</span> : null}
    <input className={twMerge(INPUT, 'h-full', mono && 'mono-data text-sm', className)} {...props} />
    {suffix ? <span className="shrink-0 signal-sm">{suffix}</span> : null}
  </span>
)

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean; plateClassName?: string }

export const TextArea = ({ mono, plateClassName, className, rows = 3, ...props }: TextAreaProps) => (
  <span className={twMerge(FIELD, 'h-auto min-w-0 items-stretch py-2.5', plateClassName)}>
    <textarea rows={rows} className={twMerge(INPUT, 'resize-y', mono && 'mono-data', className)} {...props} />
  </span>
)

type FieldProps = {
  label: React.ReactNode
  /** The control's id, so the label names it. */
  htmlFor?: string
  /** Mono cyan note on the label's right: where the value came from ("From Edison"). */
  source?: React.ReactNode
  /** Mono count on the far right of the label row ("2 of 50"). */
  meta?: React.ReactNode
  hint?: React.ReactNode
  /** Turns the hint gold: the value is allowed but worth a second look. */
  warn?: boolean
  className?: string
  children: React.ReactNode
}

/** Label, control, one line of help. The label is mono; the hint keeps ranges and units off the placeholder. */
export const Field = ({ label, htmlFor, source, meta, hint, warn, className, children }: FieldProps) => (
  <div className={twMerge('flex min-w-0 flex-col gap-2', className)}>
    <div className="flex items-center gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-ink-muted signal">{label}</label>
      ) : (
        <span className="text-ink-muted signal">{label}</span>
      )}
      {source ? <span className="text-cyan signal-sm">{source}</span> : null}
      {meta != null ? <span className="ml-auto text-ink-muted signal-sm">{meta}</span> : null}
    </div>
    {children}
    {hint ? <span className={twMerge('caption', warn ? 'text-gold' : 'text-ink-muted')}>{hint}</span> : null}
  </div>
)
