import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

type ButtonOwnProps = {
  /** `primary` gold plate, `secondary` ink outline, `ghost` hairline outline, `discord` third-party sign-in only. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'discord'
  /** `lg` 60px, `md` 52px, `sm` 48px, `mono` 36px mono label. */
  size?: 'lg' | 'md' | 'sm' | 'mono'
  /** Cyan offset shadow. Primary only, for the one leading action on a view. */
  shadow?: boolean
}

type ButtonProps = ButtonOwnProps &
  (
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
    | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
  )

const sizeClasses = {
  lg: 'min-h-15 px-8.5 action-lg',
  md: 'min-h-13 px-7.5 action-md',
  sm: 'min-h-12 px-6 action-sm',
  mono: 'min-h-9 px-3.75 signal-chip',
}

const variantClasses = {
  primary: 'bg-gold text-gold-on hover:bg-cyan hover:text-cyan-on',
  secondary: 'border-line-strong text-ink hover:bg-ink hover:text-surface-000',
  ghost: 'border-line text-ink-dim hover:border-gold hover:text-gold',
  discord: 'bg-discord text-discord-on hover:bg-discord-press',
}

/** The plate slides into its own shadow on hover. */
const SHADOW = 'shadow-offset-cyan hover:translate-1 hover:shadow-offset-cyan-press'

const DISABLED =
  'disabled:cursor-not-allowed disabled:border-surface-400 disabled:bg-surface-400 disabled:text-ink-muted disabled:shadow-none disabled:translate-0 ' +
  'aria-disabled:pointer-events-none aria-disabled:border-surface-400 aria-disabled:bg-surface-400 aria-disabled:text-ink-muted aria-disabled:shadow-none'

export const buttonClasses = ({ variant = 'primary', size = 'md', shadow }: ButtonOwnProps = {}) =>
  twMerge(
    'inline-flex cursor-pointer items-center justify-center gap-2.5 border border-transparent whitespace-nowrap',
    sizeClasses[size],
    variantClasses[variant],
    shadow && variant === 'primary' && SHADOW,
    DISABLED,
  )

export const Button = ({ variant, size, shadow, className, ...props }: ButtonProps) => {
  const classes = twMerge(buttonClasses({ variant, size, shadow }), className)

  if (props.href !== undefined) {
    const { href, ...rest } = props as React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    return <Link href={href} className={classes} {...rest} />
  }

  const { type = 'button', ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>
  return <button type={type} className={classes} {...rest} />
}
