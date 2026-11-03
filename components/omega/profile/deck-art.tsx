import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import type { CardArt as CardArtType } from '@utils/types'

const SIZE = {
  md: { box: 'h-12.5 w-13', main: 'size-11', sub: 'size-6', px: ['44px', '24px'] },
  sm: { box: 'h-10.5 w-11', main: 'size-9', sub: 'size-5', px: ['36px', '20px'] },
} as const

/**
 * A deck as the history draws it: the main archetype's art, and in a mixed deck the secondary's,
 * smaller over the bottom-right corner. `hidden` is the owner hiding their decks.
 */
export const DeckArt = ({ cards, hidden, size = 'md', className }: { cards: CardArtType[]; hidden?: boolean; size?: keyof typeof SIZE; className?: string }) => {
  const s = SIZE[size]
  const [main, sub] = cards
  return (
    <span className={twMerge('relative shrink-0', s.box, className)}>
      {main ? (
        <CardArt art={main} sizes={s.px[0]} className={twMerge('absolute top-0 left-0 border border-line-mid', s.main)} />
      ) : (
        <span aria-hidden className={twMerge('absolute top-0 left-0 grid place-items-center border border-line-mid bg-surface-200', s.main)}>
          {hidden ? (
            <svg viewBox="0 0 24 24" width={16} height={16} className="fill-line-strong">
              <path fillRule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0zm2 4v4h2v-4z" />
            </svg>
          ) : null}
        </span>
      )}
      {sub ? (
        <CardArt art={sub} sizes={s.px[1]} className={twMerge('absolute right-0 bottom-0 border-2 border-surface-100 outline outline-line-mid', s.sub)} />
      ) : null}
    </span>
  )
}
