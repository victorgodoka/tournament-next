import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '@ui/icon'
import { Thumb } from '@ui/thumb'

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

type ItemTileProps = {
  /** Uploaded art; without it the dot field shows `icon`. */
  src?: string | null
  icon: IconName
  /** A live preview drawn over the dot field instead of `src` (a chat bubble, say). */
  art?: React.ReactNode
  /** Mono line above the name: the item's kind. */
  kicker: React.ReactNode
  title: React.ReactNode
  /** A sentence under the name. On `row` it only shows from 720px. */
  detail?: React.ReactNode
  /** `row` only: chips above the kicker ("Limited", a date). */
  badges?: React.ReactNode
  /** Price and action, or state: pinned to the bottom. */
  footer?: React.ReactNode
  /** In use: a 2px cyan edge. */
  selected?: boolean
  /** `stack` for a grid; `row` is the featured steel card, art beside the text. */
  layout?: 'stack' | 'row'
  className?: string
}

const LIFT = 'hover:-translate-y-0.5 motion-safe:transition-transform motion-safe:duration-120'
const SELECTED = '[--edge:var(--color-cyan)] [--sw:var(--stroke)]'

/**
 * An item a duelist can own: notched card with the art over a dot field, a kind, a name and a footer.
 * Not a button itself: the footer carries the actions.
 */
export const ItemTile = ({ src, icon, art, kicker, title, detail, badges, footer, selected, layout = 'stack', className }: ItemTileProps) =>
  layout === 'row' ? (
    <article
      className={twMerge(
        'cut notch grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-3.5 p-4 text-ink [--cut:var(--cut-md)] [--edge:var(--color-steel-edge)] [--fill:var(--color-steel)]',
        'min-[720px]:grid-cols-[148px_minmax(0,1fr)] min-[720px]:grid-rows-[1fr_auto] min-[720px]:gap-x-5 min-[720px]:gap-y-1.5',
        LIFT,
        selected && SELECTED,
        className,
      )}
    >
      <Thumb wide src={art ? null : src} className="size-24 min-[720px]:row-span-2 min-[720px]:size-37">
        {art ?? <Icon name={icon} size={56} className="size-10 min-[720px]:size-14" />}
      </Thumb>
      <div className="flex min-w-0 flex-col gap-1.5">
        {badges ? <div className="flex flex-wrap items-center gap-2 min-[720px]:gap-2.5">{badges}</div> : null}
        <span className="text-ink-dim signal-sm min-[720px]:mt-1.5">{kicker}</span>
        <h3 className="font-sans text-[20px] leading-6.5 font-medium">{title}</h3>
        {detail ? <p className="text-ink-dim body-sm max-[719px]:hidden">{detail}</p> : null}
      </div>
      {footer ? (
        <div className="col-span-2 flex items-center justify-between gap-2 min-[720px]:col-span-1 min-[720px]:col-start-2">{footer}</div>
      ) : null}
    </article>
  ) : (
    <article
      className={twMerge(
        'cut notch flex flex-col text-ink [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] hover:[--fill:var(--color-surface-200)]',
        LIFT,
        selected && SELECTED,
        className,
      )}
    >
      <Thumb wide src={art ? null : src} className={twMerge('notch-clip mx-px mt-px h-30 w-auto min-[720px]:h-34', selected && 'mx-0.5 mt-0.5')}>
        {art ?? <Icon name={icon} size={56} className="size-12 min-[720px]:size-14" />}
      </Thumb>
      <div className="flex flex-1 flex-col gap-1 px-3 pt-3 pb-3.5 min-[720px]:px-4 min-[720px]:pt-3.5 min-[720px]:pb-4">
        <span className="text-azure-lift signal-sm">{kicker}</span>
        <h3 className="text-[15px] leading-5.5 font-medium">{title}</h3>
        {detail ? <p className="text-ink-dim body-sm">{detail}</p> : null}
        {footer ? (
          <div className="mt-auto flex min-h-13.5 items-end justify-between gap-2 pt-2.5 min-[720px]:min-h-14.5 min-[720px]:pt-3">{footer}</div>
        ) : null}
      </div>
    </article>
  )
