import { twMerge } from 'tailwind-merge'

export type ChipTone =
  | 'gold' | 'cyan' | 'indigo' | 'neutral' | 'positive' | 'negative' | 'amber'
  // Ladders and badges from the DS. `live` is always filled with the pulsing dot.
  | 'tcg' | 'ocg' | 'genesys' | 'vip' | 'pass' | 'admin' | 'custom' | 'live'

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone
  /** Filled rather than edged. For the single most important status in a set (`negative` solid is LIVE). */
  solid?: boolean
  /** Prefixes a 6px live dot in the current color. */
  dot?: boolean
}

/** Edge in the tone's color over surface-200; text stays ink except where the tone is the value (gold). */
const edged: Record<ChipTone, string> = {
  gold: 'text-gold [--edge:var(--color-gold)]',
  cyan: 'text-ink [--edge:var(--color-cyan)]',
  indigo: 'text-ink [--edge:var(--color-azure-lift)]',
  neutral: 'text-ink-dim',
  positive: 'text-ink [--edge:var(--color-win)]',
  negative: 'text-crimson-lift [--edge:var(--color-crimson-lift)]',
  amber: 'text-gold [--edge:var(--color-gold)]',
  tcg: 'text-ink [--edge:var(--color-ladder-tcg)]',
  ocg: 'text-ink [--edge:var(--color-series-4)]',
  genesys: 'text-ink [--edge:var(--color-ladder-genesys)]',
  vip: 'text-gold [--edge:var(--color-gold)]',
  pass: 'text-ink [--edge:var(--color-azure-lift)]',
  admin: 'text-ink [--edge:var(--color-crimson-lift)]',
  custom: 'text-crimson-lift [--edge:var(--color-crimson-lift)]',
  live: 'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)]',
}

const filled: Record<ChipTone, string> = {
  gold: 'text-gold-on [--edge:var(--color-gold)] [--fill:var(--color-gold)]',
  cyan: 'text-cyan-on [--edge:var(--color-cyan)] [--fill:var(--color-cyan)]',
  indigo: 'text-ink [--edge:var(--color-azure)] [--fill:var(--color-azure)]',
  neutral: 'text-space-000 [--edge:var(--color-ink)] [--fill:var(--color-ink)]',
  positive: 'text-space-000 [--edge:var(--color-win)] [--fill:var(--color-win)]',
  negative: 'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)]',
  amber: 'text-gold-on [--edge:var(--color-gold)] [--fill:var(--color-gold)]',
  tcg: 'text-space-000 [--edge:var(--color-ladder-tcg)] [--fill:var(--color-ladder-tcg)]',
  ocg: 'text-space-000 [--edge:var(--color-series-4)] [--fill:var(--color-series-4)]',
  genesys: 'text-space-000 [--edge:var(--color-ladder-genesys)] [--fill:var(--color-ladder-genesys)]',
  vip: 'text-gold-on [--edge:var(--color-gold)] [--fill:var(--color-gold)]',
  pass: 'text-ink [--edge:var(--color-azure)] [--fill:var(--color-azure)]',
  admin: 'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)]',
  custom: 'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)]',
  live: 'text-ink [--edge:var(--color-crimson)] [--fill:var(--color-crimson)]',
}

const MARK = {
  ok: { dot: 'bg-win', text: 'text-ink-dim' },
  warn: { dot: 'bg-gold', text: 'font-bold text-gold' },
  bad: { dot: 'bg-crimson-lift', text: 'font-bold text-crimson-lift' },
}

/** A check that passed or didn't, in a line of them: a 6px square and a caption. */
export const Mark = ({ tone = 'ok', children }: { tone?: keyof typeof MARK; children: React.ReactNode }) => (
  <span className={twMerge('inline-flex items-center gap-1.5 caption', MARK[tone].text)}>
    <span aria-hidden className={twMerge('size-1.5 shrink-0', MARK[tone].dot)} />
    {children}
  </span>
)

type FilterChipProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  pressed: boolean
  label: React.ReactNode
  /** Muted number after the label: how many the filter leaves. */
  count?: number
}

/** A toggle in a filter row: 34px mono chip, cyan edge over ground-cyan when on. 42px tall to hit. */
export const FilterChip = ({ pressed, label, count, className, ...props }: FilterChipProps) => (
  <button type="button" aria-pressed={pressed} className={twMerge('group shrink-0 cursor-pointer py-1', className)} {...props}>
    <span
      className={twMerge(
        'cut flex h-8.5 items-center gap-2 px-3 whitespace-nowrap signal-strong [--cut:var(--cut-xs)]',
        pressed ? 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]' : 'text-ink-dim group-hover:text-ink',
      )}
    >
      {label}
      {count !== undefined ? <span className="text-ink-muted">{count}</span> : null}
    </span>
  </button>
)

/** A picked value that can be taken out: 32px, a mono note after the label, an × on the right. */
export const Tag = ({ children, note, onRemove, removeLabel }: { children: React.ReactNode; note?: React.ReactNode; onRemove: () => void; removeLabel: string }) => (
  <span className="cut inline-flex h-8 items-center gap-2 pr-1 pl-3 text-sm text-ink [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]">
    {children}
    {note != null ? <span className="text-ink-muted data">{note}</span> : null}
    <button type="button" aria-label={removeLabel} onClick={onRemove} className="grid size-7 cursor-pointer place-items-center text-ink-muted hover:text-crimson-lift max-lg:size-11">
      <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden fill="currentColor">
        <path d="M5.3 3.9 12 10.6l6.7-6.7 1.4 1.4-6.7 6.7 6.7 6.7-1.4 1.4-6.7-6.7-6.7 6.7-1.4-1.4 6.7-6.7-6.7-6.7z" />
      </svg>
    </button>
  </span>
)

/** Status label: mono, 24px, chamfered at cut-xs. */
export const Chip = ({ tone = 'neutral', solid, dot, children, className, ...props }: ChipProps) => (
  <span
    className={twMerge(
      'cut inline-flex h-6 items-center gap-1.5 justify-self-start px-2 whitespace-nowrap signal-chip [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]',
      solid ? filled[tone] : edged[tone],
      className,
    )}
    {...props}
  >
    {dot || tone === 'live' ? <span aria-hidden className="size-1.5 shrink-0 rounded-round bg-current motion-safe:animate-blink" /> : null}
    {children}
  </span>
)
