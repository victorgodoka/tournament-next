import { twMerge } from 'tailwind-merge'

export type CardType = 'normal' | 'effect' | 'ritual' | 'spell' | 'trap' | 'fusion' | 'synchro' | 'xyz' | 'link'

export const LABEL: Record<CardType, string> = {
  normal: 'Normal', effect: 'Effect', ritual: 'Ritual', spell: 'Spell', trap: 'Trap',
  fusion: 'Fusion', synchro: 'Synchro', xyz: 'Xyz', link: 'Link',
}
/** Light frames take dark numerals. */
const DARK_ON: Partial<Record<CardType, true>> = { normal: true, spell: true, synchro: true }
const fill = (type: CardType) => `var(--color-type-${type})`

type TypeCountsProps = {
  /** In card-frame order. */
  items: Array<{ type: CardType; count: number }>
  /** Composition bar under the boxes. */
  bar?: boolean
  /** Names under the boxes; on for the deck page. */
  legend?: boolean
  className?: string
}

/** The deck editor's card-type counts as flat boxes in the client's frame colors. */
export const TypeCounts = ({ items, bar, legend, className }: TypeCountsProps) => {
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1">
        {items.map(({ type, count }) => (
          <span
            key={type}
            title={`${LABEL[type]}: ${count}`}
            style={{ background: fill(type) }}
            className={twMerge(
              'inline-flex h-7 min-w-11 items-center justify-center rounded-xs px-2 font-mono text-[13px] leading-none font-bold tabular-nums',
              DARK_ON[type] ? 'text-space-000' : 'text-ink',
              type === 'xyz' && 'shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
            )}
          >
            {count}
            <span className="sr-only"> {LABEL[type]}</span>
          </span>
        ))}
      </div>
      {bar ? (
        <div aria-hidden className="mt-3 flex h-2 gap-0.5">
          {items.filter((i) => i.count > 0).map(({ type, count }) => (
            <span key={type} className="block h-full" style={{ width: `${(count / total) * 100}%`, background: fill(type) }} />
          ))}
        </div>
      ) : null}
      {legend ? (
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[10px] leading-3.5 tracking-[0.12em] text-ink-dim uppercase">
          {items.map(({ type, count }) => (
            <span key={type}>
              <i className="mr-1.5 inline-block size-2" style={{ background: fill(type) }} />
              {LABEL[type]} {count}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
