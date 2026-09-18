import { twMerge } from 'tailwind-merge'

type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: 'default' | 'danger' | 'warning' | 'info' | 'success' | 'amber' | 'magenta'
  variant?: 'solid' | 'ghost' | 'disabled'
}

const colorClasses = {
  default: { solid: 'bg-omega-gray text-omega-ink-black', ghost: 'border-omega-gray text-omega-gray' },
  danger: { solid: 'bg-omega-danger text-white', ghost: 'border-omega-danger text-omega-danger' },
  warning: { solid: 'bg-omega-warning text-omega-ink-black', ghost: 'border-omega-warning text-omega-warning' },
  info: { solid: 'bg-omega-info text-omega-ink-black', ghost: 'border-omega-info text-omega-info' },
  success: { solid: 'bg-omega-green text-omega-ink-black', ghost: 'border-omega-green text-omega-green' },
  amber: { solid: 'bg-omega-amber text-omega-ink-black', ghost: 'border-omega-amber text-omega-amber' },
  magenta: { solid: 'bg-omega-magenta text-white', ghost: 'border-omega-magenta text-omega-magenta' },
}

const disabledClasses = 'bg-omega-ink-light border-omega-faded text-omega-gray-light opacity-60 pointer-events-none'

export const Pill = ({ color = 'default', variant = 'solid', children, className, ...props }: PillProps) => {
  return (
    <span
      aria-disabled={variant === 'disabled' || undefined}
      className={twMerge(
        'inline-flex items-center gap-2 border border-transparent px-4 py-1 font-mono text-sm uppercase tracking-wide',
        variant === 'disabled' ? disabledClasses : colorClasses[color][variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
