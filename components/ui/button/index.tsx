import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

type ButtonOwnProps = {
  /**
   * `primary` cyan on the azure plate, `secondary` steel edge, `ghost` bare until hover, `danger` crimson,
   * `danger-outline` crimson edge for a destructive action that isn't the point of the screen,
   * `discord` third-party sign-in only.
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'discord'
  /**
   * `lg` 52px Anton, `md` 40px, `sm` 32px, `mono` 32px mono label, `mono-md` 40px mono label, `signal` 44px mono
   * label, `icon` 40px / `icon-sm` 32px square (pass an aria-label).
   */
  size?: 'lg' | 'md' | 'sm' | 'mono' | 'mono-md' | 'signal' | 'icon' | 'icon-sm'
}

type ButtonProps = ButtonOwnProps &
  (
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
    | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
  )

/** Controls cut top-left and bottom-right (`.cut`); small ones at cut-xs. */
const sizeClasses = {
  lg: 'min-h-13 px-8 action-lg [--cut:var(--cut-md)]',
  md: 'min-h-10 px-5 action-md',
  sm: 'min-h-8 px-3 action-xs [--cut:var(--cut-xs)]',
  mono: 'min-h-8 px-3 signal-strong [--cut:var(--cut-xs)]',
  'mono-md': 'min-h-10 px-4.5 signal-strong',
  signal: 'min-h-11 px-4 signal-strong',
  icon: 'size-10 px-0',
  'icon-sm': 'size-8 px-0 [--cut:var(--cut-xs)]',
}

/**
 * Fills and edges go through the chamfer's --fill / --edge. The primary sits on a hard azure plate:
 * it slides 2px into it on hover and lands flat on press. No other button has an offset.
 */
const variantClasses = {
  primary:
    'text-cyan-on [--edge:var(--color-cyan)] [--fill:var(--color-cyan)] drop-shadow-[4px_4px_0_var(--color-azure)] ' +
    'hover:translate-0.5 hover:drop-shadow-[2px_2px_0_var(--color-azure)] active:translate-1 active:drop-shadow-none',
  secondary:
    'text-ink [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)] active:[--fill:var(--color-surface-400)]',
  ghost:
    'text-ink-dim [--edge:transparent] [--fill:transparent] hover:text-ink hover:[--fill:var(--color-surface-300)] active:[--fill:var(--color-surface-400)]',
  danger:
    'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)] hover:[--edge:#b8172e] hover:[--fill:#b8172e]',
  'danger-outline':
    'text-crimson-lift [--edge:var(--color-crimson-lift)] hover:[--fill:var(--color-surface-300)] active:[--fill:var(--color-surface-400)]',
  discord:
    'text-discord-on [--edge:var(--color-discord)] [--fill:var(--color-discord)] hover:[--edge:var(--color-discord-press)] hover:[--fill:var(--color-discord-press)]',
}

const DISABLED =
  'disabled:cursor-not-allowed disabled:text-ink-muted disabled:[--edge:var(--color-line-mid)] disabled:[--fill:var(--color-surface-100)] disabled:drop-shadow-none disabled:translate-0 ' +
  'aria-disabled:pointer-events-none aria-disabled:text-ink-muted aria-disabled:[--edge:var(--color-line-mid)] aria-disabled:[--fill:var(--color-surface-100)] aria-disabled:drop-shadow-none'

export const buttonClasses = ({ variant = 'primary', size = 'md' }: ButtonOwnProps = {}) =>
  twMerge(
    'cut inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-[translate,filter,color] duration-120 ease-out motion-reduce:transition-none',
    sizeClasses[size],
    variantClasses[variant],
    DISABLED,
  )

export const Button = ({ variant, size, className, ...props }: ButtonProps) => {
  const classes = twMerge(buttonClasses({ variant, size }), className)

  if (props.href !== undefined) {
    const { href, ...rest } = props as React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    return <Link href={href} className={classes} {...rest} />
  }

  const { type = 'button', ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>
  return <button type={type} className={classes} {...rest} />
}
