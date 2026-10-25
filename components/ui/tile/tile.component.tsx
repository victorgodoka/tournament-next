import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'

/** Notched grid tile that lifts 2px on hover; selected takes a 2px cyan edge. */
const TILE =
  'cut notch flex cursor-pointer flex-col text-left text-ink [--cut:var(--cut-md)] hover:-translate-y-0.5 hover:[--edge:var(--color-line-strong)] ' +
  'aria-pressed:[--edge:var(--color-cyan)] aria-pressed:[--sw:var(--stroke)] motion-safe:transition-transform motion-safe:duration-120'

type DeckTileProps = {
  name: string
  /** Cover card art, shown untouched. */
  art?: string | null
  favorite?: boolean
  selected?: boolean
  /** Mono line: "Genesys · 40 + 15". */
  meta?: React.ReactNode
  onClick?: () => void
  className?: string
}

/** A deck in a grid: notched cover art, the name, a mono meta line. 184px wide. */
export const DeckTile = ({ name, art, favorite, selected, meta, onClick, className }: DeckTileProps) => (
  <button type="button" aria-pressed={!!selected} onClick={onClick} className={twMerge(TILE, 'w-46', className)}>
    <span
      style={art ? { backgroundImage: `url(${art})` } : undefined}
      className={twMerge('notch-clip relative mx-px mt-px grid aspect-[184/128] place-items-center bg-surface-200 bg-cover bg-center text-line-mid', selected && 'mx-0.5 mt-0.5')}
    >
      {art ? null : <Icon name="deck" size={40} />}
      {favorite ? (
        <span className="absolute top-2 left-2 text-gold drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
          <Icon name="star" label="Favorite" />
        </span>
      ) : null}
    </span>
    <span className="block truncate px-3 pt-2.5 pb-0.5 font-sans text-[15px] leading-5 font-bold">{name}</span>
    {meta ? <span className="block px-3 pb-3 font-mono text-[10px] leading-3.5 tracking-[0.12em] text-ink-muted uppercase">{meta}</span> : null}
  </button>
)
