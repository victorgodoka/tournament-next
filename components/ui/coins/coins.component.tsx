import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'

/** The client's gold hexagon coin. Alone, as a field's prefix or a unit mark. */
export const Coin =({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 22" aria-hidden className={twMerge('shrink-0', className)}>
    <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" fill="var(--color-gold)" />
    <polygon points="10,4.5 16,8 16,14 10,17.5 4,14 4,8" fill="none" stroke="#a8832f" strokeWidth={1.6} />
    <circle cx={10} cy={11} r={2.6} fill="#fff6d6" />
  </svg>
)

/** Display amounts: the flat coin glyph and a gold Anton number. Icon px, the number's type, the gap. */
const DISPLAY = {
  sm: [14, 'text-[20px]', 'gap-1.5'],
  md: [16, 'text-[22px]', 'gap-1.5'],
  bar: [18, 'text-[18px]', 'gap-2'],
  lg: [20, 'text-[32px]', 'gap-2'],
  xl: [34, 'text-[40px]', 'gap-3'],
} as const

type CoinsProps = {
  amount: number | string
  /** `mono` (default) for prizes in a row; `display` for prices and balances. */
  variant?: 'mono' | 'display'
  size?: 'md' | 'lg'
  /** Only with `variant="display"`. */
  displaySize?: keyof typeof DISPLAY
  /** The balance can't cover it: the amount turns `loss`. */
  short?: boolean
  /** Screen-reader name of the currency. */
  unit?: string
  className?: string
}

/** An amount of currency: the coin plus a number with a comma ("7,500"). */
export const Coins = ({ amount, variant = 'mono', size = 'md', displaySize = 'md', short, unit = 'Omega Coins', className }: CoinsProps) => {
  const text = typeof amount === 'number' ? amount.toLocaleString('en-US') : amount

  if (variant === 'display') {
    const [px, type, gap] = DISPLAY[displaySize]
    return (
      <span className={twMerge('inline-flex items-center leading-none whitespace-nowrap text-gold tabular-nums', gap, short && 'text-loss', className)}>
        <Icon name="coin" size={px} />
        <span className={twMerge('font-display uppercase', type)}>{text}</span>
        <span className="sr-only"> {unit}</span>
      </span>
    )
  }

  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 font-mono leading-none font-bold whitespace-nowrap text-ink tabular-nums',
        size === 'lg' ? 'text-lg' : 'text-sm',
        short && 'text-loss',
        className,
      )}
    >
      <Coin className={size === 'lg' ? 'h-6 w-5.5' : 'h-4.5 w-4'} />
      {text}
      <span className="sr-only"> {unit}</span>
    </span>
  )
}
